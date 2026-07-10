import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

import { COLORS } from '../constants/colors';
import { FONT, GRADIENT_PRIMARY } from '../constants/theme';

/** GYM|TRACKER two-tone brand wordmark. */
export function Wordmark({ fontSize = 22, letterSpacing = 3 }: {
  fontSize?:      number;
  letterSpacing?: number;
}) {
  return (
    <Text style={[styles.wordmark, { fontSize, letterSpacing }]}>
      GYM<Text style={styles.wordmarkAccent}>TRACKER</Text>
    </Text>
  );
}

interface LogoProps {
  /** Width/height of the square logomark (default 64) */
  size?: number;
  /** Render the wordmark underneath */
  withWordmark?: boolean;
}

/**
 * GymTracker logomark — a loaded barbell inside an open progress ring.
 * The 300° ring reads as "a set nearly done"; the gap sits at the bottom
 * so the mark feels like it is lifting.
 */
export const Logo = React.memo(function Logo({ size = 64, withWordmark = false }: LogoProps) {
  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id="ember" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GRADIENT_PRIMARY[0]} />
            <Stop offset="1" stopColor={GRADIENT_PRIMARY[1]} />
          </LinearGradient>
        </Defs>

        {/* Progress ring — 300° arc, gap at the bottom */}
        <Path
          d="M 45 54.5 A 26 26 0 1 0 19 54.5"
          stroke="url(#ember)"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />

        {/* Barbell — bar */}
        <Rect x={13} y={29.5} width={38} height={5} rx={2.5} fill={COLORS.text} />
        {/* Plates */}
        <Rect x={19} y={21} width={6} height={22} rx={3} fill="url(#ember)" />
        <Rect x={39} y={21} width={6} height={22} rx={3} fill="url(#ember)" />
      </Svg>

      {withWordmark && (
        <View style={styles.wordmarkGap}>
          <Wordmark />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  wordmarkGap: {
    marginTop: 14,
  },
  wordmark: {
    fontFamily: FONT.bold,
    color:      COLORS.text,
  },
  wordmarkAccent: {
    color: COLORS.primary,
  },
});
