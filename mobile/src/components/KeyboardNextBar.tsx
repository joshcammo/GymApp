import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  InputAccessoryView, Keyboard, Platform,
} from 'react-native';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT } from '../constants/theme';

interface Props {
  /** Matches the `inputAccessoryViewID` on the inputs this bar serves. */
  nativeID: string;
  onNext:   () => void;
}

/** Done/Next bar above the keyboard, for number and decimal pads.
 *  iOS number pads have no return key (returnKeyType does nothing there),
 *  so without this there's no way to step between boxes. Android's
 *  numeric keyboard has its own next key, so this renders nothing there
 *  and the inputs' onSubmitEditing does the same job. */
export function KeyboardNextBar({ nativeID, onNext }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.done}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onNext}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.next}>Next</Text>
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
    paddingHorizontal: 16,
    paddingVertical:   10,
    backgroundColor:   colors.card,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    colors.border,
  },
  done: {
    fontFamily: FONT.medium,
    fontSize:   16,
    color:      colors.textMuted,
  },
  next: {
    fontFamily: FONT.semibold,
    fontSize:   16,
    color:      colors.primary,
  },
});
