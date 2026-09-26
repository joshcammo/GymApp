import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { Exercise, ExerciseSet } from '../types';
import { formatSet } from '../utils/setFormat';
import { PressableScale } from './PressableScale';

interface Props {
  exercise: Exercise;
  onEdit:   () => void;
  onDelete: () => void;
  /** Opens the share-to-friends flow. Only offered when the exercise has a PR. */
  onShare?: () => void;
  /** Shown as a small badge next to the name when part of a superset pair. */
  supersetLabel?: 'A1' | 'A2';
}

/** ' → 40 KG × 6 → 20 KG × 4', or '' if the set has no drops. */
function dropsSummary(drops: ExerciseSet['drops'], unit: string): string {
  if (!drops.length) return '';
  return ' → ' + drops.map(d => formatSet(d, unit)).join(' → ');
}

export function ExerciseItem({ exercise, onEdit, onDelete, onShare, supersetLabel }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setsCount = exercise.sets.length;

  // If every set is identical (and none has drops: a drop set is never
  // interchangeable with a plain one), collapse them into one summary chip.
  const allIdentical = setsCount > 0 && exercise.sets.every(s =>
    s.reps   === exercise.sets[0].reps &&
    s.weight === exercise.sets[0].weight &&
    s.drops.length === 0
  );

  return (
    <PressableScale style={styles.container} onPress={onEdit} pressScale={0.98}>
      <View style={styles.topRow}>
        <View style={styles.accentBar} />
        {supersetLabel && (
          <View style={styles.supersetBadge}>
            <Text style={styles.supersetBadgeText}>{supersetLabel}</Text>
          </View>
        )}
        <Text style={styles.name}>{exercise.name}</Text>
        {exercise.has_pr && (
          onShare ? (
            <TouchableOpacity
              style={styles.prBadge}
              onPress={onShare}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="award" size={11} color={colors.success} />
            </TouchableOpacity>
          ) : (
            <View style={styles.prBadge}>
              <Feather name="award" size={11} color={colors.success} />
            </View>
          )
        )}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="trash-2" size={15} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Set chips */}
      <View style={styles.chipsRow}>
        {allIdentical ? (
          <View style={styles.chip}>
            <Text style={styles.chipCount}>{setsCount} × </Text>
            <Text style={styles.chipText}>{formatSet(exercise.sets[0], exercise.unit)}</Text>
          </View>
        ) : (
          exercise.sets.map(s => (
            <View key={s.set_number} style={styles.chip}>
              <Text style={styles.chipText}>
                {formatSet(s, exercise.unit)}{dropsSummary(s.drops, exercise.unit)}
              </Text>
            </View>
          ))
        )}
      </View>

      {exercise.notes ? (
        <View style={styles.notesRow}>
          <Feather name="edit-3" size={11} color={colors.textMuted} />
          <Text style={styles.notes} numberOfLines={1}>{exercise.notes}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    padding:         16,
    marginBottom:    10,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  accentBar: {
    width:           3,
    height:          18,
    borderRadius:    2,
    backgroundColor: colors.primary,
    marginRight:     10,
  },
  name: {
    flex:       1,
    fontFamily: FONT.semibold,
    fontSize:   17,
    color:      colors.text,
  },
  deleteBtn: {
    width:           30,
    height:          30,
    borderRadius:    RADIUS.sm,
    backgroundColor: colors.dangerBg,
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      12,
  },
  prBadge: {
    width:           22,
    height:          22,
    borderRadius:    RADIUS.pill,
    backgroundColor: colors.successBg,
    borderWidth:      1,
    borderColor:      colors.success,
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      8,
  },
  supersetBadge: {
    backgroundColor:   colors.primaryBg,
    borderRadius:      RADIUS.sm,
    borderWidth:        1,
    borderColor:        colors.primary,
    paddingHorizontal: 6,
    paddingVertical:   2,
    marginRight:       8,
  },
  supersetBadgeText: {
    fontFamily: FONT.bold,
    fontSize:   11,
    color:      colors.primary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    marginTop:     10,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.bgAlt,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingHorizontal: 11,
    paddingVertical:    5,
  },
  chipCount: {
    fontFamily: FONT.bold,
    fontSize:   12,
    color:      colors.primary,
  },
  chipText: {
    fontFamily: FONT.medium,
    fontSize:   12,
    color:      colors.textSub,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     10,
  },
  notes: {
    flex:      1,
    fontSize:  12,
    color:     colors.textMuted,
    fontStyle: 'italic',
  },
});
