import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { WeightUnit } from '../types';
import { calculateWarmupSets } from '../utils/warmup';

interface Props {
  /** Heaviest set from the most recent session, in `workingUnit`. */
  workingWeight: number;
  workingUnit:   WeightUnit;
  /** Unit the sets are being logged in right now. Suggestions are shown in this unit. */
  targetUnit:    WeightUnit;
}

/** Suggested warm-up ramp (40/60/80% of last session's working weight),
 *  shown above the set editor once an exercise with prior history is
 *  picked. Purely informational: renders nothing when there's no
 *  sensible ramp to suggest (see calculateWarmupSets). */
export function WarmupSuggestion({ workingWeight, workingUnit, targetUnit }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sets = useMemo(
    () => calculateWarmupSets(workingWeight, workingUnit, targetUnit),
    [workingWeight, workingUnit, targetUnit]
  );

  if (sets.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="trending-up" size={14} color={colors.primary} />
        <Text style={styles.headerText}>Suggested Warm-up</Text>
      </View>

      {sets.map((s, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.percent}>{Math.round(s.percent * 100)}%</Text>
          <Text style={styles.value}>
            {s.weight} {targetUnit} <Text style={styles.reps}>× {s.reps}</Text>
          </Text>
        </View>
      ))}

      <Text style={styles.footnote}>
        Based on your last working set. Ramp up before your first working set below.
      </Text>
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
    marginBottom:    14,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  10,
  },
  headerText: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         colors.textSub,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingVertical: 5,
  },
  percent: {
    fontFamily: FONT.bold,
    fontSize:   12,
    color:      colors.primary,
    width:      34,
  },
  value: {
    fontFamily: FONT.semibold,
    fontSize:   14,
    color:      colors.text,
  },
  reps: {
    fontFamily: FONT.medium,
    color:      colors.textMuted,
  },
  footnote: {
    fontFamily: FONT.medium,
    fontSize:   11,
    color:      colors.textMuted,
    marginTop:  8,
  },
});
