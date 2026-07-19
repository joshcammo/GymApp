import React, { useMemo } from 'react';
import {
  Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { FONT, RADIUS, gradientPrimary, glow } from '../constants/theme';
import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  title:     string;
  onPress:   () => void;
  loading?:  boolean;
  disabled?: boolean;
  icon?:     keyof typeof Feather.glyphMap;
  /** Extra layout styles (e.g. absolute positioning for a FAB) */
  style?:    StyleProp<ViewStyle>;
}

/** Primary gradient CTA (in the active colorway) with glow, press-sink and loading state. */
export function GradientButton({ title, onPress, loading, disabled, icon, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const blocked = disabled || loading;

  return (
    <PressableScale
      style={[styles.btn, blocked && styles.btnDisabled, style]}
      onPress={() => {
        haptics.press();
        onPress();
      }}
      disabled={blocked}
    >
      <LinearGradient
        colors={gradientPrimary(colors)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            {icon && <Feather name={icon} size={18} color="#FFFFFF" />}
            <Text style={styles.text}>{title}</Text>
          </>
        )}
      </LinearGradient>
    </PressableScale>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  btn: {
    ...glow(colors),
    borderRadius: RADIUS.md,
    // Opaque fill under the gradient — Android elevation and iOS shadows
    // need a background on the elevated view itself to render the glow.
    backgroundColor: colors.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  gradient: {
    flexDirection:  'row',
    gap:            8,
    borderRadius:   RADIUS.md,
    height:         54,
    justifyContent: 'center',
    alignItems:     'center',
  },
  text: {
    fontFamily:    FONT.bold,
    fontSize:      17,
    color:         '#FFFFFF',
    letterSpacing: 0.5,
  },
});
