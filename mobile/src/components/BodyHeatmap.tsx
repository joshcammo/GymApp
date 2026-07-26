import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Rect, Circle, Ellipse } from 'react-native-svg';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { MuscleGroup, MuscleGroupBalance } from '../types';
import { analyticsApi } from '../services/api';
import { BalanceBucket, classifyBalance, createBucketStyle } from '../utils/muscleBalance';
import { haptics } from '../utils/haptics';

interface Props {
  /** Tapping a colored region jumps straight to logging an exercise for
   *  that muscle group (same handoff as the Today's Focus card). */
  onSelectMuscleGroup?: (muscleGroup: MuscleGroup) => void;
}

/** One region of the simplified body outline. `group` is null for
 *  decorative parts (head, neck, hips, feet) that aren't a trainable
 *  muscle group and are always drawn in a neutral color. */
interface Region {
  group: MuscleGroup | null;
  x: number; y: number; width: number; height: number; rx: number;
}

// Shared skeleton — front and back use the same limb positions so the two
// figures read as the same body from two sides, not two different bodies.
// Simplified/blocky by design: the app only tracks 11 broad muscle groups,
// not fine anatomical subdivisions, so a literal anatomical illustration
// would imply more precision than the underlying data has.
const SHOULDER_L: Omit<Region, 'group'> = { x: 14, y: 30, width: 22, height: 16, rx: 8 };
const SHOULDER_R: Omit<Region, 'group'> = { x: 64, y: 30, width: 22, height: 16, rx: 8 };
const UPPER_ARM_L: Omit<Region, 'group'> = { x: 10, y: 46, width: 16, height: 38, rx: 8 };
const UPPER_ARM_R: Omit<Region, 'group'> = { x: 74, y: 46, width: 16, height: 38, rx: 8 };
const FOREARM_L: Omit<Region, 'group'> = { x: 8, y: 84, width: 15, height: 36, rx: 7 };
const FOREARM_R: Omit<Region, 'group'> = { x: 77, y: 84, width: 15, height: 36, rx: 7 };
const UPPER_LEG_L: Omit<Region, 'group'> = { x: 30, y: 122, width: 18, height: 42, rx: 9 };
const UPPER_LEG_R: Omit<Region, 'group'> = { x: 52, y: 122, width: 18, height: 42, rx: 9 };
const LOWER_LEG_L: Omit<Region, 'group'> = { x: 31, y: 164, width: 16, height: 42, rx: 8 };
const LOWER_LEG_R: Omit<Region, 'group'> = { x: 53, y: 164, width: 16, height: 42, rx: 8 };

const FRONT_REGIONS: Region[] = [
  { group: 'SHOULDERS',  ...SHOULDER_L },
  { group: 'SHOULDERS',  ...SHOULDER_R },
  { group: 'CHEST',      x: 34, y: 32, width: 32, height: 34, rx: 8 },
  { group: 'BICEPS',     ...UPPER_ARM_L },
  { group: 'BICEPS',     ...UPPER_ARM_R },
  { group: 'FOREARMS',   ...FOREARM_L },
  { group: 'FOREARMS',   ...FOREARM_R },
  { group: 'CORE',       x: 36, y: 66, width: 28, height: 36, rx: 8 },
  { group: null,         x: 32, y: 100, width: 36, height: 14, rx: 6 }, // hips (front — no glute-specific region)
  { group: 'QUADS',      ...UPPER_LEG_L, y: 114, height: 50 },
  { group: 'QUADS',      ...UPPER_LEG_R, y: 114, height: 50 },
  { group: 'CALVES',     ...LOWER_LEG_L },
  { group: 'CALVES',     ...LOWER_LEG_R },
];

const BACK_REGIONS: Region[] = [
  { group: 'SHOULDERS',  ...SHOULDER_L },
  { group: 'SHOULDERS',  ...SHOULDER_R },
  { group: 'BACK',       x: 34, y: 32, width: 32, height: 68, rx: 8 },
  { group: 'TRICEPS',    ...UPPER_ARM_L },
  { group: 'TRICEPS',    ...UPPER_ARM_R },
  { group: 'FOREARMS',   ...FOREARM_L },
  { group: 'FOREARMS',   ...FOREARM_R },
  { group: 'GLUTES',     x: 32, y: 100, width: 36, height: 22, rx: 10 },
  { group: 'HAMSTRINGS', ...UPPER_LEG_L },
  { group: 'HAMSTRINGS', ...UPPER_LEG_R },
  { group: 'CALVES',     ...LOWER_LEG_L },
  { group: 'CALVES',     ...LOWER_LEG_R },
];

