import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { DayInfo } from '../types';
import { PressableScale } from './PressableScale';

interface Props {
  day:     DayInfo;
  onPress: () => void;
}

export function DayCard({ day, onPress }: Props) {
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
      {/* Left — date block */}
      <View style={[styles.dayCol, day.isToday && styles.dayColToday]}>
        <Text style={[styles.dayShort, day.isToday && styles.dayShortToday]}>
          {day.dayShort}
        </Text>
        <Text style={[styles.dateNum, day.isToday && styles.dateNumToday]}>
          {day.dayOfMonth}
        </Text>
      </View>

      {/* Middle — exercise summary */}
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
            {day.isToday ? 'Tap to log today’s workout' : day.isPast ? 'Rest day' : '—'}
          </Text>
        )}
      </View>

      {/* Right — chevron */}
      <Feather name="chevron-right" size={20} color={COLORS.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.lg,
    paddingVertical:   12,
    paddingHorizontal: 14,
    marginBottom:      10,
    borderWidth:        1,
    borderColor:        COLORS.cardBorder,
  },
  cardToday: {
    borderColor:     COLORS.primary,
    backgroundColor: COLORS.cardRaised,
    shadowColor:     COLORS.primary,
    shadowOpacity:   0.25,
    shadowRadius:    12,
    shadowOffset:    { width: 0, height: 4 },
    elevation:        5,
  },
  dayCol: {
    width:           52,
    height:          52,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.bgAlt,
    borderWidth:      1,
    borderColor:      COLORS.border,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     14,
  },
  dayColToday: {
    backgroundColor: COLORS.primaryBg,
    borderColor:     COLORS.primary,
  },
  dayShort: {
    fontFamily:    FONT.semibold,
    fontSize:      10,
    color:         COLORS.textMuted,
    letterSpacing: 1.2,
  },
  dayShortToday: {
    color: COLORS.primary,
  },
  dateNum: {
    fontFamily: FONT.bold,
    fontSize:   18,
    color:      COLORS.textSub,
    marginTop:  1,
  },
  dateNumToday: {
    color: COLORS.text,
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
    backgroundColor: COLORS.primaryBg,
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
    color:      COLORS.primary,
  },
  exerciseWord: {
    fontFamily: FONT.medium,
    fontSize:   15,
    color:      COLORS.text,
  },
  preview: {
    fontSize:  12,
    color:     COLORS.textMuted,
    marginTop:  5,
  },
  emptyLabel: {
    fontSize: 14,
    color:    COLORS.textMuted,
  },
});
