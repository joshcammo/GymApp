import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS, gradientPrimary, glow } from '../constants/theme';
import { DayInfo } from '../types';
import { formatDuration } from '../utils/cardioFormat';

interface Props {
  days: DayInfo[];
}

/**
 * Encouragement keyed to how many days were trained this week. Deliberately
 * not a consecutive-day streak: rest is part of training, so a message that
 * treats a day off as a broken run punishes the user for recovering.
 *
 * Every tier is positive about what has been done and points at the next
 * step, and the top tiers nudge toward recovery instead of implying seven
 * days is the target to chase.
 */
const MESSAGES: Record<number, string> = {
  0: 'Fresh week. One session is all it takes to get going.',
  1: 'One session in. Two or three a week is where progress starts.',
  2: 'Two sessions this week. A solid base, and one more makes it a strong week.',
  3: "Three sessions this week. That's a genuinely consistent week.",
  4: 'Four sessions this week. Strong week, well ahead of most.',
  5: 'Five sessions this week. Excellent consistency.',
  6: 'Six sessions this week. Outstanding. Keep an eye on recovery.',
  7: 'Seven for seven. Huge week. Make sure some of it was light.',
};

/**
 * The one number the dashboard leads with: days trained this week. It answers
 * "am I keeping this up?" without the user having to interpret anything, with
 * the shape of the week underneath it as supporting context.
 *
 * Everything shown here is derived from the week data HomeScreen has already
 * loaded, so the card costs no extra request and can never disagree with the
 * day list on the Workout tab.
 *
 * White-on-gradient is the same treatment GradientButton uses, so it inherits
 * contrast that's already been checked across all nine colorways rather than
 * introducing a new foreground/background pair.
 */
export function HeroCard({ days }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const trainedDays = days.map(d => d.exercises.length > 0 || d.cardioSessions.length > 0);
  const daysTrained = trainedDays.filter(Boolean).length;

  const totalExercises = days.reduce((sum, d) => sum + d.exercises.length, 0);
  const cardioSessions = days.flatMap(d => d.cardioSessions);
  const cardioSeconds  = cardioSessions.reduce((sum, s) => sum + s.duration_seconds, 0);

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
          <Text style={styles.heroNumber}>{daysTrained}</Text>
          <View style={styles.heroLabelBlock}>
            <MaterialCommunityIcons name="calendar-check" size={16} color="#FFFFFF" />
            <Text style={styles.heroLabel}>
              {daysTrained === 1 ? 'day trained this week' : 'days trained this week'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.heroCaption}>{MESSAGES[daysTrained]}</Text>

      {/* ── Week shape ──
          Replaces a 0-of-7 progress bar: once the hero figure *is* the count,
          a bar repeats it. Which days were trained is new information. */}
      <View style={styles.weekBlock}>
        <Text style={styles.weekLabel}>This week</Text>
        <View style={styles.dayRow}>
          {days.map((day, i) => {
            const trained = trainedDays[i];
            return (
              <View
                key={day.date}
                style={[
                  styles.dayDot,
                  trained ? styles.dayDotTrained : styles.dayDotRest,
                  day.isToday && !trained && styles.dayDotToday,
                ]}
              >
                <Text style={[styles.dayInitial, trained && styles.dayInitialTrained]}>
                  {day.dayShort.charAt(0)}
                </Text>
              </View>
            );
          })}
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
    // The dashboard's single hero figure. Deliberately not tabular-nums:
    // equal-width digits make a number like 12 look loose at this size.
    fontSize:   54,
    lineHeight: 58,
    color:      '#FFFFFF',
  },
  heroLabelBlock: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    flexShrink:    1,
  },
  heroLabel: {
    fontFamily: FONT.semibold,
    fontSize:   15,
    color:      '#FFFFFF',
    flexShrink: 1,
  },
  heroCaption: {
    fontFamily: FONT.medium,
    fontSize:   13,
    color:      'rgba(255,255,255,0.85)',
    marginTop:  2,
  },
  // ── Week shape ──
  weekBlock: {
    marginTop: 18,
  },
  weekLabel: {
    fontFamily:    FONT.semibold,
    fontSize:      11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color:         'rgba(255,255,255,0.75)',
    marginBottom:  8,
  },
  dayRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  dayDot: {
    flex:           1,
    aspectRatio:    1,
    maxWidth:       34,
    borderRadius:   RADIUS.pill,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    'transparent',
  },
  dayDotTrained: {
    backgroundColor: '#FFFFFF',
  },
  // Rest days are a quiet step of the same scale rather than a second color,
  // so an untrained day reads as "not yet" instead of as a warning.
  dayDotRest: {
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  dayDotToday: {
    borderColor: 'rgba(255,255,255,0.9)',
  },
  dayInitial: {
    fontFamily: FONT.semibold,
    fontSize:   12,
    color:      'rgba(255,255,255,0.85)',
  },
  dayInitialTrained: {
    color: colors.primary,
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
