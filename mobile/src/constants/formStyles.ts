import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from './theme';

const createFormStyles = (colors: ColorTokens) => StyleSheet.create({
  label: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         colors.textSub,
    marginBottom:   8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.md,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingHorizontal: 16,
    paddingVertical:   14,
    color:             colors.text,
    fontSize:          16,
    marginBottom:      18,
  },
});

/** Shared field label/input styling — used by every screen with a text form. */
export function useFormStyles() {
  const { colors } = useTheme();
  return useMemo(() => createFormStyles(colors), [colors]);
}
