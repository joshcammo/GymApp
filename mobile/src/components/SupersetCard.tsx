import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { Exercise } from '../types';
import { ExerciseItem } from './ExerciseItem';

interface Props {
  a: Exercise;
  b: Exercise;
  onEdit:   (exercise: Exercise) => void;
  onDelete: (id: number, name: string) => void;
  onShare?: (exercise: Exercise) => void;
}

/** Brackets two paired exercises under a shared "Superset" header, with A1/A2 labels. */
export function SupersetCard({ a, b, onEdit, onDelete, onShare }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="zap" size={12} color={COLORS.primary} />
        <Text style={styles.headerText}>SUPERSET</Text>
      </View>
      <ExerciseItem
        exercise={a}
        supersetLabel="A1"
        onEdit={()   => onEdit(a)}
        onDelete={() => onDelete(a.id, a.name)}
        onShare={onShare ? () => onShare(a) : undefined}
      />
      <ExerciseItem
        exercise={b}
        supersetLabel="A2"
        onEdit={()   => onEdit(b)}
        onDelete={() => onDelete(b.id, b.name)}
        onShare={onShare ? () => onShare(b) : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius:    RADIUS.lg,
    borderWidth:      1.5,
    borderColor:      COLORS.primary,
    borderStyle:     'dashed',
    padding:         10,
    paddingBottom:    0,
    marginBottom:    10,
    backgroundColor: COLORS.primaryBg,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    marginBottom:  8,
    marginLeft:    2,
  },
  headerText: {
    fontFamily:    FONT.bold,
    fontSize:      11,
    letterSpacing: 0.8,
    color:         COLORS.primary,
  },
});
