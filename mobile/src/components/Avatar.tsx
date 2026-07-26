import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT } from '../constants/theme';

interface Props {
  /** Display name, username, or null: the first character (uppercased) is shown, '?' if none. */
  name: string | null | undefined;
  /** Diameter in px (default 36). */
  size?: number;
}

/** Circular initial avatar used anywhere a user needs a visual stand-in (no photo uploads in this app). */
export function Avatar({ name, size = 36 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.letter, { fontSize: Math.round(size * 0.42) }]}>
        {(name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  circle: {
    backgroundColor: colors.primaryBg,
    borderWidth:      1,
    borderColor:      colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  letter: {
    fontFamily: FONT.bold,
    color:      colors.primary,
  },
});
