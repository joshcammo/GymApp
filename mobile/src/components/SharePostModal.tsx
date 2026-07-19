import React, { useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { formStyles } from '../constants/formStyles';
import { Exercise } from '../types';
import { postsApi } from '../services/social';
import { GradientButton } from './GradientButton';
import { haptics } from '../utils/haptics';

interface Props {
  /** The exercise being shared; null while the modal is closed/animating out. */
  exercise: Exercise | null;
  onClose:  () => void;
  onShared: () => void;
}

/** The set that share_post() will pick server-side: heaviest weight, most reps as tie-break. */
function bestSet(exercise: Exercise) {
  const weighted = exercise.sets.filter(s => s.weight != null);
  if (weighted.length === 0) return null;
  return weighted.reduce((best, s) =>
    (s.weight! > best.weight! || (s.weight === best.weight && (s.reps ?? 0) > (best.reps ?? 0))) ? s : best
  );
}

export function SharePostModal({ exercise, onClose, onShared }: Props) {
  const [caption,    setCaption]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  const preview = exercise ? bestSet(exercise) : null;

  const handleClose = () => {
    if (submitting) return;
    setCaption('');
    onClose();
  };

  const handleShare = async () => {
    if (!exercise || submitting) return;
    setSubmitting(true);
    try {
      await postsApi.share(exercise.id, caption);
      haptics.success();
      setCaption('');
      onShared();
    } catch (e) {
      Alert.alert('Could not share', (e as Error).message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={!!exercise}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <View style={styles.headerBtn} />
            <Text style={styles.headerTitle}>Share Lift</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.headerBtn}
            >
              <Feather name="x" size={22} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {exercise && preview && (
              <View style={styles.previewCard}>
                <View style={styles.previewTopRow}>
                  <Feather name="award" size={14} color={COLORS.primary} />
                  <Text style={styles.previewName}>{exercise.name}</Text>
                </View>
                <Text style={styles.previewSet}>
                  {preview.reps ? `${preview.reps} × ${preview.weight} ${exercise.unit}` : `${preview.weight} ${exercise.unit}`}
                </Text>
              </View>
            )}

            <Text style={formStyles.label}>Caption (optional)</Text>
            <TextInput
              style={[formStyles.input, styles.captionInput]}
              value={caption}
              onChangeText={setCaption}
              placeholder="How'd it feel?"
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={280}
              textAlignVertical="top"
            />

            <GradientButton
              title="Share to Friends"
              icon="share-2"
              onPress={handleShare}
              loading={submitting}
              disabled={!preview}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  flexFill: { flex: 1 },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth:  1,
    borderBottomColor:  COLORS.divider,
  },
  headerBtn: {
    width:      32,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONT.semibold,
    fontSize:   17,
    color:      COLORS.text,
  },
  content: {
    padding: 16,
  },
  previewCard: {
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.lg,
    borderWidth:        1,
    borderColor:        COLORS.cardBorder,
    padding:           16,
    marginBottom:      20,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
  },
  previewName: {
    fontFamily: FONT.semibold,
    fontSize:   16,
    color:      COLORS.text,
  },
  previewSet: {
    fontFamily: FONT.bold,
    fontSize:   22,
    color:      COLORS.primary,
    marginTop:  8,
  },
  captionInput: {
    height:     90,
    paddingTop: 14,
  },
});
