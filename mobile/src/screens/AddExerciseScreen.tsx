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
import { workoutApi, SetInput } from '../services/api';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'AddExercise'>;
type Route = RouteProp<RootStackParamList, 'AddExercise'>;
interface Props { navigation: Nav; route: Route }

const UNIT_KEY = '@gym_tracker_last_unit';

/** A row in the per-set editor — strings so the input controls them */
interface SetRow {
  reps:   string;
  weight: string;
}

const emptyRow = (): SetRow => ({ reps: '', weight: '' });

export function AddExerciseScreen({ navigation, route }: Props) {
  const { date, dayFull, editExercise } = route.params;
  const isEditing = !!editExercise;

  const [name,  setName]  = useState(editExercise?.name  ?? '');
  const [unit,  setUnit]  = useState<WeightUnit>(editExercise?.unit ?? 'KG');
  const [notes, setNotes] = useState(editExercise?.notes ?? '');

  // Initialise sets — from existing exercise if editing, else one empty row
  const [setRows, setSetRows] = useState<SetRow[]>(() => {
    if (editExercise && editExercise.sets.length > 0) {
      return editExercise.sets.map(s => ({
        reps:   s.reps   != null ? String(s.reps)   : '',
        weight: s.weight != null ? String(s.weight) : '',
      }));
    }
    return [emptyRow()];
  });

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

  // ── Set row helpers ──────────────────────────────────────────
  const updateRow = (index: number, field: keyof SetRow, value: string) => {
    setSetRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    if (setRows.length >= 100) return;
    setSetRows(prev => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    if (setRows.length <= 1) return; // keep at least one
    setSetRows(prev => prev.filter((_, i) => i !== index));
  };

  // ── Validation ───────────────────────────────────────────────
  const validate = (): string | null => {
    if (!name.trim()) return 'Please enter an exercise name.';
    if (setRows.length === 0) return 'Add at least one set.';

    for (let i = 0; i < setRows.length; i++) {
  const r = setRows[i];
  const setLabel = `Set ${i + 1}`;
  // Weight is optional (bodyweight exercises). But if entered, must be valid.
  if (r.weight && (isNaN(+r.weight) || +r.weight < 0)) {
    return `${setLabel}: weight must be 0 or higher.`;
  }
  if (r.reps && (isNaN(+r.reps) || +r.reps < 1)) {
    return `${setLabel}: reps must be a positive number.`;
  }
  // At least one of reps or weight should be filled — otherwise it's an empty set
  if (!r.reps && !r.weight) {
    return `${setLabel}: enter at least reps or weight.`;
  }
}
return null;
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing info', err); return; }

    setSaving(true);
    try {
      await AsyncStorage.setItem(UNIT_KEY, unit);

      const sets: SetInput[] = setRows.map(r => ({
        reps:   r.reps   ? Number(r.reps)   : null,
        weight: r.weight ? Number(r.weight) : null,
      }));

      const payload = {
        name:  name.trim(),
        date,
        unit,
        notes: notes.trim() || null,
        sets,
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

          {/* ── Unit toggle (KG / LBS) ── */}
          <Text style={styles.label}>Weight Unit</Text>
          <View style={[styles.unitToggle, { marginBottom: 24 }]}>
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

          {/* ── Sets section ── */}
          <View style={styles.setsHeader}>
            <Text style={styles.label}>Sets</Text>
            <Text style={styles.setsCount}>{setRows.length}</Text>
          </View>

          {/* Column headings */}
          <View style={styles.setRowHeader}>
            <Text style={[styles.setRowHeaderText, { width: 40 }]}>#</Text>
            <Text style={[styles.setRowHeaderText, { flex: 1 }]}>Reps</Text>
            <Text style={[styles.setRowHeaderText, { flex: 1 }]}>Weight ({unit})</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* The set rows */}
          {setRows.map((row, i) => (
            <View key={i} style={styles.setRow}>
              <Text style={styles.setNumber}>{i + 1}</Text>

              <TextInput
                style={[styles.input, styles.setInput]}
                value={row.reps}
                onChangeText={v => updateRow(i, 'reps', v)}
                placeholder="—"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                returnKeyType="next"
              />

              <TextInput
                style={[styles.input, styles.setInput]}
                value={row.weight}
                onChangeText={v => updateRow(i, 'weight', v)}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />

              <TouchableOpacity
                style={[styles.removeBtn, setRows.length <= 1 && styles.removeBtnDisabled]}
                onPress={() => removeRow(i)}
                disabled={setRows.length <= 1}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeBtnText}>−</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add set button */}
          <TouchableOpacity
            style={styles.addSetBtn}
            onPress={addRow}
            activeOpacity={0.7}
            disabled={setRows.length >= 100}
          >
            <Text style={styles.addSetBtnText}>+ Add Set</Text>
          </TouchableOpacity>

          {/* ── Notes ── */}
          <Text style={[styles.label, { marginTop: 24 }]}>
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
  // ── Sets section ──
  setsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  setsCount: {
    fontSize:   13,
    color:      COLORS.textMuted,
    fontWeight: '600',
  },
  setRowHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  6,
  },
  setRowHeaderText: {
    fontSize:      11,
    color:         COLORS.textMuted,
    fontWeight:    '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  setRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  8,
  },
  setNumber: {
    width:      40,
    fontSize:   15,
    fontWeight: '700',
    color:      COLORS.text,
    textAlign:  'center',
  },
  setInput: {
    flex:         1,
    marginBottom: 0,
    paddingVertical: 12,
    textAlign:    'center',
  },
  removeBtn: {
    width:           36,
    height:          36,
    borderRadius:    8,
    backgroundColor: COLORS.dangerBg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  removeBtnDisabled: {
    opacity: 0.3,
  },
  removeBtnText: {
    fontSize:   22,
    color:      COLORS.danger,
    fontWeight: '700',
    lineHeight: 22,
  },
  addSetBtn: {
    marginTop:       8,
    paddingVertical: 12,
    borderRadius:    12,
    borderWidth:      1,
    borderStyle:     'dashed',
    borderColor:      COLORS.border,
    alignItems:      'center',
  },
  addSetBtnText: {
    fontSize:   14,
    fontWeight: '700',
    color:      COLORS.primary,
    letterSpacing: 0.4,
  },
  notesInput: {
    height:           90,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    14,
    height:          54,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:        16,
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