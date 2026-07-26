import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { useFormStyles } from '../constants/formStyles';
import { RootStackParamList, CardioActivityType } from '../types';
import { cardioApi } from '../services/api';
import { GradientButton } from '../components/GradientButton';
import { haptics } from '../utils/haptics';
import { parseDateStr } from '../utils/dateUtils';
import { CARDIO_ACTIVITY_META, CARDIO_ACTIVITY_TYPES } from '../utils/cardioFormat';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'AddCardio'>;
type Route = RouteProp<RootStackParamList, 'AddCardio'>;
interface Props { navigation: Nav; route: Route }

export function AddCardioScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const formStyles = useFormStyles();
  const { date, dayFull, editSession } = route.params;
  const isEditing = !!editSession;

  const [activityType, setActivityType] = useState<CardioActivityType>(
    editSession?.activity_type ?? 'run'
  );
  const [durationMin, setDurationMin] = useState(
    editSession ? String(Math.round(editSession.duration_seconds / 60)) : ''
  );
  const [distanceKm, setDistanceKm] = useState(
    editSession?.distance_meters != null ? String(editSession.distance_meters / 1000) : ''
  );
  const [notes,   setNotes]   = useState(editSession?.notes ?? '');
  const [saving,  setSaving]  = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Cardio' : 'Add Cardio',
    });
  }, [navigation, isEditing]);

  // ── Validation ───────────────────────────────────────────────
  const validate = (): string | null => {
    if (!durationMin || isNaN(+durationMin) || +durationMin <= 0) {
      return 'Enter a duration greater than 0 minutes.';
    }
    if (+durationMin > 1440) {
      return 'Duration must be 24 hours (1440 min) or less.';
    }
    if (distanceKm && (isNaN(+distanceKm) || +distanceKm < 0)) {
      return 'Distance must be 0 or higher.';
    }
    return null;
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing info', err); return; }

    setSaving(true);
    try {
      const dto = {
        activityType,
        date,
        durationSeconds: Math.round(+durationMin * 60),
        distanceMeters:  distanceKm ? Math.round(+distanceKm * 1000) : null,
        notes:           notes.trim() || null,
      };

      if (isEditing && editSession) {
        await cardioApi.update(editSession.id, dto);
      } else {
        await cardioApi.create(dto);
      }

      haptics.success();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not save cardio session. Check your connection.');
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
            <Feather name="calendar" size={13} color={colors.primary} />
            <Text style={styles.datePillText}>
              {dayFull}, {parseDateStr(date).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Text>
          </View>

          {/* ── Activity card ── */}
          <View style={styles.sectionCard}>
            <Text style={formStyles.label}>Activity</Text>
            <View style={styles.activityGrid}>
              {CARDIO_ACTIVITY_TYPES.map(type => {
                const meta = CARDIO_ACTIVITY_META[type];
                const active = activityType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.activityPill, active && styles.activityPillActive]}
                    onPress={() => { haptics.tap(); setActivityType(type); }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={meta.icon}
                      size={18}
                      color={active ? '#FFFFFF' : colors.textSub}
                    />
                    <Text style={[styles.activityPillText, active && styles.activityPillTextActive]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={formStyles.label}>Duration (minutes)</Text>
            <TextInput
              style={formStyles.input}
              value={durationMin}
              onChangeText={setDurationMin}
              placeholder="e.g. 30"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              returnKeyType="next"
            />

            <Text style={formStyles.label}>
              Distance (km) <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={formStyles.input}
              value={distanceKm}
              onChangeText={setDistanceKm}
              placeholder="e.g. 5.2"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
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
              placeholder="e.g. Easy pace, felt good"
              placeholderTextColor={colors.textMuted}
              multiline
              returnKeyType="default"
              maxLength={500}
            />
          </View>

          {/* ── Save button ── */}
          <GradientButton
            title={isEditing ? 'Save Changes' : 'Log Cardio'}
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
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
    backgroundColor:   colors.primaryBg,
    borderRadius:      RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical:    7,
    marginBottom:      16,
    borderWidth:        1,
    borderColor:        colors.primary,
  },
  datePillText: {
    fontFamily: FONT.semibold,
    color:      colors.primary,
    fontSize:   13,
  },
  sectionCard: {
    backgroundColor: colors.bgAlt,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    padding:         16,
    marginBottom:    14,
  },
  optional: {
    color:         colors.textMuted,
    textTransform: 'none',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    marginBottom:  18,
  },
  activityPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingHorizontal: 14,
    paddingVertical:    9,
  },
  activityPillActive: {
    backgroundColor: colors.primary,
    borderColor:     colors.primary,
  },
  activityPillText: {
    fontFamily: FONT.semibold,
    fontSize:   13,
    color:      colors.textSub,
  },
  activityPillTextActive: {
    color: '#FFFFFF',
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
