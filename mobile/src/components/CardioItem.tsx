import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { CardioSession } from '../types';
import { PressableScale } from './PressableScale';
import { CARDIO_ACTIVITY_META, formatDistance, formatDuration } from '../utils/cardioFormat';

interface Props {
  session:  CardioSession;
  onEdit:   () => void;
  onDelete: () => void;
}

export function CardioItem({ session, onEdit, onDelete }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const meta = CARDIO_ACTIVITY_META[session.activity_type];
  const distance = formatDistance(session.distance_meters);

  return (
    <PressableScale style={styles.container} onPress={onEdit} pressScale={0.98}>
      <View style={styles.topRow}>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons name={meta.icon} size={16} color={colors.primary} />
        </View>
        <Text style={styles.name}>{meta.label}</Text>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="trash-2" size={15} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{formatDuration(session.duration_seconds)}</Text>
        </View>
        {distance && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{distance}</Text>
          </View>
        )}
      </View>

      {session.notes ? (
        <View style={styles.notesRow}>
          <Feather name="edit-3" size={11} color={colors.textMuted} />
          <Text style={styles.notes} numberOfLines={1}>{session.notes}</Text>
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
  iconBadge: {
    width:           26,
    height:          26,
    borderRadius:    RADIUS.sm,
    backgroundColor: colors.primaryBg,
    alignItems:      'center',
    justifyContent:  'center',
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
