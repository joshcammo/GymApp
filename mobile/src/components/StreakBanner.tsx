import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { analyticsApi } from '../services/api';

/** Consecutive-day streak banner. Best-effort and self-fetching — renders
 *  nothing while loading, on a failed fetch, or when the streak is 0, since
 *  "0 day streak" isn't a useful thing to show a new or lapsed user. */
export function StreakBanner() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    let stale = false;
    analyticsApi.getCurrentStreak()
      .then(n => { if (!stale) setStreak(n); })
      .catch(() => { if (!stale) setStreak(0); });
    return () => { stale = true; };
  }, []);

  if (!streak) return null;

  return (
    <View style={styles.banner}>
      <MaterialCommunityIcons name="fire" size={16} color={colors.primary} />
      <Text style={styles.text}>
        {streak} day{streak === 1 ? '' : 's'} in a row
      </Text>
    </View>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  banner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    alignSelf:         'flex-start',
    backgroundColor:   colors.primaryBg,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        colors.primary,
    paddingHorizontal: 12,
    paddingVertical:    6,
    marginBottom:      12,
  },
  text: {
    fontFamily: FONT.bold,
    fontSize:   13,
    color:      colors.primary,
  },
});
