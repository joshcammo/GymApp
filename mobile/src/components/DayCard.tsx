import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { DayInfo } from '../types';
import { PressableScale } from './PressableScale';

interface Props {
  day:     DayInfo;
  onPress: () => void;
}

export function DayCard({ day, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasExercises = day.exercises.length > 0;
  const previewNames = hasExercises
    ? day.exercises
        .slice(0, 2)
        .map(e => e.name)
        .join('  ·  ') + (day.exercises.length > 2 ? `  +${day.exercises.length - 2}` : '')
    : '';

  return (
    <PressableScale
      style={[styles.card, day.isToday && styles.cardToday]}
      onPress={onPress}
    >
      {/* Left: date block */}
      <View style={[styles.dayCol, day.isToday && styles.dayColToday]}>
        <Text style={[styles.dayShort, day.isToday && styles.dayShortToday]}>
          {day.dayShort}
        </Text>
        <Text style={[styles.dateNum, day.isToday && styles.dateNumToday]}>
          {day.dayOfMonth}
        </Text>
      </View>

      {/* Middle: exercise summary */}
      <View style={styles.summaryCol}>
        {hasExercises ? (
          <>
            <View style={styles.countRow}>
              <View style={styles.countBubble}>
                <Text style={styles.countText}>{day.exercises.length}</Text>
              </View>
              <Text style={styles.exerciseWord}>
                {day.exercises.length === 1 ? 'exercise' : 'exercises'}
              </Text>
            </View>
            <Text style={styles.preview} numberOfLines={1}>{previewNames}</Text>
          </>
        ) : (
          <Text style={styles.emptyLabel}>
            {day.isToday ? 'Tap to log today’s workout' : day.isPast ? 'Rest day' : 'Upcoming'}
          </Text>
        )}
      </View>

      {/* Right: chevron */}
      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </PressableScale>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.lg,
    paddingVertical:   12,
    paddingHorizontal: 14,
    marginBottom:      10,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
  },
  cardToday: {
    borderColor:     colors.primary,
    backgroundColor: colors.cardRaised,
    shadowColor:     colors.primary,
    shadowOpacity:   0.25,
    shadowRadius:    12,
    shadowOffset:    { width: 0, height: 4 },
    elevation:        5,
  },
  dayCol: {
    width:           52,
    height:          52,
    borderRadius:    RADIUS.md,
    backgroundColor: colors.bgAlt,
    borderWidth:      1,
    borderColor:      colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     14,
  },
  dayColToday: {
    backgroundColor: colors.primaryBg,
    borderColor:     colors.primary,
  },
  dayShort: {
    fontFamily:    FONT.semibold,
    fontSize:      10,
    color:         colors.textMuted,
    letterSpacing: 1.2,
  },
  dayShortToday: {
    color: colors.primary,
  },
  dateNum: {
    fontFamily: FONT.bold,
    fontSize:   18,
    color:      colors.textSub,
    marginTop:  1,
  },
  dateNumToday: {
    color: colors.text,
  },
  summaryCol: {
    flex: 1,
  },
  countRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  countBubble: {
    backgroundColor: colors.primaryBg,
    borderRadius:    RADIUS.sm,
    minWidth:        26,
    height:          26,
    paddingHorizontal: 6,
    justifyContent:  'center',
    alignItems:      'center',
  },
  countText: {
    fontFamily: FONT.bold,
    fontSize:   13,
    color:      colors.primary,
  },
  exerciseWord: {
    fontFamily: FONT.medium,
    fontSize:   15,
    color:      colors.text,
  },
  preview: {
    fontSize:  12,
    color:     colors.textMuted,
    marginTop:  5,
  },
  emptyLabel: {
    fontSize: 14,
    color:    colors.textMuted,
  },
});
