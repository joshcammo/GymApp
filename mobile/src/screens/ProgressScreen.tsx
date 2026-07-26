import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-gifted-charts';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { muscleGroupLabel, MUSCLE_GROUPS } from '../constants/muscleGroups';
import { sinceDateForRange, parseDateStr } from '../utils/dateUtils';
import {
  ExerciseDef, MuscleGroup, MuscleGroupBalance, MuscleGroupVolume, OneRmTrendPoint, TimeRange,
  WeeklyVolumePoint,
} from '../types';
import { analyticsApi } from '../services/api';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { PressableScale } from '../components/PressableScale';
import { EmptyState } from '../components/EmptyState';
import { haptics } from '../utils/haptics';
import { BalanceBucket, BalanceRead, classifyBalance } from '../utils/muscleBalance';

type Tab = '1RM' | 'VOLUME' | 'BREAKDOWN' | 'HEATMAP';
type VolumeMode = 'EXERCISE' | 'MUSCLE_GROUP';

/** usesRange defaults to true — only a tab that ignores the shared
 *  time-range selector (like the heatmap, which is always "last 7 days
 *  vs. your own baseline") needs to opt out. */
const TABS: { key: Tab; label: string; usesRange?: boolean }[] = [
  { key: '1RM',       label: '1RM' },
  { key: 'VOLUME',    label: 'Volume' },
  { key: 'BREAKDOWN', label: 'Groups' },
  { key: 'HEATMAP',   label: 'Heatmap', usesRange: false },
];

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '4W',  label: '4W' },
  { key: '3M',  label: '3M' },
  { key: '1Y',  label: '1Y' },
  { key: 'ALL', label: 'All' },
];

// Shared with styles.content.padding and styles.chartCard.padding below —
// CHART_WIDTH is derived from these, not a separate hardcoded number, so
// the two can't silently drift out of sync.
const SCREEN_PADDING = 16;
const CARD_PADDING   = 16;
const CHART_WIDTH = Dimensions.get('window').width - SCREEN_PADDING * 2 - CARD_PADDING * 2;

