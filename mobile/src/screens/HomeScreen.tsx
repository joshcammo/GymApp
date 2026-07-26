import React, { useState, useCallback, useMemo } from 'react';
import {
  View, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { RADIUS } from '../constants/theme';
import { RootStackParamList, MainTabParamList, DayInfo, Exercise, CardioSession } from '../types';
import { workoutApi, cardioApi } from '../services/api';
import { Logo, Wordmark } from '../components/Logo';
import { PressableScale } from '../components/PressableScale';
import { WeekNavigator } from '../components/WeekNavigator';
import { DayCard } from '../components/DayCard';
import { EmptyState } from '../components/EmptyState';
import {
  getISOWeek, getWeekStart, getWeekDays,
  toDateStr, fmtWeekRange,
  getDayShort, getDayFull, isToday, isPastDay,
} from '../utils/dateUtils';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;
interface Props { navigation: Nav }

export function HomeScreen({ navigation }: Props) {
  const { colors, effectiveMode } = useTheme();
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar
        barStyle={effectiveMode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <Logo size={34} />
          <Wordmark fontSize={19} letterSpacing={2} />
        </View>
        <View style={styles.headerActions}>
          <PressableScale
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            pressScale={0.9}
          >
            <Feather name="settings" size={17} color={colors.textSub} />
          </PressableScale>
        </View>
      </View>

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
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:        10,
    paddingBottom:     16,
  },
  brand: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  headerActions: {
    flexDirection: 'row',
    gap:           10,
  },
  settingsBtn: {
    width:           38,
    height:          38,
    borderRadius:    RADIUS.pill,
    backgroundColor: colors.card,
    borderWidth:      1,
    borderColor:      colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  centred: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop:        4,
  },
  errorContent: {
    flexGrow: 1,
  },
});
