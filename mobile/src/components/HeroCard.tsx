import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS, gradientPrimary, glow } from '../constants/theme';
import { DayInfo } from '../types';
import { analyticsApi } from '../services/api';
import { formatDuration } from '../utils/cardioFormat';

interface Props {
  days: DayInfo[];
}

/**
 * The one number the dashboard leads with. Streak is the hero figure —
 * it's the metric that answers "am I keeping this up?" without the user
 * having to interpret anything — with the current week's shape underneath
 * it as supporting context.
 *
 * White-on-gradient is the same treatment GradientButton uses, so it
 * inherits contrast that's already been checked across all nine colorways
 * rather than introducing a new foreground/background pair.
 */
export function HeroCard({ days }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // null = still loading; a failed fetch falls back to 0 so the card keeps
  // its shape (the week stats below are still worth showing on their own).
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    let stale = false;
    analyticsApi.getCurrentStreak()
      .then(n => { if (!stale) setStreak(n); })
      .catch(() => { if (!stale) setStreak(0); });
    return () => { stale = true; };
  }, []);

  const totalExercises = days.reduce((sum, d) => sum + d.exercises.length, 0);
  const cardioSessions = days.flatMap(d => d.cardioSessions);
  const cardioSeconds  = cardioSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const activeDays     = days.filter(d => d.exercises.length > 0 || d.cardioSessions.length > 0).length;

  return (
    <LinearGradient
      colors={gradientPrimary(colors)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* ── Hero figure ── */}
      <View style={styles.heroRow}>
        <View style={styles.heroFigure}>
          <Text style={styles.heroNumber}>{streak ?? '—'}</Text>
          <View style={styles.heroLabelBlock}>
            <MaterialCommunityIcons name="fire" size={16} color="#FFFFFF" />
            <Text style={styles.heroLabel}>
              day{streak === 1 ? '' : 's'} in a row
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.heroCaption}>
        {streak === null
          ? ' '
          : streak === 0
            ? 'Log anything today to start a streak.'
            : 'Keep it going — log something today.'}
      </Text>

      {/* ── Weekly meter ── */}
      <View style={styles.meterBlock}>
        <View style={styles.meterHeader}>
          <Text style={styles.meterLabel}>This week</Text>
          <Text style={styles.meterValue}>{activeDays} of 7 days active</Text>
        </View>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${(activeDays / 7) * 100}%` }]} />
        </View>
      </View>

      {/* ── Supporting stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{totalExercises}</Text>
          <Text style={styles.statLabel}>{totalExercises === 1 ? 'Exercise' : 'Exercises'}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{cardioSessions.length}</Text>
          <Text style={styles.statLabel}>Cardio</Text>
          {cardioSeconds > 0 && (
            <Text style={styles.statSub}>{formatDuration(cardioSeconds)}</Text>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  card: {
    ...glow(colors),
    borderRadius: RADIUS.lg,
    padding:      18,
    marginBottom: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  heroFigure: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           10,
  },
  heroNumber: {
    fontFamily: FONT.bold,
    // The dashboard's single hero figure. Deliberately not tabular-nums —
    // equal-width digits make a number like 12 look loose at this size.
    fontSize:   54,
    lineHeight: 58,
    color:      '#FFFFFF',
  },
  heroLabelBlock: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  heroLabel: {
    fontFamily: FONT.semibold,
    fontSize:   15,
    color:      '#FFFFFF',
  },
  heroCaption: {
    fontFamily: FONT.medium,
    fontSize:   13,
    color:      'rgba(255,255,255,0.85)',
    marginTop:  2,
  },
  // ── Meter ──
  meterBlock: {
    marginTop: 18,
  },
  meterHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   7,
  },
  meterLabel: {
    fontFamily:    FONT.semibold,
    fontSize:      11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color:         'rgba(255,255,255,0.75)',
  },
  meterValue: {
    fontFamily: FONT.semibold,
    fontSize:   13,
    color:      '#FFFFFF',
  },
  // Track is a translucent step of the fill itself, so empty and filled
  // read as one scale rather than two unrelated colors.
  meterTrack: {
    height:          7,
    borderRadius:    4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow:        'hidden',
  },
  meterFill: {
    height:          '100%',
    borderRadius:    4,
    backgroundColor: '#FFFFFF',
  },
  // ── Supporting stats ──
  statsRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginTop:     18,
  },
  stat: {
    flex:       1,
    alignItems: 'center',
  },
  statDivider: {
    width:            1,
    alignSelf:        'stretch',
    backgroundColor:  'rgba(255,255,255,0.25)',
    marginHorizontal: 8,
  },
  statNumber: {
    fontFamily: FONT.bold,
    fontSize:   22,
    color:      '#FFFFFF',
  },
  statLabel: {
    fontFamily: FONT.medium,
    fontSize:   12,
    color:      'rgba(255,255,255,0.85)',
  },
  statSub: {
    fontSize:  11,
    color:     'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
});
