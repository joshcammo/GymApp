import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { Exercise } from '../types';

interface Props {
  exercise: Exercise;
  onEdit:   () => void;
  onDelete: () => void;
}

export function ExerciseItem({ exercise, onEdit, onDelete }: Props) {
  const setsCount = exercise.sets.length;

  // Determine if all sets are identical (same reps + weight)
  // If so, show a compact summary; otherwise show each set on its own line.
  const allIdentical = setsCount > 0 && exercise.sets.every(s =>
    s.reps   === exercise.sets[0].reps &&
    s.weight === exercise.sets[0].weight
  );

  return (
    <TouchableOpacity style={styles.container} onPress={onEdit} activeOpacity={0.8}>
      <View style={styles.dot} />

      <View style={styles.body}>
        <Text style={styles.name}>{exercise.name}</Text>

        {allIdentical ? (
          // Compact view: "3 sets · 8 reps · 60 KG" or "3 sets · 10 reps · Bodyweight"
          <Text style={styles.detail}>
            {[
              `${setsCount} ${setsCount === 1 ? 'set' : 'sets'}`,
              exercise.sets[0].reps ? `${exercise.sets[0].reps} reps` : null,
              exercise.sets[0].weight != null
                ? `${exercise.sets[0].weight} ${exercise.unit}`
                : 'Bodyweight',
            ]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
        ) : (
          // Per-set view: "Set 1 — 8 × 60 KG" or "Set 1 — 12 reps" (bodyweight)
          <View style={styles.setsList}>
            {exercise.sets.map(s => (
              <Text key={s.set_number} style={styles.setLine}>
                <Text style={styles.setLabel}>Set {s.set_number}</Text>
                {' — '}
                {s.weight != null
                  ? `${s.reps ? `${s.reps} × ` : ''}${s.weight} ${exercise.unit}`
                  : `${s.reps ?? '?'} reps`}
              </Text>
            ))}
          </View>
        )}

        {exercise.notes ? (
          <Text style={styles.notes} numberOfLines={1}>{exercise.notes}</Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteIcon}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.card,
    borderRadius:    12,
    padding:         16,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
  },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: COLORS.primary,
    marginRight:     14,
    alignSelf:       'flex-start',
    marginTop:       5,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize:   17,
    fontWeight: '700',
    color:      COLORS.text,
  },
  detail: {
    fontSize:      13,
    color:         COLORS.textSub,
    marginTop:     4,
    letterSpacing: 0.2,
  },
  setsList: {
    marginTop: 4,
  },
  setLine: {
    fontSize:      13,
    color:         COLORS.textSub,
    letterSpacing: 0.2,
    lineHeight:    20,
  },
  setLabel: {
    color:      COLORS.textMuted,
    fontWeight: '600',
  },
  notes: {
    fontSize:  12,
    color:     COLORS.textMuted,
    marginTop:  4,
    fontStyle: 'italic',
  },
  deleteBtn: {
    padding:         6,
    backgroundColor: COLORS.dangerBg,
    borderRadius:    8,
    marginLeft:      12,
  },
  deleteIcon: {
    fontSize:   13,
    color:      COLORS.danger,
    fontWeight: '700',
  },
});