import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ColorTokens, ColorwayId, COLORWAYS } from '../theme/colorways';
import { ThemeMode, useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { PressableScale } from '../components/PressableScale';
import { haptics } from '../utils/haptics';

const MODES: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'light',  label: 'Light',  icon: 'sun' },
  { key: 'dark',   label: 'Dark',   icon: 'moon' },
  { key: 'system', label: 'System', icon: 'smartphone' },
];

/** One colorway swatch — previews that colorway in the *currently active*
 *  light/dark mode, so what you see is what you'll get on tap. */
function ColorwaySwatch({
  id, label, tokens, selected, onPress,
}: {
  id: ColorwayId;
  label: string;
  tokens: ColorTokens;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <PressableScale
      style={[styles.swatchCard, selected && styles.swatchCardSelected]}
      onPress={onPress}
      pressScale={0.96}
    >
      <View style={[styles.swatchPreview, { backgroundColor: tokens.bg }]}>
        <View style={[styles.swatchChip, styles.swatchChipPrimary, { backgroundColor: tokens.primary }]} />
        <View style={[styles.swatchChip, styles.swatchChipCold, { backgroundColor: tokens.cold }]} />
        <View style={[styles.swatchChip, styles.swatchChipCard, { backgroundColor: tokens.card, borderColor: tokens.cardBorder }]} />
        {selected && (
          <View style={[styles.checkBadge, { backgroundColor: tokens.primary }]}>
            <Feather name="check" size={12} color="#FFFFFF" />
          </View>
        )}
      </View>
      <Text style={styles.swatchLabel} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

export function AppearanceScreen() {
  const { colors, mode, effectiveMode, colorwayId, setMode, setColorwayId, colorwayList } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>MODE</Text>
        <View style={styles.segmented}>
          {MODES.map(m => (
            <PressableScale
              key={m.key}
              style={[styles.segBtn, mode === m.key && styles.segBtnActive]}
              onPress={() => { haptics.tap(); setMode(m.key); }}
              pressScale={0.96}
            >
              <Feather
                name={m.icon}
                size={15}
                color={mode === m.key ? '#FFFFFF' : colors.textMuted}
              />
              <Text style={[styles.segBtnText, mode === m.key && styles.segBtnTextActive]}>
                {m.label}
              </Text>
            </PressableScale>
          ))}
        </View>

        <Text style={[styles.sectionLabel, styles.colorwaysLabel]}>COLORWAY</Text>
        <View style={styles.grid}>
          {colorwayList.map(cw => (
            <ColorwaySwatch
              key={cw.id}
              id={cw.id}
              label={cw.label}
              tokens={COLORWAYS[cw.id][effectiveMode]}
              selected={cw.id === colorwayId}
              onPress={() => { haptics.tap(); setColorwayId(cw.id); }}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const SWATCH_GAP = 12;

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    padding:  16,
  },
  sectionLabel: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         colors.textMuted,
    letterSpacing: 1,
    marginBottom:  10,
  },
  colorwaysLabel: {
    marginTop: 24,
  },
  segmented: {
    flexDirection:   'row',
    backgroundColor: colors.card,
    borderRadius:    RADIUS.md,
    borderWidth:      1,
    borderColor:      colors.border,
    padding:          4,
  },
  segBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: 10,
    borderRadius:    RADIUS.sm,
  },
  segBtnActive: {
    backgroundColor: colors.primary,
  },
  segBtnText: {
    fontFamily: FONT.semibold,
    fontSize:   13,
    color:      colors.textMuted,
  },
  segBtnTextActive: {
    color: '#FFFFFF',
  },
  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SWATCH_GAP,
  },
  swatchCard: {
    width:             '31%',
    borderRadius:      RADIUS.lg,
    padding:           8,
    backgroundColor:   colors.card,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
  },
  swatchCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  swatchPreview: {
    height:       64,
    borderRadius: RADIUS.md,
    overflow:     'hidden',
  },
  swatchChip: {
    position: 'absolute',
    borderRadius: 999,
  },
  swatchChipPrimary: {
    width: 30, height: 30,
    left: -6, bottom: -8,
  },
  swatchChipCold: {
    width: 22, height: 22,
    right: 6, top: 6,
  },
  swatchChipCard: {
    width: 34, height: 34,
    right: -8, bottom: -10,
    borderWidth: 1,
  },
  checkBadge: {
    position:       'absolute',
    top:            6,
    left:           6,
    width:          18,
    height:         18,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
  },
  swatchLabel: {
    marginTop:  8,
    fontSize:   12,
    fontFamily: FONT.medium,
    color:      colors.text,
    textAlign:  'center',
  },
});
