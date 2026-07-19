import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../constants/colors';
import { FONT } from '../constants/theme';

interface Props {
  /** Display name, username, or null — the first character (uppercased) is shown, '?' if none. */
  name: string | null | undefined;
  /** Diameter in px (default 36). */
  size?: number;
}

/** Circular initial avatar used anywhere a user needs a visual stand-in (no photo uploads in this app). */
export function Avatar({ name, size = 36 }: Props) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.letter, { fontSize: Math.round(size * 0.42) }]}>
        {(name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: COLORS.primaryBg,
    borderWidth:      1,
    borderColor:      COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  letter: {
    fontFamily: FONT.bold,
    color:      COLORS.primary,
  },
});
