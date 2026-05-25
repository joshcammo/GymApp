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
  const detail = [
    `${exercise.sets} sets`,
    exercise.reps ? `${exercise.reps} reps` : null,
    `${exercise.weight} ${exercise.unit}`,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <TouchableOpacity style={styles.container} onPress={onEdit} activeOpacity={0.8}>
      <View style={styles.dot} />

      <View style={styles.body}>
        <Text style={styles.name}>{exercise.name}</Text>
        <Text style={styles.detail}>{detail}</Text>
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
    fontSize:   13,
    color:      COLORS.textSub,
    marginTop:   4,
    letterSpacing: 0.2,
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
