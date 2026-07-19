import React, { useState, useMemo } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { useFormStyles } from '../constants/formStyles';
import { ShareTarget } from '../types';
import { postsApi } from '../services/social';
import { GradientButton } from './GradientButton';
import { haptics } from '../utils/haptics';

interface Props {
  /** What's being shared; null while the modal is closed/animating out. */
  target:   ShareTarget | null;
  onClose:  () => void;
  onShared: () => void;
}

/** Caption step for sharing a lift — the preview shown here is a snapshot for
 *  display only; share_post() independently re-derives the caller's current
 *  best set server-side at submit time (see migration 013). */
export function SharePostModal({ target, onClose, onShared }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const formStyles = useFormStyles();
  const [caption,    setCaption]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setCaption('');
    onClose();
  };

  const handleShare = async () => {
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      await postsApi.share(target.exerciseDefId, caption);
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
      visible={!!target}
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
              <Feather name="x" size={22} color={colors.textSub} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {target && (
              <View style={styles.previewCard}>
                <View style={styles.previewTopRow}>
                  <Feather name="award" size={14} color={colors.primary} />
                  <Text style={styles.previewName}>{target.exerciseName}</Text>
                </View>
                <Text style={styles.previewSet}>
                  {target.reps ? `${target.reps} × ${target.weight} ${target.unit}` : `${target.weight} ${target.unit}`}
                </Text>
              </View>
            )}

            <Text style={formStyles.label}>Caption (optional)</Text>
            <TextInput
              style={[formStyles.input, styles.captionInput]}
              value={caption}
              onChangeText={setCaption}
              placeholder="How'd it feel?"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={280}
              textAlignVertical="top"
            />

            <GradientButton
              title="Share to Friends"
              icon="share-2"
              onPress={handleShare}
              loading={submitting}
              disabled={!target}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  flexFill: { flex: 1 },
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
  content: {
    padding: 16,
  },
  previewCard: {
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.lg,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
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
    color:      colors.text,
  },
  previewSet: {
    fontFamily: FONT.bold,
    fontSize:   22,
    color:      colors.primary,
    marginTop:  8,
  },
  captionInput: {
    height:     90,
    paddingTop: 14,
  },
});
