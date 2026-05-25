import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

import { COLORS } from '../constants/colors';
import { RootStackParamList, Exercise } from '../types';
import { workoutApi } from '../services/api';
import { ExerciseItem } from '../components/ExerciseItem';
import { EmptyState } from '../components/EmptyState';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'DayDetail'>;
type Route = RouteProp<RootStackParamList, 'DayDetail'>;
interface Props { navigation: Nav; route: Route }

export function DayDetailScreen({ navigation, route }: Props) {
  const { date, dayFull } = route.params;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Pretty header date: 'Thursday, 22 May'
  const displayDate = new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  });

  // ── Configure nav header ──────────────────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({
      title: dayFull,
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerAdd}
          onPress={() => navigation.navigate('AddExercise', { date, dayFull })}
        >
          <Text style={styles.headerAddText}>+ Add</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, date, dayFull]);

  // ── Load exercises ────────────────────────────────────────────
  const loadExercises = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workoutApi.getByDate(date);
      setExercises(data);
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

  const handleDelete = (id: number, name: string) => {
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
              setExercises(prev => prev.filter(e => e.id !== id));
            } catch (e) {
              Alert.alert('Error', 'Could not delete exercise. Please try again.');
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
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : exercises.length === 0 ? (
        <EmptyState
          message="No exercises logged"
          subMessage="Tap '+ Add' in the top-right corner to log your first exercise for this day."
        />
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ExerciseItem
              exercise={item}
              onEdit={()   => handleEdit(item)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Floating action button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddExercise', { date, dayFull })}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+ Add Exercise</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  dateLabel: {
    fontSize:          15,
    color:             COLORS.textMuted,
    paddingHorizontal: 20,
    paddingVertical:    10,
    borderBottomWidth:  1,
    borderBottomColor:  COLORS.border,
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
  headerAdd: {
    paddingHorizontal: 4,
  },
  headerAddText: {
    fontSize:   16,
    fontWeight: '700',
    color:      COLORS.primary,
  },
  fab: {
    position:        'absolute',
    bottom:          32,
    left:            24,
    right:           24,
    backgroundColor: COLORS.primary,
    borderRadius:    14,
    height:          52,
    justifyContent:  'center',
    alignItems:      'center',
    shadowColor:     COLORS.primary,
    shadowOpacity:   0.4,
    shadowRadius:    16,
    shadowOffset:    { width: 0, height: 6 },
    elevation:        8,
  },
  fabText: {
    fontSize:   17,
    fontWeight: '800',
    color:      '#FFFFFF',
    letterSpacing: 0.3,
  },
});
