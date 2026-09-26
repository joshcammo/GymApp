import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  InputAccessoryView, Keyboard, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { haptics } from '../utils/haptics';

interface Props {
  /** Matches the `inputAccessoryViewID` of the one input this bar serves. */
  nativeID: string;
  /** Null greys the button out (first/last box). */
  onBack:   (() => void) | null;
  onNext:   (() => void) | null;
}

/** Back / Next / Done bar above an iOS number or decimal pad, which have no
 *  return key of their own. One bar per input (see useFieldChain for why).
 *  Android's numeric keyboard has its own next key, so this renders nothing
 *  there. */
export function KeyboardFieldBar({ nativeID, onBack, onNext }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (Platform.OS !== 'ios') return null;

  const press = (fn: () => void) => () => {
    haptics.tap();
    fn();
  };

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.bar}>
        <View style={styles.navGroup}>
          <TouchableOpacity
            style={[styles.navPill, !onBack && styles.disabled]}
            onPress={onBack ? press(onBack) : undefined}
            disabled={!onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Previous field"
            accessibilityState={{ disabled: !onBack }}
          >
            <Feather name="chevron-left" size={18} color={colors.primary} />
            <Text style={styles.navText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navPill, !onNext && styles.disabled]}
            onPress={onNext ? press(onNext) : undefined}
            disabled={!onNext}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Next field"
            accessibilityState={{ disabled: !onNext }}
          >
            <Text style={styles.navText}>Next</Text>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.donePill}
          onPress={press(() => Keyboard.dismiss())}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Close keypad"
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  bar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   8,
    backgroundColor:   colors.cardRaised,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    colors.border,
  },
  navGroup: {
    flexDirection: 'row',
    gap:           8,
  },
  // 44pt tall: Apple's minimum comfortable touch target.
  navPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               2,
    height:            44,
    paddingHorizontal: 14,
    borderRadius:      RADIUS.pill,
    backgroundColor:   colors.primaryBg,
  },
  navText: {
    fontFamily: FONT.semibold,
    fontSize:   15,
    color:      colors.primary,
  },
  disabled: {
    opacity: 0.35,
  },
  donePill: {
    justifyContent:    'center',
    height:            44,
    paddingHorizontal: 24,
    borderRadius:      RADIUS.pill,
    backgroundColor:   colors.primary,
  },
  doneText: {
    fontFamily: FONT.bold,
    fontSize:   15,
    color:      '#FFFFFF',
  },
});
