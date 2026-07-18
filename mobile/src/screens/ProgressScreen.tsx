import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-gifted-charts';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { muscleGroupLabel, MUSCLE_GROUPS } from '../constants/muscleGroups';
import { sinceDateForRange, parseDateStr } from '../utils/dateUtils';
import {
  ExerciseDef, MuscleGroup, MuscleGroupVolume, OneRmTrendPoint, TimeRange, WeeklyVolumePoint,
} from '../types';
import { analyticsApi } from '../services/api';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { PressableScale } from '../components/PressableScale';
import { EmptyState } from '../components/EmptyState';
import { haptics } from '../utils/haptics';

type Tab = '1RM' | 'VOLUME' | 'BREAKDOWN';
type VolumeMode = 'EXERCISE' | 'MUSCLE_GROUP';

const TABS: { key: Tab; label: string }[] = [
  { key: '1RM',       label: '1RM' },
  { key: 'VOLUME',    label: 'Volume' },
  { key: 'BREAKDOWN', label: 'Muscle Groups' },
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
  return (
    <View style={styles.segmented}>
      {options.map(o => (
        <PressableScale
          key={o.key}
          style={[styles.segBtn, value === o.key && styles.segBtnActive]}
          onPress={() => { haptics.tap(); onChange(o.key); }}
          pressScale={0.96}
        >
          <Text style={[styles.segBtnText, value === o.key && styles.segBtnTextActive]}>
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
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
}

function ExercisePickerField({ def, onPress }: { def: ExerciseDef | null; onPress: () => void }) {
  return (
    <PressableScale style={styles.pickerField} onPress={onPress} pressScale={0.98}>
      <Feather name="activity" size={16} color={COLORS.textSub} />
      <Text style={styles.pickerFieldText} numberOfLines={1}>
        {def ? def.name : 'Select an exercise'}
      </Text>
      <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
    </PressableScale>
  );
}

function ErrorFill({ message, error }: { message: string; error: string }) {
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
            <Text style={styles.chartTitle}>Estimated 1RM — {exercise.name} (kg)</Text>
            <LineChart
              data={chartData}
              width={CHART_WIDTH - 20}
              height={180}
              color={COLORS.primary}
              thickness={2}
              curved
              dataPointsColor={COLORS.primary}
              dataPointsRadius={4}
              startFillColor={COLORS.primary}
              startOpacity={0.12}
              endOpacity={0.02}
              areaChart
              hideRules={false}
              rulesColor={COLORS.divider}
              rulesType="solid"
              yAxisTextStyle={{ color: COLORS.textMuted, fontSize: 11 }}
              xAxisLabelTextStyle={{ color: COLORS.textMuted, fontSize: 10 }}
              yAxisColor={COLORS.divider}
              xAxisColor={COLORS.divider}
              initialSpacing={12}
              endSpacing={12}
              noOfSections={4}
              textColor1={COLORS.text}
              textFontSize={11}
              pointerConfig={{
                pointerColor: COLORS.primary,
                radius: 5,
                showPointerStrip: true,
                pointerStripColor: COLORS.divider,
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
    frontColor: COLORS.primary,
  })), [points]);

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
              Weekly volume — {mode === 'EXERCISE' ? exercise!.name : muscleGroupLabel(muscleGroup!)} (kg)
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
              frontColor={COLORS.primary}
              yAxisTextStyle={{ color: COLORS.textMuted, fontSize: 11 }}
              xAxisLabelTextStyle={{ color: COLORS.textMuted, fontSize: 10 }}
              yAxisColor={COLORS.divider}
              xAxisColor={COLORS.divider}
              rulesColor={COLORS.divider}
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

export function ProgressScreen() {
  const [tab, setTab] = useState<Tab>('1RM');
  const [range, setRange] = useState<TimeRange>('3M');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.selectorGroup}>
          <Segmented options={TABS} value={tab} onChange={setTab} />
          <Segmented options={TIME_RANGES} value={range} onChange={setRange} />
        </View>

        {tab === '1RM' && <OneRmTab range={range} />}
        {tab === 'VOLUME' && <VolumeTab range={range} />}
        {tab === 'BREAKDOWN' && <BreakdownTab range={range} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
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
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.md,
    borderWidth:      1,
    borderColor:      COLORS.border,
    padding:          4,
  },
  segBtn: {
    flex:              1,
    paddingVertical:   10,
    alignItems:        'center',
    borderRadius:      RADIUS.sm,
  },
  segBtnActive: {
    backgroundColor: COLORS.primary,
  },
  segBtnText: {
    fontFamily: FONT.semibold,
    fontSize:   13,
    color:      COLORS.textMuted,
  },
  segBtnTextActive: {
    color: '#FFFFFF',
  },
  pickerField: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderWidth:        1,
    borderColor:        COLORS.cardBorder,
  },
  pickerFieldText: {
    flex:     1,
    fontSize: 15,
    color:    COLORS.text,
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
    backgroundColor:   COLORS.card,
    borderWidth:        1,
    borderColor:        COLORS.cardBorder,
  },
  chipActive: {
    backgroundColor: COLORS.primaryBg,
    borderColor:      COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    color:    COLORS.textSub,
  },
  chipTextActive: {
    color:      COLORS.primary,
    fontFamily: FONT.semibold,
  },
  chartCard: {
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.lg,
    borderWidth:        1,
    borderColor:        COLORS.cardBorder,
    padding:            CARD_PADDING,
  },
  chartTitle: {
    fontFamily:   FONT.semibold,
    fontSize:     13,
    color:        COLORS.textSub,
    marginBottom: 12,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems:      'center',
  },
  tooltip: {
    backgroundColor: COLORS.bgAlt,
    borderRadius:    RADIUS.sm,
    borderWidth:      1,
    borderColor:      COLORS.cardBorder,
    paddingHorizontal: 10,
    paddingVertical:   6,
  },
  tooltipValue: {
    fontFamily: FONT.semibold,
    fontSize:   13,
    color:      COLORS.text,
  },
  tooltipLabel: {
    fontSize: 10,
    color:    COLORS.textMuted,
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
    color:    COLORS.textSub,
  },
  breakdownTrack: {
    flex:   1,
    height: 20,
  },
  breakdownFill: {
    height:          20,
    minWidth:        4,
    borderRadius:    4,
    backgroundColor: COLORS.primary,
  },
  breakdownValue: {
    width:      66,
    textAlign:  'right',
    fontSize:   12,
    fontFamily: FONT.medium,
    color:      COLORS.text,
  },
  table: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      COLORS.cardBorder,
    overflow:        'hidden',
  },
  tableRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth:  1,
    borderBottomColor:  COLORS.divider,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableLabel: {
    fontSize: 13,
    color:    COLORS.textSub,
  },
  tableValue: {
    fontSize:   13,
    fontFamily: FONT.medium,
    color:      COLORS.text,
  },
});
