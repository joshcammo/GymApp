import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

import { COLORS } from '../constants/colors';
import { RootStackParamList, WeightUnit } from '../types';
import { workoutApi } from '../services/api';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'AddExercise'>;
type Route = RouteProp<RootStackParamList, 'AddExercise'>;
interface Props { navigation: Nav; route: Route }

const UNIT_KEY = '@gym_tracker_last_unit';

export function AddExerciseScreen({ navigation, route }: Props) {
  const { date, dayFull, editExercise } = route.params;
  const isEditing = !!editExercise;

  const [name,   setName]   = useState(editExercise?.name   ?? '');
  const [sets,   setSets]   = useState(editExercise ? String(editExercise.sets)   : '');
  const [reps,   setReps]   = useState(editExercise?.reps   ? String(editExercise.reps)   : '');
  const [weight, setWeight] = useState(editExercise ? String(editExercise.weight) : '');
  const [unit,   setUnit]   = useState<WeightUnit>(editExercise?.unit ?? 'KG');
  const [notes,  setNotes]  = useState(editExercise?.notes  ?? '');
  const [saving, setSaving] = useState(false);

  // Restore last-used unit on first open (skip if editing)
  useEffect(() => {
    if (isEditing) return;
    AsyncStorage.getItem(UNIT_KEY).then(saved => {
      if (saved === 'KG' || saved === 'LBS') setUnit(saved);
    });
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Exercise' : 'Add Exercise',
    });
  }, [navigation, isEditing]);

  // ── Validation ───────────────────────────────────────────────
  const validate = (): string | null => {
    if (!name.trim())                          return 'Please enter an exercise name.';
    if (!sets || isNaN(+sets) || +sets < 1)   return 'Please enter a valid number of sets (≥ 1).';
    if (reps && (isNaN(+reps) || +reps < 1))  return 'Reps must be a positive number.';
    if (!weight || isNaN(+weight) || +weight < 0) return 'Please enter a valid weight (≥ 0).';
    return null;
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing info', err); return; }

    setSaving(true);
    try {
      await AsyncStorage.setItem(UNIT_KEY, unit);

      const payload = {
        name:   name.trim(),
        date,
        sets:   Number(sets),
        reps:   reps ? Number(reps) : null,
        weight: Number(weight),
        unit,
        notes:  notes.trim() || null,
      };

      if (isEditing && editExercise) {
        await workoutApi.update(editExercise.id, payload);
      } else {
        await workoutApi.create(payload);
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not save exercise. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={96}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date chip */}
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>
              {dayFull} — {new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Text>
          </View>

          {/* ── Exercise name ── */}
          <Text style={styles.label}>Exercise Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Bench Press"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
            returnKeyType="next"
            autoFocus={!isEditing}
          />

          {/* ── Sets + Reps row ── */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Sets</Text>
              <TextInput
                style={styles.input}
                value={sets}
                onChangeText={setSets}
                placeholder="e.g. 4"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                returnKeyType="next"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>
                Reps <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={reps}
                onChangeText={setReps}
                placeholder="e.g. 8"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* ── Weight + Unit ── */}
          <Text style={styles.label}>Weight</Text>
          <View style={styles.weightRow}>
            <TextInput
              style={[styles.input, styles.weightInput]}
              value={weight}
              onChangeText={setWeight}
              placeholder="e.g. 80"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            {/* Unit toggle */}
            <View style={styles.unitToggle}>
              {(['KG', 'LBS'] as WeightUnit[]).map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Notes ── */}
          <Text style={styles.label}>
            Notes <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Felt strong today, paused reps"
            placeholderTextColor={COLORS.textMuted}
            multiline
            returnKeyType="default"
            maxLength={500}
          />

          {/* ── Save button ── */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isEditing ? 'Save Changes' : 'Log Exercise'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  scroll: { flex: 1 },
  content: {
    padding:       20,
    paddingBottom: 40,
  },
  datePill: {
    alignSelf:         'flex-start',
    backgroundColor:   COLORS.primaryBg,
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:    6,
    marginBottom:      24,
    borderWidth:        1,
    borderColor:        COLORS.primary,
  },
  datePillText: {
    color:      COLORS.primary,
    fontWeight: '600',
    fontSize:   13,
  },
  label: {
    fontSize:     13,
    fontWeight:   '600',
    color:        COLORS.textSub,
    marginBottom:  8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  optional: {
    fontWeight:    '400',
    color:         COLORS.textMuted,
    textTransform: 'none',
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius:    12,
    borderWidth:      1,
    borderColor:      COLORS.border,
    paddingHorizontal: 16,
    paddingVertical:   14,
    color:           COLORS.text,
    fontSize:        16,
    marginBottom:    20,
  },
  row: {
    flexDirection: 'row',
    gap:           12,
  },
  halfField: {
    flex: 1,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           12,
    marginBottom:  20,
  },
  weightInput: {
    flex:        1,
    marginBottom: 0,
  },
  unitToggle: {
    flexDirection:   'row',
    backgroundColor: COLORS.card,
    borderRadius:    12,
    borderWidth:      1,
    borderColor:      COLORS.border,
    overflow:        'hidden',
    alignSelf:       'flex-start',
  },
  unitBtn: {
    paddingHorizontal: 18,
    paddingVertical:   14,
    minWidth:          64,
    alignItems:        'center',
  },
  unitBtnActive: {
    backgroundColor: COLORS.primary,
  },
  unitBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      COLORS.textMuted,
  },
  unitBtnTextActive: {
    color: '#FFFFFF',
  },
  notesInput: {
    height:     90,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    14,
    height:          54,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:        8,
    shadowColor:     COLORS.primary,
    shadowOpacity:   0.35,
    shadowRadius:    14,
    shadowOffset:    { width: 0, height: 5 },
    elevation:        6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize:   17,
    fontWeight: '800',
    color:      '#FFFFFF',
    letterSpacing: 0.3,
  },
});
