import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, FlatList, Image, TextInput,
  TouchableOpacity, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { EXERCISE_IMAGES } from '../constants/exerciseImages';
import { MUSCLE_GROUPS, muscleGroupLabel } from '../constants/muscleGroups';
import { ExerciseDef, MuscleGroup } from '../types';
import { catalogApi, CustomSuggestion } from '../services/api';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  /** Called with the chosen catalog/custom exercise; caller closes the modal. */
  onSelect: (def: ExerciseDef) => void;
}

const EQUIPMENT: { key: string; label: string }[] = [
  { key: 'BARBELL',    label: 'Barbell' },
  { key: 'DUMBBELL',   label: 'Dumbbell' },
  { key: 'MACHINE',    label: 'Machine' },
  { key: 'CABLE',      label: 'Cable' },
  { key: 'BODYWEIGHT', label: 'Bodyweight' },
  { key: 'KETTLEBELL', label: 'Kettlebell' },
  { key: 'BAND',       label: 'Band' },
  { key: 'OTHER',      label: 'Other' },
];

/** Illustration if we have one, otherwise a placeholder icon tile. */
function DefThumb({ def }: { def: ExerciseDef }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const source = def.image_key ? EXERCISE_IMAGES[def.image_key] : undefined;
  if (source) return <Image source={source} style={styles.thumb} />;
  return (
    <View style={[styles.thumb, styles.thumbFallback]}>
      <Feather name="activity" size={22} color={colors.textMuted} />
    </View>
  );
}

// Module-level cache: the catalog rarely changes within a session, and
// re-opening the picker shouldn't refetch 100+ rows every time.
let defsCache: ExerciseDef[] | null = null;

/**
 * Catalog-first exercise picker: muscle groups -> illustrated exercises,
 * searchable, with a guarded "add custom" escape hatch. Selecting always
 * yields an ExerciseDef — free-text names are no longer possible.
 */