/** 1 decimal place, no trailing '.0' — e.g. 82.5, 100 */
function fmtKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Same rounding as fmtKg, for non-kg magnitudes (the heatmap's sets/week average). */
function fmtRate(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** 'May 19' from a 'YYYY-MM-DD' string */
function fmtShortDate(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

// ── Segmented control (shared visual style with AddExerciseScreen's unit toggle) ──
function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.segmented}>
      {options.map(o => (
        <PressableScale
          key={o.key}
          style={[styles.segBtn, value === o.key && styles.segBtnActive]}
          onPress={() => { haptics.tap(); onChange(o.key); }}
          pressScale={0.96}
        >
          <Text
            style={[styles.segBtnText, value === o.key && styles.segBtnTextActive]}
            numberOfLines={1}
          >
            {o.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

/** Raw-value list under every chart — the "can't read the chart" fallback,
 *  and the only place tied values or a to-be-added dark/light legend live. */
function TableView({ rows }: { rows: { label: string; value: string }[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.table}>
      {rows.map((r, i) => (
        <View key={i} style={[styles.tableRow, i === rows.length - 1 && styles.tableRowLast]}>
          <Text style={styles.tableLabel}>{r.label}</Text>
          <Text style={styles.tableValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Ranked horizontal bars for the muscle-group breakdown — built from plain
 *  Views rather than the charting library's horizontal bar mode, which
 *  auto-sizes its label gutter unpredictably (label truncation, bars
 *  overflowing the card). Three aligned columns (label / bar / value) keep
 *  every row centered in the space it's given regardless of label length. */
function BreakdownBars({ rows }: { rows: MuscleGroupVolume[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const maxKg = Math.max(...rows.map(r => r.volume_kg), 1);
  return (
    <View style={styles.breakdownRows}>
      {rows.map(r => (
        <View key={r.muscle_group} style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel} numberOfLines={1}>{muscleGroupLabel(r.muscle_group)}</Text>
          <View style={styles.breakdownTrack}>
            <View style={[styles.breakdownFill, { width: `${Math.max(4, (r.volume_kg / maxKg) * 100)}%` }]} />
          </View>
          <Text style={styles.breakdownValue}>{fmtKg(r.volume_kg)}</Text>
        </View>
      ))}
    </View>
  );
}

function ChartLoading() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function ExercisePickerField({ def, onPress }: { def: ExerciseDef | null; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <PressableScale style={styles.pickerField} onPress={onPress} pressScale={0.98}>
      <Feather name="activity" size={16} color={colors.textSub} />
      <Text style={styles.pickerFieldText} numberOfLines={1}>
        {def ? def.name : 'Select an exercise'}
      </Text>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

/** Small always-visible methodology note — so a color-coded tile never
 *  has to be taken on faith. Sits inline rather than behind a tooltip
 *  tap, since "how is this measured" is exactly the question a heatmap
 *  like this invites. */
function InfoNote({ children }: { children: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.infoNote}>
      <Feather name="info" size={13} color={colors.textMuted} />
      <Text style={styles.infoNoteText}>{children}</Text>
    </View>
  );
}

function ErrorFill({ message, error }: { message: string; error: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.emptyFill}>
      <EmptyState emoji="⚠️" message={message} subMessage={`${error}\n\nCheck your connection and try again.`} />
    </View>
  );
}

/** Shared fetch-on-dependency-change hook for the three tabs below.
 *  `fetcher: null` means "not ready to fetch yet" (e.g. no exercise picked)
 *  — clears any prior data instead of issuing a request. Guards against the
 *  same race every one of the three tabs would otherwise hit independently:
 *  if the deps change again before a request resolves, that stale response
 *  is dropped instead of overwriting the newer one (mirrors the `stale`
 *  flag pattern in AddExerciseScreen.tsx). */
function useAnalyticsFetch<T>(
  fetcher: (() => Promise<T>) | null,
  deps: React.DependencyList,
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(() => fetcher !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fetcher) { setData(null); setError(null); setLoading(false); return; }
    let stale = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then(result => { if (!stale) setData(result); })
      .catch((e: Error) => { if (!stale) setError(e.message || 'Something went wrong.'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

// ── 1RM trend tab ──────────────────────────────────────────────────
function OneRmTab({ range }: { range: TimeRange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [exercise, setExercise] = useState<ExerciseDef | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const { data: points, loading, error } = useAnalyticsFetch(
    exercise ? () => analyticsApi.get1RmTrend(exercise.id, sinceDateForRange(range)) : null,
    [exercise, range],
  );

  const chartData = useMemo(() => (points ?? []).map((p, i) => ({
    value: Math.round(p.e1rm_kg * 10) / 10,
    label: fmtShortDate(p.log_date),
    dataPointText: i === (points?.length ?? 0) - 1 ? fmtKg(p.e1rm_kg) : undefined,
  })), [points]);

  return (
    <View style={styles.tabBody}>
      <ExercisePickerField def={exercise} onPress={() => setPickerVisible(true)} />
      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={def => { setExercise(def); setPickerVisible(false); }}
      />

      {!exercise ? (
        <View style={styles.emptyFill}>
          <EmptyState emoji="📈" message="Pick an exercise" subMessage="See its estimated 1RM trend over time." />
        </View>
      ) : loading ? (
        <ChartLoading />
      ) : error ? (
        <ErrorFill message="Could not load 1RM data" error={error} />
      ) : !points || points.length === 0 ? (
        <View style={styles.emptyFill}>
          <EmptyState emoji="📈" message="No data in this range" subMessage="Log a set with reps > 1 to start tracking 1RM." />
        </View>
      ) : (
        <>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Estimated 1RM: {exercise.name} (kg)</Text>
            <LineChart
              data={chartData}
              width={CHART_WIDTH - 20}
              height={180}
              color={colors.primary}
              thickness={2}
              curved
              dataPointsColor={colors.primary}
              dataPointsRadius={4}
              startFillColor={colors.primary}
              startOpacity={0.12}
              endOpacity={0.02}
              areaChart
              hideRules={false}
              rulesColor={colors.divider}
              rulesType="solid"
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 11 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              yAxisColor={colors.divider}
              xAxisColor={colors.divider}
              initialSpacing={12}
              endSpacing={12}
              noOfSections={4}
              textColor1={colors.text}
              textFontSize={11}
              pointerConfig={{
                pointerColor: colors.primary,
                radius: 5,
                showPointerStrip: true,
                pointerStripColor: colors.divider,
                pointerStripWidth: 1,
                activatePointersOnLongPress: false,
                activatePointersInstantlyOnTouch: true,
                pointerLabelWidth: 100,
                pointerLabelHeight: 40,
                pointerLabelComponent: (items: { label?: string; value?: number }[]) => (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipValue}>{fmtKg(items[0]?.value ?? 0)} kg</Text>
                    <Text style={styles.tooltipLabel}>{items[0]?.label}</Text>
                  </View>
                ),
              }}
            />
          </View>
          <TableView rows={points.map(p => ({ label: fmtShortDate(p.log_date), value: `${fmtKg(p.e1rm_kg)} kg` }))} />
        </>
      )}
    </View>
  );
}

// ── Weekly volume trend tab ──────────────────────────────────────────
function VolumeTab({ range }: { range: TimeRange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState<VolumeMode>('EXERCISE');
  const [exercise, setExercise] = useState<ExerciseDef | null>(null);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const activeFilter = mode === 'EXERCISE' ? exercise : muscleGroup;

  const { data: points, loading, error } = useAnalyticsFetch(
    activeFilter
      ? () => analyticsApi.getWeeklyVolumeTrend(
          mode === 'EXERCISE' ? { exerciseDefId: exercise!.id } : { muscleGroup: muscleGroup! },
          sinceDateForRange(range),
        )
      : null,
    [mode, exercise, muscleGroup, range],
  );

  const chartData = useMemo(() => (points ?? []).map(p => ({
    value: Math.round(p.volume_kg),
    label: fmtShortDate(p.week_start),
    frontColor: colors.primary,
  })), [points, colors]);

  return (
    <View style={styles.tabBody}>
      <Segmented
        options={[{ key: 'EXERCISE', label: 'Exercise' }, { key: 'MUSCLE_GROUP', label: 'Muscle Group' }]}
        value={mode}
        onChange={m => { setMode(m); setExercise(null); setMuscleGroup(null); }}
      />

      {mode === 'EXERCISE' ? (
        <>
          <ExercisePickerField def={exercise} onPress={() => setPickerVisible(true)} />
          <ExercisePickerModal
            visible={pickerVisible}
            onClose={() => setPickerVisible(false)}
            onSelect={def => { setExercise(def); setPickerVisible(false); }}
          />
        </>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
          {MUSCLE_GROUPS.map(g => (
            <PressableScale
              key={g.key}
              style={[styles.chip, muscleGroup === g.key && styles.chipActive]}
              onPress={() => { haptics.tap(); setMuscleGroup(g.key); }}
              pressScale={0.96}
            >
              <Text style={[styles.chipText, muscleGroup === g.key && styles.chipTextActive]}>
                {g.label}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      )}

      {!activeFilter ? (
        <View style={styles.emptyFill}>
          <EmptyState
            emoji="🏋️"
            message={mode === 'EXERCISE' ? 'Pick an exercise' : 'Pick a muscle group'}
            subMessage="See total weekly training volume over time."
          />
        </View>
      ) : loading ? (
        <ChartLoading />
      ) : error ? (
        <ErrorFill message="Could not load volume data" error={error} />
      ) : !points || points.length === 0 ? (
        <View style={styles.emptyFill}>
          <EmptyState emoji="🏋️" message="No data in this range" />
        </View>
      ) : (
        <>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
              Weekly volume: {mode === 'EXERCISE' ? exercise!.name : muscleGroupLabel(muscleGroup!)} (kg)
            </Text>
            {/* barWidth/spacing: fit exactly `chartData.length` bars across the
                available width, clamped to a 12-28px range so a handful of
                weeks doesn't render absurdly fat bars and a year's worth
                doesn't shrink to slivers — the library horizontally scrolls
                past that floor rather than overlapping bars. */}
            <BarChart
              data={chartData}
              width={CHART_WIDTH - 20}
              height={180}
              barWidth={Math.min(28, Math.max(14, (CHART_WIDTH - 40) / (chartData.length * 1.6)))}
              spacing={Math.min(28, Math.max(12, (CHART_WIDTH - 40) / (chartData.length * 2.2)))}
              barBorderRadius={4}
              frontColor={colors.primary}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 11 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              yAxisColor={colors.divider}
              xAxisColor={colors.divider}
              rulesColor={colors.divider}
              rulesType="solid"
              noOfSections={4}
              isAnimated
            />
          </View>
          <TableView rows={points.map(p => ({ label: fmtShortDate(p.week_start), value: `${fmtKg(p.volume_kg)} kg` }))} />
        </>
      )}
    </View>
  );
}

// ── Muscle group breakdown tab ────────────────────────────────────────
function BreakdownTab({ range }: { range: TimeRange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: rows, loading, error } = useAnalyticsFetch(
    () => analyticsApi.getMuscleGroupBreakdown(sinceDateForRange(range)),
    [range],
  );

  // Server already orders desc by volume; drop zero-volume groups (nothing
  // trained in this window shouldn't consume a chart row).
  const data = useMemo(
    () => (rows ?? []).filter(r => r.volume_kg > 0),
    [rows],
  );

  if (loading) return <ChartLoading />;
  if (error) return <ErrorFill message="Could not load muscle group data" error={error} />;
  if (data.length === 0) {
    return (
      <View style={styles.emptyFill}>
        <EmptyState emoji="🧩" message="No data in this range" subMessage="Log some sets to see your muscle group split." />
      </View>
    );
  }

  return (
    <View style={styles.tabBody}>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Volume by muscle group (kg)</Text>
        <BreakdownBars rows={data} />
      </View>
    </View>
  );
}

// ── Muscle group heatmap tab: last 7 days vs. own 8-week baseline ────
type BucketStyle = { icon: keyof typeof Feather.glyphMap; label: string; color: string; bg: string; dashed?: boolean };

// A function of the active colorway, not a static export — `cold` and
// `primary` (the diverging over/under-trained pair) vary per colorway, and
// for colorways whose own primary is blue (Navy Electric, Cobalt Cyan) the
// colorway data picks a `cold` hue well clear of `primary` specifically so
// this pair never collides. See theme/colorways.ts.
function createBucketStyle(colors: ColorTokens): Record<BalanceBucket, BucketStyle> {
  return {
    NO_DATA:    { icon: 'circle',        label: 'No data',    color: colors.textMuted, bg: colors.card, dashed: true },
    NEW:        { icon: 'zap',           label: 'New',        color: colors.textMuted, bg: colors.card, dashed: true },
    WELL_UNDER: { icon: 'trending-down', label: 'Well under', color: colors.cold,      bg: colors.coldBg },
    UNDER:      { icon: 'trending-down', label: 'Under',      color: colors.cold,      bg: colors.coldBgMild },
    ON_TRACK:   { icon: 'check',         label: 'On track',   color: colors.textSub,  bg: colors.card },
    OVER:       { icon: 'trending-up',   label: 'Over',       color: colors.primary,  bg: colors.primaryBgMild },
    WELL_OVER:  { icon: 'trending-up',   label: 'Well over',  color: colors.primary,  bg: colors.primaryBg },
  };
}

function balanceSubtext(row: MuscleGroupBalance, read: BalanceRead): string {
  if (read.bucket === 'NO_DATA') return 'Never logged';
  if (read.bucket === 'NEW') return 'Started this week';
  if (row.recent_sets === 0) return 'Not trained this week';
  const sign = read.pctDelta! > 0 ? '+' : '';
  return `${sign}${read.pctDelta}% vs. usual`;
}

function HeatTile({ row, read }: { row: MuscleGroupBalance; read: BalanceRead }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bucketStyle = useMemo(() => createBucketStyle(colors), [colors]);
  const style = bucketStyle[read.bucket];
  return (
    <View
      style={[
        styles.heatTile,
        { backgroundColor: style.bg },
        style.dashed
          ? { borderStyle: 'dashed', borderColor: colors.border }
          : { borderColor: style.color },
      ]}
    >
      <Feather name={style.icon} size={15} color={style.color} />
      <Text style={styles.heatTileLabel} numberOfLines={1}>{muscleGroupLabel(row.muscle_group)}</Text>
      <Text style={[styles.heatTileSub, { color: style.color }]} numberOfLines={1}>
        {balanceSubtext(row, read)}
      </Text>
    </View>
  );
}

function HeatmapLegend() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bucketStyle = useMemo(() => createBucketStyle(colors), [colors]);
  // Derived from bucketStyle rather than a hand-maintained list, so the
  // legend can't drift from the tiles it's explaining.
  const items: { color: string; label: string }[] = [
    { color: bucketStyle.WELL_UNDER.color, label: 'Under-trained' },
    { color: bucketStyle.ON_TRACK.color,   label: 'On track' },
    { color: bucketStyle.WELL_OVER.color,  label: 'Over-trained' },
  ];
  return (
    <View style={styles.legendRow}>
      {items.map(it => (
        <View key={it.label} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: it.color }]} />
          <Text style={styles.legendLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function HeatmapTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bucketStyle = useMemo(() => createBucketStyle(colors), [colors]);
  const { data: rows, loading, error } = useAnalyticsFetch(
    () => analyticsApi.getMuscleGroupBalance(),
    [],
  );

  // Classified once per row per fetch, not once per row per render — reused
  // below by the tiles, the empty-state check, and the table.
  const reads = useMemo(
    () => (rows ?? []).map(row => ({ row, read: classifyBalance(row) })),
    [rows],
  );

  if (loading) return <ChartLoading />;
  if (error) return <ErrorFill message="Could not load muscle group data" error={error} />;
  if (reads.every(({ read }) => read.bucket === 'NO_DATA')) {
    return (
      <View style={styles.emptyFill}>
        <EmptyState emoji="🌡️" message="No data yet" subMessage="Log some sets to see what's over- or under-trained." />
      </View>
    );
  }

  return (
    <View style={styles.tabBody}>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Last 7 days' sets vs. your usual (8-week average)</Text>
        <InfoNote>
          Counts hard sets, not kg. A bodyweight pull-up counts the same as a loaded
          row. Each muscle group compares its own last 7 days of sets to its own
          trailing 8-week average, never to other muscle groups. New accounts are
          averaged over however many weeks they've actually trained.
        </InfoNote>
        <View style={styles.heatGrid}>
          {reads.map(({ row, read }) => <HeatTile key={row.muscle_group} row={row} read={read} />)}
        </View>
        <HeatmapLegend />
      </View>
      <TableView
        rows={reads.map(({ row, read }) => ({
          label: muscleGroupLabel(row.muscle_group),
          value: `${row.recent_sets} / ${fmtRate(row.baseline_weekly_avg_sets)} sets/wk (${bucketStyle[read.bucket].label})`,
        }))}
      />
    </View>
  );
}

export function ProgressScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('1RM');
  const [range, setRange] = useState<TimeRange>('3M');
  const showRange = TABS.find(t => t.key === tab)?.usesRange !== false;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.selectorGroup}>
          <Segmented options={TABS} value={tab} onChange={setTab} />
          {showRange && <Segmented options={TIME_RANGES} value={range} onChange={setRange} />}
        </View>

        {tab === '1RM' && <OneRmTab range={range} />}
        {tab === 'VOLUME' && <VolumeTab range={range} />}
        {tab === 'BREAKDOWN' && <BreakdownTab range={range} />}
        {tab === 'HEATMAP' && <HeatmapTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    padding:  SCREEN_PADDING,
    gap:      20,
  },
  selectorGroup: {
    gap: 14,
  },
  tabBody: {
    flex: 1,
    gap:  16,
  },
  emptyFill: {
    flex:           1,
    justifyContent: 'center',
    minHeight:      280,
  },
  segmented: {
    flexDirection:   'row',
    backgroundColor: colors.card,
    borderRadius:    RADIUS.md,
    borderWidth:      1,
    borderColor:      colors.border,
    padding:          4,
  },
  segBtn: {
    flex:              1,
    paddingVertical:   10,
    alignItems:        'center',
    borderRadius:      RADIUS.sm,
  },
  segBtnActive: {
    backgroundColor: colors.primary,
  },
  segBtnText: {
    fontFamily: FONT.semibold,
    fontSize:   13,
    color:      colors.textMuted,
  },
  segBtnTextActive: {
    color: '#FFFFFF',
  },
  pickerField: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
  },
  pickerFieldText: {
    flex:     1,
    fontSize: 15,
    color:    colors.text,
  },
  chipRow: {
    flexGrow: 0,
  },
  chipRowContent: {
    paddingRight: 4,
    gap:          8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderRadius:      RADIUS.pill,
    backgroundColor:   colors.card,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
  },
  chipActive: {
    backgroundColor: colors.primaryBg,
    borderColor:      colors.primary,
  },
  chipText: {
    fontSize: 13,
    color:    colors.textSub,
  },
  chipTextActive: {
    color:      colors.primary,
    fontFamily: FONT.semibold,
  },
  chartCard: {
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.lg,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
    padding:            CARD_PADDING,
  },
  chartTitle: {
    fontFamily:   FONT.semibold,
    fontSize:     13,
    color:        colors.textSub,
    marginBottom: 12,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
    marginBottom:  16,
  },
  infoNoteText: {
    flex:       1,
    fontSize:   12,
    lineHeight: 17,
    color:      colors.textMuted,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems:      'center',
  },
  tooltip: {
    backgroundColor: colors.bgAlt,
    borderRadius:    RADIUS.sm,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical:   6,
  },
  tooltipValue: {
    fontFamily: FONT.semibold,
    fontSize:   13,
    color:      colors.text,
  },
  tooltipLabel: {
    fontSize: 10,
    color:    colors.textMuted,
    marginTop: 1,
  },
  breakdownRows: {
    gap: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  breakdownLabel: {
    width:    76,
    fontSize: 12,
    color:    colors.textSub,
  },
  breakdownTrack: {
    flex:   1,
    height: 20,
  },
  breakdownFill: {
    height:          20,
    minWidth:        4,
    borderRadius:    4,
    backgroundColor: colors.primary,
  },
  breakdownValue: {
    width:      66,
    textAlign:  'right',
    fontSize:   12,
    fontFamily: FONT.medium,
    color:      colors.text,
  },
  heatGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
  },
  heatTile: {
    width:             '30%',
    minHeight:         76,
    borderRadius:      RADIUS.md,
    borderWidth:        1,
    paddingHorizontal: 8,
    paddingVertical:   10,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               4,
  },
  heatTileLabel: {
    fontFamily: FONT.semibold,
    fontSize:   11,
    color:      colors.text,
    textAlign:  'center',
  },
  heatTileSub: {
    fontSize:  10,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
    marginTop:     14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  legendSwatch: {
    width:        10,
    height:       10,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 11,
    color:    colors.textMuted,
  },
  table: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    overflow:        'hidden',
  },
  tableRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth:  1,
    borderBottomColor:  colors.divider,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableLabel: {
    fontSize: 13,
    color:    colors.textSub,
  },
  tableValue: {
    fontSize:   13,
    fontFamily: FONT.medium,
    color:      colors.text,
  },
});
