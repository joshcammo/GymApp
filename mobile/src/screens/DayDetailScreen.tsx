import React, { useState, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { RootStackParamList, Exercise, ExerciseSet, ShareTarget, CardioSession } from '../types';
import { workoutApi, cardioApi } from '../services/api';
import { ExerciseItem } from '../components/ExerciseItem';
import { SupersetCard } from '../components/SupersetCard';
import { CardioItem } from '../components/CardioItem';
import { EmptyState } from '../components/EmptyState';
import { GradientButton } from '../components/GradientButton';
import { PresetPickerModal } from '../components/PresetPickerModal';
import { SharePostModal } from '../components/SharePostModal';
import { haptics } from '../utils/haptics';
import { parseDateStr } from '../utils/dateUtils';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'DayDetail'>;
type Route = RouteProp<RootStackParamList, 'DayDetail'>;
interface Props { navigation: Nav; route: Route }

type GroupedItem =
  | { type: 'single';   exercise: Exercise }
  | { type: 'superset'; a: Exercise; b: Exercise };

/** Pairs up superset partners (both always present: same-day, mutual link
 *  enforced server-side) in list order, leaving everyone else as singles. */
function groupExercises(exercises: Exercise[]): GroupedItem[] {
  const byId = new Map(exercises.map(e => [e.id, e]));
  const visited = new Set<number>();
  const result: GroupedItem[] = [];

  for (const e of exercises) {
    if (visited.has(e.id)) continue;
    const partner = e.superset_partner_id != null ? byId.get(e.superset_partner_id) : undefined;
    visited.add(e.id);
    if (partner && !visited.has(partner.id)) {
      visited.add(partner.id);
      result.push({ type: 'superset', a: e, b: partner });
    } else {
      result.push({ type: 'single', exercise: e });
    }
  }
  return result;
}

/** Heaviest set (most reps as tie-break), the same rule share_post() applies
 *  server-side, used here only to build an immediate share preview. */
function bestSetOf(exercise: Exercise): ExerciseSet | null {
  const weighted = exercise.sets.filter(s => s.weight != null && s.weight > 0);
  if (weighted.length === 0) return null;
  return weighted.reduce((best, s) =>
    (s.weight! > best.weight! || (s.weight === best.weight && (s.reps ?? 0) > (best.reps ?? 0))) ? s : best
  );
}

export function DayDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { date, dayFull } = route.params;
  const [exercises,     setExercises]     = useState<Exercise[]>([]);
  const [cardioSessions, setCardioSessions] = useState<CardioSession[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [presetPickerVisible, setPresetPickerVisible] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

  // Pretty header date: 'Thursday, 22 May'
  const displayDate = parseDateStr(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  });

  // ── Configure nav header ──────────────────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({
      title: dayFull,
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAdd}
            onPress={() => { haptics.tap(); navigation.navigate('AiWorkout', { date, dayFull }); }}
          >
            <Feather name="zap" size={15} color={colors.primary} />
            <Text style={styles.headerAddText}>AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAdd}
            onPress={() => { haptics.tap(); setPresetPickerVisible(true); }}
          >
            <Feather name="layers" size={15} color={colors.primary} />
            <Text style={styles.headerAddText}>Preset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAdd}
            onPress={() => { haptics.tap(); navigation.navigate('AddCardio', { date, dayFull }); }}
          >
            <Feather name="activity" size={15} color={colors.primary} />
            <Text style={styles.headerAddText}>Cardio</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, date, dayFull, styles, colors]);

  // ── Load exercises + cardio ─────────────────────────────────────
  const loadExercises = useCallback(async () => {
    setLoading(true);
    try {
      const [exerciseData, cardioData] = await Promise.all([
        workoutApi.getByDate(date),
        cardioApi.getByDate(date),
      ]);
      setExercises(exerciseData);
      setCardioSessions(cardioData);
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(useCallback(() => { loadExercises(); }, [loadExercises]));

  // ── Actions ───────────────────────────────────────────────────
  const handleEdit = (exercise: Exercise) => {
    navigation.navigate('AddExercise', { date, dayFull, editExercise: exercise });
  };

  const handleShare = (exercise: Exercise) => {
    // has_pr is only ever true for def-linked exercises (migration 006), so
    // exercise_def_id and a weighted best set are both guaranteed here.
    if (!exercise.exercise_def_id) return;
    const best = bestSetOf(exercise);
    if (!best) return;
    haptics.tap();
    setShareTarget({
      exerciseDefId: exercise.exercise_def_id,
      exerciseName:  exercise.name,
      weight:        best.weight!,
      reps:          best.reps ?? null,
      unit:          exercise.unit,
    });
  };

  const handleDelete = (id: number, name: string) => {
    haptics.warning();
    Alert.alert(
      'Delete Exercise',
      `Remove "${name}" from this day?`,
      [
        { text: 'Cancel',  style: 'cancel' },
        {
          text:  'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await workoutApi.delete(id);
              haptics.success();
              setExercises(prev => prev.filter(e => e.id !== id));
            } catch (e) {
              Alert.alert('Error', 'Could not delete exercise. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditCardio = (session: CardioSession) => {
    navigation.navigate('AddCardio', { date, dayFull, editSession: session });
  };

  const handleDeleteCardio = (id: number) => {
    haptics.warning();
    Alert.alert(
      'Delete Cardio Session',
      'Remove this session from this day?',
      [
        { text: 'Cancel',  style: 'cancel' },
        {
          text:  'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await cardioApi.delete(id);
              haptics.success();
              setCardioSessions(prev => prev.filter(s => s.id !== id));
            } catch (e) {
              Alert.alert('Error', 'Could not delete cardio session. Please try again.');
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Date subtitle */}
      <Text style={styles.dateLabel}>{displayDate}</Text>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : exercises.length === 0 && cardioSessions.length === 0 ? (
        <EmptyState
          message="Nothing logged"
          subMessage="Tap 'Add' at the bottom of the screen to log your first exercise or cardio session of the day."
          action={
            <View style={styles.emptyStateLinks}>
              <TouchableOpacity
                style={styles.loadPresetLink}
                onPress={() => { haptics.tap(); navigation.navigate('AiWorkout', { date, dayFull }); }}
              >
                <Feather name="zap" size={14} color={colors.primary} />
                <Text style={styles.loadPresetLinkText}>Generate a workout with AI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loadPresetLink}
                onPress={() => { haptics.tap(); setPresetPickerVisible(true); }}
              >
                <Feather name="layers" size={14} color={colors.primary} />
                <Text style={styles.loadPresetLinkText}>Load a preset instead</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {groupExercises(exercises).map(item => item.type === 'single' ? (
            <ExerciseItem
              key={item.exercise.id}
              exercise={item.exercise}
              onEdit={()   => handleEdit(item.exercise)}
              onDelete={() => handleDelete(item.exercise.id, item.exercise.name)}
              onShare={item.exercise.has_pr ? () => handleShare(item.exercise) : undefined}
            />
          ) : (
            <SupersetCard
              key={`superset-${item.a.id}-${item.b.id}`}
              a={item.a}
              b={item.b}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onShare={handleShare}
            />
          ))}

          {cardioSessions.length > 0 && (
            <>
              <Text style={styles.sectionHeading}>Cardio</Text>
              {cardioSessions.map(session => (
                <CardioItem
                  key={session.id}
                  session={session}
                  onEdit={()   => handleEditCardio(session)}
                  onDelete={() => handleDeleteCardio(session.id)}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Floating action button */}
      <GradientButton
        title="Add Exercise."
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddExercise', { date, dayFull })}
      />

      <PresetPickerModal
        visible={presetPickerVisible}
        date={date}
        onClose={() => setPresetPickerVisible(false)}
        onApplied={loadExercises}
        onManage={() => navigation.navigate('Presets')}
      />

      <SharePostModal
        target={shareTarget}
        onClose={() => setShareTarget(null)}
        onShared={() => setShareTarget(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  dateLabel: {
    fontSize:          14,
    color:             colors.textMuted,
    paddingHorizontal: 20,
    paddingVertical:   10,
    borderBottomWidth:  1,
    borderBottomColor:  colors.divider,
  },
  centred: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  listContent: {
    padding:       16,
    paddingBottom: 100,
  },
  sectionHeading: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         colors.textSub,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop:     4,
    marginBottom:  10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  headerAdd: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 10,
    paddingVertical:    6,
    borderRadius:      RADIUS.pill,
    backgroundColor:   colors.primaryBg,
  },
  headerAddText: {
    fontFamily: FONT.bold,
    fontSize:   14,
    color:      colors.primary,
  },
  emptyStateLinks: {
    alignItems: 'center',
    gap:        14,
  },
  loadPresetLink: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  loadPresetLinkText: {
    fontFamily: FONT.bold,
    fontSize:   13,
    color:      colors.primary,
  },
  fab: {
    position: 'absolute',
    bottom:   32,
    left:     24,
    right:    24,
  },
});
