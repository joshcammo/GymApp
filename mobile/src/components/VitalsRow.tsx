import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';

type VitalIcon =
  | { family: 'feather'; name: keyof typeof Feather.glyphMap }
  | { family: 'mci';     name: keyof typeof MaterialCommunityIcons.glyphMap };

const VITALS: { key: string; label: string; icon: VitalIcon }[] = [
  { key: 'steps',    label: 'Steps',    icon: { family: 'mci',     name: 'shoe-print' } },
  { key: 'sleep',    label: 'Sleep',    icon: { family: 'feather', name: 'moon' } },
  { key: 'recovery', label: 'Recovery', icon: { family: 'feather', name: 'battery-charging' } },
];

/** Steps/Sleep/Recovery placeholders — no data source exists yet (planned
 *  Garmin import, see the roadmap). Shown locked rather than omitted so the
 *  dashboard's shape doesn't change once that data starts flowing in. */
export function VitalsRow() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {VITALS.map(v => (
        <View key={v.key} style={styles.card}>
          <View style={styles.lockBadge}>
            <Feather name="lock" size={9} color={colors.textMuted} />
          </View>
          {v.icon.family === 'feather'
            ? <Feather name={v.icon.name} size={18} color={colors.textMuted} />
            : <MaterialCommunityIcons name={v.icon.name} size={18} color={colors.textMuted} />
          }
          <Text style={styles.label}>{v.label}</Text>
          <Text style={styles.comingSoon}>Coming soon</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap:           10,
    marginBottom:  12,
  },
  card: {
    flex:              1,
    alignItems:        'center',
    gap:               4,
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.lg,
    borderWidth:        1,
    borderColor:        colors.border,
    borderStyle:       'dashed',
    paddingVertical:   14,
    opacity:           0.7,
  },
  lockBadge: {
    position: 'absolute',
    top:       8,
    right:     8,
  },
  label: {
    fontFamily: FONT.semibold,
    fontSize:   12,
    color:      colors.textSub,
    marginTop:  2,
  },
  comingSoon: {
    fontSize: 10,
    color:    colors.textMuted,
  },
});