export function ExercisePickerModal({ visible, onClose, onSelect }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [defs,    setDefs]    = useState<ExerciseDef[] | null>(defsCache);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [group,  setGroup]  = useState<MuscleGroup | null>(null);
  const [search, setSearch] = useState('');

  // Custom-exercise form state
  const [customVisible,   setCustomVisible]   = useState(false);
  const [customName,      setCustomName]      = useState('');
  const [customGroup,     setCustomGroup]     = useState<MuscleGroup | null>(null);
  const [customEquipment, setCustomEquipment] = useState<string | null>(null);
  const [creating,        setCreating]        = useState(false);
  const [suggestions,     setSuggestions]     = useState<CustomSuggestion[] | null>(null);

  const loadDefs = () => {
    setLoading(true);
    setError(null);
    catalogApi.list()
      .then(list => { defsCache = list; setDefs(list); })
      .catch(e => setError((e as Error).message ?? 'Could not load exercises'))
      .finally(() => setLoading(false));
  };

  // Reset navigation state when the picker opens (not when it closes) —
  // resetting on close makes the content visibly flip back during the
  // slide-down animation. Also (re)fetch the catalog if we don't have it.
  useEffect(() => {
    if (!visible) return;
    setGroup(null);
    setSearch('');
    setCustomVisible(false);
    setSuggestions(null);
    if (!defsCache) loadDefs();
  }, [visible]);

  const pick = (def: ExerciseDef) => {
    haptics.tap();
    onSelect(def);
  };

  const openCustomForm = () => {
    haptics.tap();
    setCustomName(search.trim());
    setCustomGroup(group);
    setCustomEquipment(null);
    setSuggestions(null);
    setCustomVisible(true);
  };

  const submitCustom = async (force: boolean) => {
    if (!customName.trim() || !customGroup || !customEquipment) return;
    setCreating(true);
    try {
      const result = await catalogApi.createCustom(
        customName, customGroup, customEquipment, force,
      );
      if (result.created) {
        const def: ExerciseDef = {
          id:               result.def.id,
          name:             result.def.name,
          muscle_group:     result.def.muscle_group,
          equipment:        result.def.equipment,
          movement_pattern: null,
          image_key:        null,
          is_custom:        true,
        };
        defsCache = [...(defsCache ?? []), def];
        setDefs(defsCache);
        haptics.success();
        onSelect(def);
      } else {
        haptics.warning();
        setSuggestions(result.suggestions);
      }
    } catch (e) {
      setError((e as Error).message ?? 'Could not create exercise');
    } finally {
      setCreating(false);
    }
  };

  /** Resolve a suggestion back to a full def (it's always a visible def). */
  const pickSuggestion = (s: CustomSuggestion) => {
    const def = defs?.find(d => d.id === s.id) ?? {
      id: s.id, name: s.name, muscle_group: s.muscle_group,
      equipment: 'OTHER', movement_pattern: null, image_key: null,
      is_custom: s.is_custom,
    };
    pick(def);
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !defs) return null;
    return defs.filter(d => d.name.toLowerCase().includes(q));
  }, [search, defs]);

  const groupDefs = useMemo(() => {
    if (!group || !defs) return null;
    return defs.filter(d => d.muscle_group === group);
  }, [group, defs]);

  const groupCounts = useMemo(() => {
    const counts = new Map<MuscleGroup, number>();
    for (const d of defs ?? []) counts.set(d.muscle_group, (counts.get(d.muscle_group) ?? 0) + 1);
    return counts;
  }, [defs]);

  /** First exercise with art in a group — used as the group tile image. */
  const groupThumb = (g: MuscleGroup): ExerciseDef | undefined =>
    defs?.find(d => d.muscle_group === g && d.image_key && EXERCISE_IMAGES[d.image_key]);

  // Android hardware-back steps up one level; on iOS onRequestClose fires
  // after a pageSheet swipe-dismiss, when the sheet is already natively
  // gone — anything but a full close would desync `visible` from reality
  // and permanently block reopening.
  const handleRequestClose =
    Platform.OS === 'android' && (customVisible || group || search)
      ? () => {
          if (suggestions) setSuggestions(null);
          else if (customVisible) setCustomVisible(false);
          else if (search) setSearch('');
          else setGroup(null);
        }
      : onClose;

  const title = customVisible
    ? 'Custom Exercise'
    : group ? muscleGroupLabel(group) : 'Exercises';

  const showBack = customVisible || !!group;

  const renderDefRow = ({ item }: { item: ExerciseDef }) => (
    <PressableScale style={styles.row} onPress={() => pick(item)} pressScale={0.98}>
      <DefThumb def={item} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowSub}>
          {muscleGroupLabel(item.muscle_group)}
          {item.is_custom ? '  ·  custom' : ''}
        </Text>
      </View>
      <Feather name="plus" size={18} color={colors.primary} />
    </PressableScale>
  );

  const customFooter = (
    <TouchableOpacity style={styles.customBtn} onPress={openCustomForm} activeOpacity={0.7}>
      <Feather name="plus-circle" size={15} color={colors.primary} />
      <Text style={styles.customBtnText}>Can't find it? Add a custom exercise</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleRequestClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          {showBack ? (
            <TouchableOpacity
              onPress={() => {
                if (suggestions) setSuggestions(null);
                else if (customVisible) setCustomVisible(false);
                else setGroup(null);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.headerBtn}
            >
              <Feather name="chevron-left" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn} />
          )}
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Feather name="x" size={22} color={colors.textSub} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centred}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadDefs}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : customVisible ? (
          /* ── Custom exercise form ── */
          <FlatList
            data={suggestions ?? []}
            keyExtractor={s => String(s.id)}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View>
                <Text style={styles.formLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={customName}
                  onChangeText={v => { setCustomName(v); setSuggestions(null); }}
                  placeholder="e.g. Landmine Press"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
                <Text style={styles.formLabel}>Muscle Group</Text>
                <View style={styles.chipWrap}>
                  {MUSCLE_GROUPS.map(g => (
                    <TouchableOpacity
                      key={g.key}
                      style={[styles.chip, customGroup === g.key && styles.chipActive]}
                      onPress={() => { haptics.tap(); setCustomGroup(g.key); }}
                    >
                      <Text style={[styles.chipText, customGroup === g.key && styles.chipTextActive]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.formLabel}>Equipment</Text>
                <View style={styles.chipWrap}>
                  {EQUIPMENT.map(eq => (
                    <TouchableOpacity
                      key={eq.key}
                      style={[styles.chip, customEquipment === eq.key && styles.chipActive]}
                      onPress={() => { haptics.tap(); setCustomEquipment(eq.key); }}
                    >
                      <Text style={[styles.chipText, customEquipment === eq.key && styles.chipTextActive]}>
                        {eq.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {suggestions ? (
                  <Text style={styles.didYouMean}>
                    Similar exercises already exist — did you mean one of these?
                  </Text>
                ) : null}
              </View>
            }
            renderItem={({ item: s }) => (
              <PressableScale
                style={styles.row}
                onPress={() => pickSuggestion(s)}
                pressScale={0.98}
              >
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Feather name="corner-up-left" size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{s.name}</Text>
                  <Text style={styles.rowSub}>
                    {muscleGroupLabel(s.muscle_group)}{s.is_custom ? '  ·  custom' : ''}
                  </Text>
                </View>
                <Feather name="plus" size={18} color={colors.primary} />
              </PressableScale>
            )}
            ListFooterComponent={
              <TouchableOpacity
                style={[styles.createBtn,
                  (!customName.trim() || !customGroup || !customEquipment || creating) && styles.createBtnDisabled]}
                disabled={!customName.trim() || !customGroup || !customEquipment || creating}
                onPress={() => submitCustom(!!suggestions)}
                activeOpacity={0.8}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.createBtnText}>
                    {suggestions ? `None of these — create "${customName.trim()}"` : 'Create Exercise'}
                  </Text>
                )}
              </TouchableOpacity>
            }
          />
        ) : (
          /* ── Browse: search + groups / group contents ── */
          <View style={{ flex: 1 }}>
            <View style={styles.searchWrap}>
              <Feather name="search" size={15} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search all exercises"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x-circle" size={15} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {searchResults ? (
              <FlatList
                data={searchResults}
                keyExtractor={d => String(d.id)}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                renderItem={renderDefRow}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No exercises match "{search.trim()}"</Text>
                }
                ListFooterComponent={customFooter}
              />
            ) : group ? (
              <FlatList
                data={groupDefs ?? []}
                keyExtractor={d => String(d.id)}
                contentContainerStyle={styles.listContent}
                renderItem={renderDefRow}
                ListFooterComponent={customFooter}
              />
            ) : (
              <FlatList
                data={MUSCLE_GROUPS}
                keyExtractor={g => g.key}
                contentContainerStyle={styles.listContent}
                renderItem={({ item: g }) => {
                  const thumbDef = groupThumb(g.key);
                  return (
                    <PressableScale
                      style={styles.row}
                      onPress={() => { haptics.tap(); setGroup(g.key); }}
                      pressScale={0.98}
                    >
                      {thumbDef ? (
                        <Image source={EXERCISE_IMAGES[thumbDef.image_key!]} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbFallback]}>
                          <Feather name="activity" size={22} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>{g.label}</Text>
                        <Text style={styles.rowSub}>{groupCounts.get(g.key) ?? 0} exercises</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={colors.textMuted} />
                    </PressableScale>
                  );
                }}
                ListFooterComponent={customFooter}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth:  1,
    borderBottomColor:  colors.divider,
  },
  headerBtn: {
    width:      32,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONT.semibold,
    fontSize:   17,
    color:      colors.text,
  },
  centred: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            14,
  },
  errorText: {
    color:             colors.textSub,
    fontSize:          14,
    textAlign:         'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    backgroundColor:   colors.primaryBg,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        colors.primary,
    paddingHorizontal: 18,
    paddingVertical:    8,
  },
  retryText: {
    fontFamily: FONT.bold,
    fontSize:   13,
    color:      colors.primary,
  },
  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    marginHorizontal:  16,
    marginTop:         12,
    paddingHorizontal: 12,
    paddingVertical:   Platform.OS === 'ios' ? 10 : 4,
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.md,
    borderWidth:        1,
    borderColor:        colors.border,
  },
  searchInput: {
    flex:       1,
    fontFamily: FONT.medium,
    fontSize:   15,
    color:      colors.text,
    padding:    0,
  },
  listContent: {
    padding: 16,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.lg,
    padding:           10,
    paddingRight:      16,
    marginBottom:      10,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
  },
  thumb: {
    width:           56,
    height:          56,
    borderRadius:    RADIUS.md,
    backgroundColor: colors.bgAlt,
  },
  thumbFallback: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONT.medium,
    fontSize:   16,
    color:      colors.text,
  },
  rowSub: {
    fontSize:  12,
    color:     colors.textMuted,
    marginTop:  2,
  },
  emptyText: {
    color:      colors.textMuted,
    fontSize:   14,
    textAlign:  'center',
    marginTop:  24,
  },
  customBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             7,
    marginTop:       6,
    paddingVertical: 14,
    borderRadius:    RADIUS.md,
    borderWidth:      1,
    borderStyle:     'dashed',
    borderColor:      colors.border,
  },
  customBtnText: {
    fontFamily: FONT.bold,
    fontSize:   13,
    color:      colors.primary,
  },
  // ── Custom form ──
  formLabel: {
    fontFamily:    FONT.medium,
    fontSize:      11,
    color:         colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom:  8,
    marginTop:     14,
  },
  input: {
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.md,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingHorizontal: 14,
    paddingVertical:   12,
    fontFamily:        FONT.medium,
    fontSize:          15,
    color:             colors.text,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  chip: {
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingHorizontal: 13,
    paddingVertical:    7,
  },
  chipActive: {
    backgroundColor: colors.primaryBg,
    borderColor:     colors.primary,
  },
  chipText: {
    fontFamily: FONT.medium,
    fontSize:   13,
    color:      colors.textSub,
  },
  chipTextActive: {
    color:      colors.primary,
    fontFamily: FONT.bold,
  },
  didYouMean: {
    fontFamily: FONT.semibold,
    fontSize:   14,
    color:      colors.text,
    marginTop:  20,
    marginBottom: 10,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius:    RADIUS.md,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       20,
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    fontFamily: FONT.bold,
    fontSize:   15,
    color:      '#FFFFFF',
  },
});
