import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { AchievementStats } from '../types';
import { analyticsApi } from '../services/api';

interface BadgeDef {
  key:    string;
  label:  string;
  icon:   keyof typeof MaterialCommunityIcons.glyphMap;
  /** How close the user is, 0-1. 1 means earned. */
  progress: (s: AchievementStats) => number;
  /** Shown on the locked card: what it takes to earn it. */
  requirement: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Badges are *derived*, not stored: every one is a pure function of the
 * lifetime stats the server already computes. That means no new table, no
 * award-granting write path, and no way for the badge state to drift out of
 * sync with the underlying training history (delete a workout and the badge
 * recalculates honestly).
 */
const BADGES: BadgeDef[] = [
  {
    key: 'first_session', label: 'First Session', icon: 'seed',
    progress: s => clamp01(s.total_training_days / 1),
    requirement: 'Log your first day',
  },
  // Frequency, not consecutive days: five sessions in a week is a hard,
  // realistic target that a rest day doesn't reset.
  {
    key: 'big_week', label: 'Big Week', icon: 'calendar-star',
    progress: s => clamp01(s.best_week_days / 5),
    requirement: '5 days in one week',
  },
  {
    key: 'full_body', label: 'Full Body', icon: 'arm-flex',
    progress: s => clamp01(s.muscle_groups_last_7d / 6),
    requirement: '6 muscle groups in a week',
  },
  {
    key: 'century', label: 'Century', icon: 'dumbbell',
    progress: s => clamp01(s.total_exercises / 100),
    requirement: '100 exercises logged',
  },
  {
    key: 'ten_tonne', label: '10 Tonne', icon: 'weight-lifter',
    progress: s => clamp01(s.total_volume_kg / 10000),
    requirement: '10,000 kg lifted',
  },
  {
    key: 'thirty_days', label: '30 Days In', icon: 'calendar-check',
    progress: s => clamp01(s.total_training_days / 30),
    requirement: '30 training days',
  },
];

/** Light gamification: earned badges first, then whichever is closest to
 *  being earned, so there's always a visible next thing to chase. */
export function BadgesRow() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stats, setStats] = useState<AchievementStats | null | 'error'>(null);

  useEffect(() => {
    let stale = false;
    analyticsApi.getAchievementStats()
      .then(s => { if (!stale) setStats(s); })
      .catch(() => { if (!stale) setStats('error'); });
    return () => { stale = true; };
  }, []);

  const ranked = useMemo(() => {
    if (!stats || stats === 'error') return [];
    return BADGES
      .map(b => ({ badge: b, progress: b.progress(stats) }))
      // Earned first; among the unearned, closest-to-earned first, so the
      // next thing to chase is always the first locked card you see.
      .sort((a, b) => {
        const aEarned = a.progress >= 1 ? 1 : 0;
        const bEarned = b.progress >= 1 ? 1 : 0;
        if (aEarned !== bEarned) return bEarned - aEarned;
        return b.progress - a.progress;
      });
  }, [stats]);

  // Best-effort, like the other dashboard cards: a failure hides the row
  // rather than showing a broken one. Placed after every hook so the hook
  // order stays identical across renders.
  if (stats === 'error') return null;

  const earnedCount = ranked.filter(r => r.progress >= 1).length;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Badges</Text>
        {stats && (
          <Text style={styles.count}>{earnedCount} of {BADGES.length}</Text>
        )}
      </View>

      {!stats ? (
        <View style={styles.fill}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {ranked.map(({ badge, progress }) => {
            const earned = progress >= 1;
            return (
              <View key={badge.key} style={[styles.badge, earned ? styles.badgeEarned : styles.badgeLocked]}>
                <MaterialCommunityIcons
                  name={badge.icon}
                  size={22}
                  color={earned ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.badgeLabel, earned && styles.badgeLabelEarned]} numberOfLines={1}>
                  {badge.label}
                </Text>
                {earned ? (
                  <Text style={styles.badgeSub}>Earned</Text>
                ) : (
                  <>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                    <Text style={styles.badgeSub} numberOfLines={1}>{badge.requirement}</Text>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  card: {
    backgroundColor: colors.bgAlt,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    paddingVertical: 16,
    marginBottom:    12,
  },
  headerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    marginBottom:      12,
  },
  heading: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         colors.textSub,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  count: {
    fontFamily: FONT.bold,
    fontSize:   12,
    color:      colors.primary,
  },
  fill: {
    height:         90,
    alignItems:     'center',
    justifyContent: 'center',
  },
  strip: {
    paddingHorizontal: 16,
    gap:               10,
  },
  badge: {
    width:           104,
    alignItems:      'center',
    gap:             5,
    borderRadius:    RADIUS.md,
    borderWidth:      1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  badgeEarned: {
    backgroundColor: colors.primaryBg,
    borderColor:     colors.primary,
  },
  badgeLocked: {
    backgroundColor: colors.card,
    borderColor:     colors.border,
    borderStyle:     'dashed',
  },
  badgeLabel: {
    fontFamily: FONT.semibold,
    fontSize:   12,
    color:      colors.textSub,
    textAlign:  'center',
  },
  badgeLabelEarned: {
    color: colors.text,
  },
  badgeSub: {
    fontSize:  10,
    color:     colors.textMuted,
    textAlign: 'center',
  },
  progressTrack: {
    width:           '100%',
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
    overflow:        'hidden',
    marginTop:       2,
  },
  progressFill: {
    height:          '100%',
    borderRadius:    2,
    backgroundColor: colors.textMuted,
  },
});
