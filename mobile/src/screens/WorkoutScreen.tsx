import React, { useState, useCallback, useMemo } from 'react';
import {
  View, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { RootStackParamList, MainTabParamList, DayInfo, Exercise, CardioSession } from '../types';
import { workoutApi, cardioApi } from '../services/api';
import { WeekNavigator } from '../components/WeekNavigator';
import { DayCard } from '../components/DayCard';
import { EmptyState } from '../components/EmptyState';
import {
  getISOWeek, getWeekStart, getWeekDays,
  toDateStr, fmtWeekRange,
  getDayShort, getDayFull, isToday, isPastDay,
} from '../utils/dateUtils';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'WorkoutTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;
interface Props { navigation: Nav }

/** Day-by-day browser for logging/reviewing exercises and cardio — split out
 *  of HomeScreen so Home can be a pure dashboard and this can be its own tab. */
export function WorkoutScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [exercises,  setExercises]  = useState<Exercise[]>([]);
  const [cardioSessions, setCardioSessions] = useState<CardioSession[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Derived week info ────────────────────────────────────────
  const weekStart  = getWeekStart(weekOffset);
  const weekDays   = getWeekDays(weekStart);
  const weekNumber = getISOWeek(weekStart);
  const weekRange  = fmtWeekRange(weekStart);

  // ── Data loading ─────────────────────────────────────────────
  const loadData = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true);
    setError(null);
    try {
      const start = toDateStr(weekDays[0]);
      const end   = toDateStr(weekDays[6]);
      const [exerciseData, cardioData] = await Promise.all([
        workoutApi.getByRange(start, end),
        cardioApi.getByRange(start, end),
      ]);
      setExercises(exerciseData);
      setCardioSessions(cardioData);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load workouts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload whenever the screen comes into focus or the week changes
  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  // ── Build per-day info ────────────────────────────────────────
  const days: DayInfo[] = weekDays.map(date => {
    const ds = toDateStr(date);
    return {
      date:        ds,
      dayShort:    getDayShort(date),
      dayFull:     getDayFull(date),
      dayOfMonth:  date.getDate(),
      isToday:     isToday(date),
      isPast:      isPastDay(date),
      exercises:   exercises.filter(e => e.date === ds),
      cardioSessions: cardioSessions.filter(s => s.date === ds),
    };
  });

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Week navigator ── */}
      <WeekNavigator
        weekNumber={weekNumber}
        weekRange={weekRange}
        weekOffset={weekOffset}
        onPrev={() => setWeekOffset(o => o - 1)}
        onNext={() => setWeekOffset(o => o + 1)}
      />

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <ScrollView
          contentContainerStyle={styles.errorContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <EmptyState
            emoji="⚠️"
            message="Could not load workouts"
            subMessage={`${error}\n\nCheck your connection and pull to retry.`}
          />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {days.map(day => (
            <DayCard
              key={day.date}
              day={day}
              onPress={() =>
                navigation.navigate('DayDetail', {
                  date:    day.date,
                  dayFull: day.dayFull,
                })
              }
            />
          ))}
          {/* Bottom breathing room */}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  centred: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding:    16,
    paddingTop: 12,
  },
  errorContent: {
    flexGrow: 1,
  },
});
