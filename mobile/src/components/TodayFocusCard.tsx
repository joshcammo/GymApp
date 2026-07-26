import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { muscleGroupLabel } from '../constants/muscleGroups';
import { MuscleGroup, MuscleGroupBalance } from '../types';
import { analyticsApi } from '../services/api';
import { classifyBalance } from '../utils/muscleBalance';
import { GradientButton } from './GradientButton';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  onAddExercise: (muscleGroup?: MuscleGroup) => void;
  onGenerateAi:  (prompt: string) => void;
}

type Recommendation =
  | { kind: 'focus'; muscleGroupKey: MuscleGroup; muscleGroupLabel: string; pctDelta: number }
  | { kind: 'ease';  muscleGroupLabel: string; pctDelta: number }
  | { kind: 'balanced' }
  | { kind: 'no_data' };

/** Ranks groups by the same thresholds as the Progress screen's heatmap and
 *  recommends the most under-trained one.
 *
 *  Over-training is checked *before* falling through to "balanced". Without
 *  that, a week where several groups are well above their usual reported
 *  "you're on track across every muscle group", directly contradicting the
 *  body heatmap rendered underneath this card. "Balanced" now means what it
 *  says: nothing meaningfully under OR over. */
function pickRecommendation(rows: MuscleGroupBalance[]): Recommendation {
  const reads = rows.map(row => ({ row, read: classifyBalance(row) }));

  if (reads.every(({ read }) => read.bucket === 'NO_DATA' || read.bucket === 'NEW')) {
    return { kind: 'no_data' };
  }

  const underTrained = reads
    .filter(({ read }) => read.bucket === 'WELL_UNDER' || read.bucket === 'UNDER')
    .sort((a, b) => a.read.pctDelta! - b.read.pctDelta!);

  if (underTrained.length > 0) {
    const top = underTrained[0];
    return {
      kind: 'focus',
      muscleGroupKey:   top.row.muscle_group,
      muscleGroupLabel: muscleGroupLabel(top.row.muscle_group),
      pctDelta:         top.read.pctDelta!,
    };
  }

  const overTrained = reads
    .filter(({ read }) => read.bucket === 'WELL_OVER' || read.bucket === 'OVER')
    .sort((a, b) => b.read.pctDelta! - a.read.pctDelta!);

  if (overTrained.length > 0) {
    const top = overTrained[0];
    return {
      kind: 'ease',
      muscleGroupLabel: muscleGroupLabel(top.row.muscle_group),
      pctDelta:         top.read.pctDelta!,
    };
  }

  return { kind: 'balanced' };
}

export function TodayFocusCard({ onAddExercise, onGenerateAi }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [recommendation, setRecommendation] = useState<Recommendation | null | 'error'>(null);

  useEffect(() => {
    let stale = false;
    analyticsApi.getMuscleGroupBalance()
      .then(rows => { if (!stale) setRecommendation(pickRecommendation(rows)); })
      .catch(() => { if (!stale) setRecommendation('error'); });
    return () => { stale = true; };
  }, []);

  // Best-effort: a failed fetch just means no card, not a broken dashboard.
  if (recommendation === 'error') return null;

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <Feather name="target" size={13} color={colors.primary} />
        <Text style={styles.heading}>Today's Focus</Text>
      </View>

      {recommendation === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <>
          <Text style={styles.message}>
            {recommendation.kind === 'focus'
              ? `${recommendation.muscleGroupLabel} looks under-trained this week (${recommendation.pctDelta}% vs. usual). A good place to focus today.`
              : recommendation.kind === 'ease'
                ? `You're ahead of your usual everywhere, ${recommendation.muscleGroupLabel} most of all (+${recommendation.pctDelta}%). Nothing's lagging, so today's a good day to go easy or train something light.`
                : recommendation.kind === 'balanced'
                  ? "You're on track across every muscle group this week. Nice work. Pick whatever you feel like today."
                  : 'Log a few workouts to unlock a personalized recommendation here.'}
          </Text>

          {recommendation.kind !== 'no_data' && (
            <View style={styles.actions}>
              <PressableScale
                style={styles.secondaryBtn}
                onPress={() => {
                  haptics.tap();
                  onAddExercise(recommendation.kind === 'focus' ? recommendation.muscleGroupKey : undefined);
                }}
              >
                <Feather name="plus" size={14} color={colors.primary} />
                <Text style={styles.secondaryBtnText}>Add Exercise</Text>
              </PressableScale>
              <GradientButton
                title="Generate with AI"
                icon="zap"
                style={styles.aiBtn}
                onPress={() => onGenerateAi(
                  recommendation.kind === 'focus'
                    ? `Focus on ${recommendation.muscleGroupLabel.toLowerCase()}`
                    : 'Based on what I trained last week'
                )}
              />
            </View>
          )}
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
  headingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  10,
  },
  heading: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         colors.textSub,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loading: {
    marginVertical: 10,
  },
  message: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     14,
  },
  secondaryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    paddingHorizontal: 14,
    paddingVertical:   14,
    borderRadius:      RADIUS.md,
    borderWidth:        1,
    borderColor:        colors.border,
    backgroundColor:   colors.card,
  },
  secondaryBtnText: {
    fontFamily: FONT.bold,
    fontSize:   14,
    color:      colors.primary,
  },
  aiBtn: {
    flex: 1,
  },
});
