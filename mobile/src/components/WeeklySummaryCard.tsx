import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { DayInfo } from '../types';
import { formatDistance, formatDuration } from '../utils/cardioFormat';

interface Props {
  days: DayInfo[];
}

/** "This Week" — total strength exercises, total cardio (with a duration/
 *  distance subtext), and how many of the 7 days had anything logged. */
export function WeeklySummaryCard({ days }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const totalExercises = days.reduce((sum, d) => sum + d.exercises.length, 0);
  const cardioSessions  = days.flatMap(d => d.cardioSessions);
  const totalCardioSeconds  = cardioSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const totalCardioDistance = cardioSessions.reduce((sum, s) => sum + (s.distance_meters ?? 0), 0);
  const activeDays = days.filter(d => d.exercises.length > 0 || d.cardioSessions.length > 0).length;

  const cardioSubtext = cardioSessions.length > 0
    ? [formatDuration(totalCardioSeconds), totalCardioDistance > 0 ? formatDistance(totalCardioDistance) : null]
        .filter(Boolean)
        .join(' · ')
    : 'None yet';

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>This Week</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{totalExercises}</Text>
          <Text style={styles.statLabel}>{totalExercises === 1 ? 'Exercise' : 'Exercises'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{cardioSessions.length}</Text>
          <Text style={styles.statLabel}>{cardioSessions.length === 1 ? 'Cardio' : 'Cardio'}</Text>
          <Text style={styles.statSub} numberOfLines={1}>{cardioSubtext}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{activeDays}<Text style={styles.statNumberOf}>/7</Text></Text>
          <Text style={styles.statLabel}>Active Days</Text>
        </View>
      </View>
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
    marginBottom:  14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  stat: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  divider: {
    width:            1,
    alignSelf:        'stretch',
    backgroundColor:  colors.divider,
    marginHorizontal: 4,
  },
  statNumber: {
    fontFamily: FONT.bold,
    fontSize:   26,
    color:      colors.text,
  },
  statNumberOf: {
    fontFamily: FONT.semibold,
    fontSize:   15,
    color:      colors.textMuted,
  },
  statLabel: {
    fontFamily: FONT.medium,
    fontSize:   12,
    color:      colors.textSub,
  },
  statSub: {
    fontSize:  11,
    color:     colors.textMuted,
    marginTop: 2,
  },
});
