import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert,
  ActivityIndicator, RefreshControl, StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../constants/colors';
import { RootStackParamList, DayInfo, Exercise } from '../types';
import { workoutApi } from '../services/api';
import { supabase } from '../lib/supabase';
import { WeekNavigator } from '../components/WeekNavigator';
import { DayCard } from '../components/DayCard';
import { EmptyState } from '../components/EmptyState';
import {
  getISOWeek, getWeekStart, getWeekDays,
  toDateStr, fmtShortDate, fmtWeekRange,
  getDayShort, getDayFull, isToday, isPastDay,
} from '../utils/dateUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;
interface Props { navigation: Nav }

export function HomeScreen({ navigation }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [exercises,  setExercises]  = useState<Exercise[]>([]);
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
      const data  = await workoutApi.getByRange(start, end);
      setExercises(data);
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

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text:  'Sign Out',
        style: 'destructive',
        onPress: () => {
          // On success, the auth state listener in App.tsx switches to the login stack.
          supabase.auth.signOut();
        },
      },
    ]);
  };

  // ── Build per-day info ────────────────────────────────────────
  const days: DayInfo[] = weekDays.map(date => {
    const ds = toDateStr(date);
    return {
      date:        ds,
      dayShort:    getDayShort(date),
      dayFull:     getDayFull(date),
      displayDate: fmtShortDate(date),
      isToday:     isToday(date),
      isPast:      isPastDay(date),
      exercises:   exercises.filter(e => e.date === ds),
    };
  });

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>GymTracker</Text>
        <View style={styles.headerRight}>
          <View style={styles.weekPill}>
            <Text style={styles.weekPillText}>Week {weekNumber}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
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
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <EmptyState
          emoji="⚠️"
          message="Could not load workouts"
          subMessage={`${error}\n\nMake sure the backend is running.`}
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
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

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:         8,
    paddingBottom:     16,
  },
  title: {
    fontSize:      28,
    fontWeight:    '800',
    color:         COLORS.text,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
  },
  weekPill: {
    backgroundColor: COLORS.primaryBg,
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:    6,
    borderWidth:     1,
    borderColor:     COLORS.primary,
  },
  weekPillText: {
    color:      COLORS.primary,
    fontWeight: '700',
    fontSize:   13,
  },
  signOutText: {
    color:      COLORS.textMuted,
    fontWeight: '600',
    fontSize:   13,
  },
  centred: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop:        12,
  },
});