function Figure({
  regions, bucketOf, styleOf, onSelectMuscleGroup, neutralFill, neutralStroke,
}: {
  regions: Region[];
  bucketOf: (g: MuscleGroup) => BalanceBucket;
  styleOf: ReturnType<typeof createBucketStyle>;
  onSelectMuscleGroup?: (g: MuscleGroup) => void;
  neutralFill: string;
  neutralStroke: string;
}) {
  return (
    <Svg viewBox="0 0 100 220" width="100%" height={190}>
      {/* Head + neck — decorative, not a trainable region */}
      <Circle cx={50} cy={14} r={12} fill={neutralFill} stroke={neutralStroke} strokeWidth={1} />
      <Rect x={44} y={24} width={12} height={8} fill={neutralFill} stroke={neutralStroke} strokeWidth={1} />

      {regions.map((r, i) => {
        if (!r.group) {
          return (
            <Rect
              key={i}
              x={r.x} y={r.y} width={r.width} height={r.height} rx={r.rx}
              fill={neutralFill} stroke={neutralStroke} strokeWidth={1}
            />
          );
        }
        const bucket = bucketOf(r.group);
        const style = styleOf[bucket];
        return (
          <Rect
            key={i}
            x={r.x} y={r.y} width={r.width} height={r.height} rx={r.rx}
            fill={style.dashed ? neutralFill : style.color}
            stroke={style.color}
            strokeWidth={style.dashed ? 1 : 0.5}
            strokeDasharray={style.dashed ? '3,2' : undefined}
            onPress={onSelectMuscleGroup ? () => { haptics.tap(); onSelectMuscleGroup(r.group!); } : undefined}
          />
        );
      })}

      {/* Feet — decorative */}
      <Ellipse cx={39} cy={214} rx={9} ry={5} fill={neutralFill} stroke={neutralStroke} strokeWidth={1} />
      <Ellipse cx={61} cy={214} rx={9} ry={5} fill={neutralFill} stroke={neutralStroke} strokeWidth={1} />
    </Svg>
  );
}

/** Front + back muscle-group heatmap — the same under/on-track/over-trained
 *  read as the Progress screen's tile heatmap, laid out on a simplified
 *  body instead of a grid, so it's easier to see at a glance what's been
 *  neglected. Self-fetches its own data (best-effort, like the other
 *  dashboard cards) rather than sharing a fetch with Today's Focus. */
export function BodyHeatmap({ onSelectMuscleGroup }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bucketStyle = useMemo(() => createBucketStyle(colors), [colors]);
  const [rows, setRows] = useState<MuscleGroupBalance[] | null | 'error'>(null);

  useEffect(() => {
    let stale = false;
    analyticsApi.getMuscleGroupBalance()
      .then(data => { if (!stale) setRows(data); })
      .catch(() => { if (!stale) setRows('error'); });
    return () => { stale = true; };
  }, []);

  if (rows === 'error') return null;

  const bucketOf = (group: MuscleGroup): BalanceBucket => {
    if (rows === null) return 'NO_DATA';
    const row = rows.find(r => r.muscle_group === group);
    return row ? classifyBalance(row).bucket : 'NO_DATA';
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Muscle Heatmap</Text>
      <Text style={styles.caption}>
        Last 7 days vs. your usual — same read as the Progress screen. Tap a region to log it.
      </Text>

      {rows === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <>
          <View style={styles.figures}>
            <View style={styles.figureCol}>
              <Figure
                regions={FRONT_REGIONS}
                bucketOf={bucketOf}
                styleOf={bucketStyle}
                onSelectMuscleGroup={onSelectMuscleGroup}
                neutralFill={colors.card}
                neutralStroke={colors.border}
              />
              <Text style={styles.figureLabel}>Front</Text>
            </View>
            <View style={styles.figureCol}>
              <Figure
                regions={BACK_REGIONS}
                bucketOf={bucketOf}
                styleOf={bucketStyle}
                onSelectMuscleGroup={onSelectMuscleGroup}
                neutralFill={colors.card}
                neutralStroke={colors.border}
              />
              <Text style={styles.figureLabel}>Back</Text>
            </View>
          </View>

          <View style={styles.legendRow}>
            {(['WELL_UNDER', 'ON_TRACK', 'WELL_OVER'] as BalanceBucket[]).map(bucket => (
              <View key={bucket} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: bucketStyle[bucket].color }]} />
                <Text style={styles.legendLabel}>
                  {bucket === 'WELL_UNDER' ? 'Under-trained' : bucket === 'WELL_OVER' ? 'Over-trained' : 'On track'}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  card: {
    backgroundColor: colors.bgAlt,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    padding:         16,
    marginBottom:    12,
  },
  heading: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         colors.textSub,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  6,
  },
  caption: {
    fontSize:     12,
    color:        colors.textMuted,
    lineHeight:   17,
    marginBottom: 10,
  },
  loading: {
    marginVertical: 20,
  },
  figures: {
    flexDirection: 'row',
  },
  figureCol: {
    flex:       1,
    alignItems: 'center',
  },
  figureLabel: {
    fontFamily: FONT.medium,
    fontSize:   11,
    color:      colors.textMuted,
    marginTop:  2,
  },
  legendRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            16,
    marginTop:      12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  legendSwatch: {
    width:        9,
    height:       9,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 11,
    color:    colors.textSub,
  },
});
