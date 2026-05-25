import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { DayInfo } from '../types';

interface Props {
  day:     DayInfo;
  onPress: () => void;
}

export function DayCard({ day, onPress }: Props) {
  const hasExercises = day.exercises.length > 0;
  const previewNames = day.exercises
    .slice(0, 2)
    .map(e => e.name)
    .join(' · ') + (day.exercises.length > 2 ? ` +${day.exercises.length - 2}` : '');

  return (
    <TouchableOpacity
      style={[
        styles.card,
        day.isToday  && styles.cardToday,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left — day label */}
      <View style={styles.dayCol}>
        <Text style={[styles.dayShort, day.isToday && styles.dayShortToday]}>
          {day.dayShort}
        </Text>
        <Text style={[styles.dateNum, day.isToday && styles.dateNumToday]}>
          {day.displayDate}
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
            {day.isToday ? 'Tap to log workout' : day.isPast ? 'Rest day' : '—'}
          </Text>
        )}
      </View>

      {/* Right — chevron */}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: COLORS.card,
    borderRadius:    14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
  },
  cardToday: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  dayCol: {
    width:      56,
    marginRight: 14,
  },
  dayShort: {
    fontSize:    11,
    fontWeight:  '700',
    color:       COLORS.textMuted,
    letterSpacing: 1.2,
  },
  dayShortToday: {
    color: COLORS.primary,
  },
  dateNum: {
    fontSize:   15,
    fontWeight: '700',
    color:      COLORS.textSub,
    marginTop:  2,
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
    borderRadius:    8,
    width:           30,
    height:          30,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.primary,
  },
  countText: {
    fontSize:   14,
    fontWeight: '800',
    color:      COLORS.primary,
  },
  exerciseWord: {
    fontSize:   15,
    fontWeight: '600',
    color:      COLORS.text,
  },
  preview: {
    fontSize:  12,
    color:     COLORS.textMuted,
    marginTop:  4,
  },
  emptyLabel: {
    fontSize:    14,
    color:       COLORS.textMuted,
    fontStyle:   'italic',
  },
  chevron: {
    fontSize: 22,
    color:    COLORS.textMuted,
    marginLeft: 8,
  },
});
