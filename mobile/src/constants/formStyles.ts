import { StyleSheet } from 'react-native';
import { COLORS } from './colors';
import { FONT, RADIUS } from './theme';

/** Shared field label/input styling — used by every screen with a text form. */
export const formStyles = StyleSheet.create({
  label: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         COLORS.textSub,
    marginBottom:   8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.md,
    borderWidth:        1,
    borderColor:        COLORS.border,
    paddingHorizontal: 16,
    paddingVertical:   14,
    color:             COLORS.text,
    fontSize:          16,
    marginBottom:      18,
  },
});
