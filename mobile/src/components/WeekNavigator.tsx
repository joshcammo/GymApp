import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  weekNumber: number;
  weekRange:  string;
  weekOffset: number;
  onPrev:     () => void;
  onNext:     () => void;
}

export function WeekNavigator({ weekNumber, weekRange, weekOffset, onPrev, onNext }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCurrentWeek = weekOffset === 0;

  const prev = () => { haptics.tap(); onPrev(); };
  const next = () => { haptics.tap(); onNext(); };

  return (
    <View style={styles.container}>
      <PressableScale
        onPress={prev}
        style={styles.arrowBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        pressScale={0.9}
      >
        <Feather name="chevron-left" size={22} color={colors.textSub} />
      </PressableScale>

      <View style={styles.middle}>
        <View style={styles.weekRow}>
          <Text style={styles.weekLabel}>WEEK</Text>
          <Text style={styles.weekNumber}>{weekNumber}</Text>
          {isCurrentWeek && (
            <View style={styles.nowBadge}>
              <Text style={styles.nowText}>NOW</Text>
            </View>
          )}
        </View>
        <Text style={styles.range}>{weekRange}</Text>
      </View>

      <PressableScale
        onPress={next}
        style={styles.arrowBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        pressScale={0.9}
      >
        <Feather name="chevron-right" size={22} color={colors.textSub} />
      </PressableScale>
    </View>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: 16,
    marginBottom:     14,
    paddingHorizontal: 14,
    paddingVertical:   12,
    backgroundColor:  colors.bgAlt,
    borderRadius:     RADIUS.lg,
    borderWidth:       1,
    borderColor:       colors.cardBorder,
  },
  arrowBtn: {
    width:           40,
    height:          40,
    borderRadius:    RADIUS.pill,
    backgroundColor: colors.card,
    borderWidth:      1,
    borderColor:      colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  middle: {
    flex:       1,
    alignItems: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
  },
  weekLabel: {
    fontFamily:    FONT.semibold,
    fontSize:      11,
    color:         colors.textMuted,
    letterSpacing: 1.5,
  },
  weekNumber: {
    fontFamily: FONT.bold,
    fontSize:   24,
    color:      colors.text,
  },
  nowBadge: {
    backgroundColor:   colors.primaryBg,
    borderRadius:      RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       colors.primary,
  },
  nowText: {
    fontFamily:    FONT.bold,
    fontSize:      10,
    color:         colors.primary,
    letterSpacing: 1,
  },
  range: {
    fontSize:  12,
    color:     colors.textMuted,
    marginTop: 2,
  },
});
