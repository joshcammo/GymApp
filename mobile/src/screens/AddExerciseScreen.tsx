import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert,
  KeyboardAvoidingView, Keyboard, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { formStyles } from '../constants/formStyles';
import { RootStackParamList, WeightUnit, ExerciseDef } from '../types';
import { workoutApi, catalogApi, SetInput, SetPrResult, ExercisePr } from '../services/api';
import { GradientButton } from '../components/GradientButton';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { haptics } from '../utils/haptics';
import { parseDateStr } from '../utils/dateUtils';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'AddExercise'>;
type Route = RouteProp<RootStackParamList, 'AddExercise'>;
interface Props { navigation: Nav; route: Route }

const UNIT_KEY = '@gym_tracker_last_unit';

/** A row in the per-set editor — strings so the input controls them.
 *  `id` (the underlying exercise_sets.id) is carried through so a live
 *  record badge stays attached to the right row even if earlier rows are
 *  added/removed before saving; new/unsaved rows have no id yet. */
interface SetRow {
  id?:    number;
  reps:   string;
  weight: string;
}

const emptyRow = (): SetRow => ({ reps: '', weight: '' });

export function AddExerciseScreen({ navigation, route }: Props) {
  const { date, dayFull, editExercise } = route.params;
  const isEditing = !!editExercise;

  // The chosen catalog/custom exercise. When editing a legacy entry that
  // predates the catalog (exercise_def_id null), this starts null and the
  // user must pick — the old free-text name is shown as a hint.
  const [selectedDef, setSelectedDef] = useState<{ id: number; name: string } | null>(
    editExercise?.exercise_def_id != null
      ? { id: editExercise.exercise_def_id, name: editExercise.name }
      : null
  );
  const [unit,  setUnit]  = useState<WeightUnit>(editExercise?.unit ?? 'KG');
  const [notes, setNotes] = useState(editExercise?.notes ?? '');
  // Current best for the selected exercise ("Current PR: 60 KG × 5").
  const [currentPr, setCurrentPr] = useState<ExercisePr | null>(null);

  // Initialise sets — from existing exercise if editing, else one empty row
  const [setRows, setSetRows] = useState<SetRow[]>(() => {
    if (editExercise && editExercise.sets.length > 0) {
      return editExercise.sets.map(s => ({
        id:     s.id,
        reps:   s.reps   != null ? String(s.reps)   : '',
        weight: s.weight != null ? String(s.weight) : '',
      }));
    }
    return [emptyRow()];
  });

  const [saving,        setSaving]        = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [prSets,        setPrSets]        = useState<SetPrResult[]>([]);
  // set ids that are *currently* record holders (live, from exercise_set_pr_flags) —
  // separate from prSets above, which only reflects the moment a save just happened.
  const [recordSetIds, setRecordSetIds] = useState<Set<number>>(new Set());

  // Restore last-used unit on first open (skip if editing)
  useEffect(() => {
    if (isEditing) return;
    AsyncStorage.getItem(UNIT_KEY).then(saved => {
      if (saved === 'KG' || saved === 'LBS') setUnit(saved);
    });
  }, []);

  // Fetch the current PR for whatever exercise is selected — the small
  // "Current PR" chip under the picker field. Best-effort: a failure just
  // means no chip.
  useEffect(() => {
    if (!selectedDef) { setCurrentPr(null); return; }
    let stale = false;
    catalogApi.getPr(selectedDef.id)
      .then(pr => { if (!stale) setCurrentPr(pr); })
      .catch(() => { if (!stale) setCurrentPr(null); });
    return () => { stale = true; };
  }, [selectedDef?.id]);

  // Load live "currently a record" flags for the sets being edited. A brand-new
  // exercise has no prior sets to check, so this only applies when editing.
  useEffect(() => {
    if (!isEditing || !editExercise) return;
    workoutApi.getSetRecordFlags(editExercise.id).then(flags => {
      const ids = flags
        .filter(f => f.is_weight_pr || f.is_e1rm_pr)
        .map(f => f.set_id);
      setRecordSetIds(new Set(ids));
    }).catch(() => {
      // Best-effort — a failed fetch here just means no live badges show, it
      // shouldn't block editing/saving the exercise.
    });
  }, [isEditing, editExercise]);

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
    haptics.tap();
    setSetRows(prev => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    if (setRows.length <= 1) return; // keep at least one
    haptics.tap();
    setSetRows(prev => prev.filter((_, i) => i !== index));
  };

  const selectUnit = (u: WeightUnit) => {
    haptics.tap();
    setUnit(u);
  };

  // ── Validation ───────────────────────────────────────────────
  const validate = (): string | null => {
    if (!selectedDef) return 'Please choose an exercise from the catalog.';
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
        name:  selectedDef!.name,
        date,
        unit,
        notes: notes.trim() || null,
        sets,
        exerciseDefId: selectedDef!.id,
      };

      const { prSets: newPrSets } = isEditing && editExercise
        ? await workoutApi.update(editExercise.id, payload)
        : await workoutApi.create(payload);

      haptics.success();

      const hasPr = newPrSets.some(s => s.is_weight_pr || s.is_e1rm_pr);
      if (hasPr) {
        // Save has already completed — this is a deliberate pause so the
        // PR badge is visible before the screen navigates away, not added
        // latency on the save itself.
        setPrSets(newPrSets);
        await new Promise(resolve => setTimeout(resolve, 800));
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
            <Feather name="calendar" size={13} color={COLORS.primary} />
            <Text style={styles.datePillText}>
              {dayFull} — {parseDateStr(date).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Text>
          </View>

          {/* ── Exercise card ── */}
          <View style={styles.sectionCard}>
            <Text style={formStyles.label}>Exercise</Text>
            <TouchableOpacity
              style={styles.pickerField}
              onPress={() => {
                haptics.tap();
                Keyboard.dismiss();
                setPickerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Feather name="grid" size={15} color={COLORS.primary} />
              <Text style={selectedDef ? styles.pickerFieldText : styles.pickerFieldPlaceholder}>
                {selectedDef
                  ? selectedDef.name
                  : editExercise
                    ? `"${editExercise.name}" — pick its catalog exercise`
                    : 'Choose an exercise'}
              </Text>
              <Feather name="chevron-down" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>

            {currentPr?.best_weight ? (
              <View style={styles.prChip}>
                <Feather name="award" size={12} color={COLORS.success} />
                <Text style={styles.prChipText}>
                  Current PR: {currentPr.best_weight.weight} {currentPr.best_weight.unit}
                  {currentPr.best_weight.reps != null ? ` × ${currentPr.best_weight.reps}` : ''}
                </Text>
              </View>
            ) : null}

            {/* Unit toggle (KG / LBS) */}
            <Text style={formStyles.label}>Weight Unit</Text>
            <View style={styles.unitToggle}>
              {(['KG', 'LBS'] as WeightUnit[]).map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                  onPress={() => selectUnit(u)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Sets card ── */}
          <View style={styles.sectionCard}>
            <View style={styles.setsHeader}>
              <Text style={formStyles.label}>Sets</Text>
              <View style={styles.setsCountBubble}>
                <Text style={styles.setsCount}>{setRows.length}</Text>
              </View>
            </View>

            {/* Column headings */}
            <View style={styles.setRowHeader}>
              <Text style={[styles.setRowHeaderText, { width: 36 }]}>#</Text>
              <Text style={[styles.setRowHeaderText, { flex: 1 }]}>Reps</Text>
              <Text style={[styles.setRowHeaderText, { flex: 1 }]}>Weight ({unit})</Text>
              <View style={{ width: 36 }} />
            </View>

            {/* The set rows */}
            {setRows.map((row, i) => {
              const pr = prSets.find(s => s.set_number === i + 1);
              const isPr = (!!pr && (pr.is_weight_pr || pr.is_e1rm_pr))
                || (row.id != null && recordSetIds.has(row.id));
              return (
              <View key={i} style={styles.setRow}>
                <View style={styles.setNumberBadge}>
                  <Text style={styles.setNumber}>{i + 1}</Text>
                  {isPr && (
                    <View style={styles.prBadge}>
                      <Feather name="award" size={11} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                <TextInput
                  style={[formStyles.input, styles.setInput]}
                  value={row.reps}
                  onChangeText={v => updateRow(i, 'reps', v)}
                  placeholder="—"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  returnKeyType="next"
                />

                <TextInput
                  style={[formStyles.input, styles.setInput]}
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
                  <Feather name="minus" size={17} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
              );
            })}

            {/* Add set button */}
            <TouchableOpacity
              style={styles.addSetBtn}
              onPress={addRow}
              activeOpacity={0.7}
              disabled={setRows.length >= 100}
            >
              <Feather name="plus" size={15} color={COLORS.primary} />
              <Text style={styles.addSetBtnText}>Add Set</Text>
            </TouchableOpacity>
          </View>

          {/* ── Notes card ── */}
          <View style={styles.sectionCard}>
            <Text style={formStyles.label}>
              Notes <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={[formStyles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Felt strong today, paused reps"
              placeholderTextColor={COLORS.textMuted}
              multiline
              returnKeyType="default"
              maxLength={500}
            />
          </View>

          {/* ── Save button ── */}
          <GradientButton
            title={isEditing ? 'Save Changes' : 'Log Exercise'}
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(def: ExerciseDef) => {
          setSelectedDef({ id: def.id, name: def.name });
          setPickerVisible(false);
        }}
      />
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
    padding:       16,
    paddingBottom: 40,
  },
  datePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               7,
    alignSelf:         'flex-start',
    backgroundColor:   COLORS.primaryBg,
    borderRadius:      RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical:    7,
    marginBottom:      16,
    borderWidth:        1,
    borderColor:        COLORS.primary,
  },
  datePillText: {
    fontFamily: FONT.semibold,
    color:      COLORS.primary,
    fontSize:   13,
  },
  sectionCard: {
    backgroundColor: COLORS.bgAlt,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      COLORS.cardBorder,
    padding:         16,
    marginBottom:    14,
  },
  pickerField: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.md,
    borderWidth:        1,
    borderColor:        COLORS.border,
    paddingHorizontal: 14,
    paddingVertical:   14,
    marginBottom:      12,
  },
  pickerFieldText: {
    flex:       1,
    fontFamily: FONT.semibold,
    fontSize:   15,
    color:      COLORS.text,
  },
  pickerFieldPlaceholder: {
    flex:       1,
    fontFamily: FONT.medium,
    fontSize:   14,
    color:      COLORS.textMuted,
  },
  prChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    alignSelf:         'flex-start',
    backgroundColor:   COLORS.successBg,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        COLORS.success,
    paddingHorizontal: 10,
    paddingVertical:    4,
    marginBottom:      12,
  },
  prChipText: {
    fontFamily: FONT.bold,
    fontSize:   12,
    color:      COLORS.success,
  },
  optional: {
    color:         COLORS.textMuted,
    textTransform: 'none',
  },
  unitToggle: {
    flexDirection:   'row',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.md,
    borderWidth:      1,
    borderColor:      COLORS.border,
    padding:          4,
    alignSelf:       'flex-start',
  },
  unitBtn: {
    paddingHorizontal: 20,
    paddingVertical:   10,
    minWidth:          64,
    alignItems:        'center',
    borderRadius:      RADIUS.sm,
  },
  unitBtnActive: {
    backgroundColor: COLORS.primary,
  },
  unitBtnText: {
    fontFamily: FONT.bold,
    fontSize:   14,
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
  },
  setsCountBubble: {
    backgroundColor:   COLORS.primaryBg,
    borderRadius:      RADIUS.pill,
    minWidth:          24,
    height:            24,
    paddingHorizontal: 7,
    alignItems:        'center',
    justifyContent:    'center',
    marginBottom:      8,
  },
  setsCount: {
    fontFamily: FONT.bold,
    fontSize:   12,
    color:      COLORS.primary,
  },
  setRowHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  6,
  },
  setRowHeaderText: {
    fontFamily:    FONT.medium,
    fontSize:      10,
    color:         COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign:     'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  8,
  },
  setNumberBadge: {
    width:           36,
    height:          36,
    borderRadius:    RADIUS.sm,
    backgroundColor: COLORS.card,
    borderWidth:      1,
    borderColor:      COLORS.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  prBadge: {
    position:        'absolute',
    top:              -6,
    right:            -6,
    width:            18,
    height:           18,
    borderRadius:     9,
    backgroundColor:  COLORS.success,
    borderWidth:       2,
    borderColor:       COLORS.bgAlt,
    alignItems:       'center',
    justifyContent:   'center',
  },
  setNumber: {
    fontFamily: FONT.bold,
    fontSize:   14,
    color:      COLORS.textSub,
  },
  setInput: {
    flex:            1,
    marginBottom:    0,
    paddingVertical: 12,
    textAlign:       'center',
  },
  removeBtn: {
    width:           36,
    height:          36,
    borderRadius:    RADIUS.sm,
    backgroundColor: COLORS.dangerBg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  removeBtnDisabled: {
    opacity: 0.3,
  },
  addSetBtn: {
    flexDirection:   'row',
    gap:             6,
    marginTop:       8,
    paddingVertical: 12,
    borderRadius:    RADIUS.md,
    borderWidth:      1,
    borderStyle:     'dashed',
    borderColor:      COLORS.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  addSetBtnText: {
    fontFamily:    FONT.bold,
    fontSize:      14,
    color:         COLORS.primary,
    letterSpacing: 0.4,
  },
  notesInput: {
    height:            90,
    textAlignVertical: 'top',
    marginBottom:      0,
  },
  saveBtn: {
    marginTop: 4,
  },
});
