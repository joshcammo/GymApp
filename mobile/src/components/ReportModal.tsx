import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { ReportReason, ReportTarget, REPORT_REASONS } from '../types/moderation';
import { reportsApi } from '../services/moderation';
import { haptics } from '../utils/haptics';

const MAX_DETAILS = 500;

interface Props {
  /** The content being reported, or null when the sheet is closed. */
  target:  ReportTarget | null;
  onClose: () => void;
  /** Fired after a successful report. `blocked` is true if the author was also blocked. */
  onDone:  (target: ReportTarget, blocked: boolean) => void;
}

const NOUN: Record<ReportTarget['kind'], string> = {
  post:    'post',
  comment: 'comment',
  user:    'user',
};

/** Report objectionable content or an abusive user (Guideline 1.2).
 *
 *  Offers blocking in the same flow, because the two almost always go
 *  together: someone who has just seen something bad usually wants it
 *  gone from their feed as well as reviewed. */
export function ReportModal({ target, onClose, onDone }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reason,     setReason]     = useState<ReportReason | null>(null);
  const [details,    setDetails]    = useState('');
  const [alsoBlock,  setAlsoBlock]  = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset between openings so the next report doesn't inherit the last one.
  useEffect(() => {
    if (target) {
      setReason(null);
      setDetails('');
      setAlsoBlock(false);
      setSubmitting(false);
    }
  }, [target]);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async () => {
    if (!target || !reason || submitting) return;
    setSubmitting(true);
    try {
      // report-then-block ordering is handled inside reportAndBlock —
      // see services/moderation.ts.
      if (alsoBlock) await reportsApi.reportAndBlock(target, reason, details);
      else           await reportsApi.report(target, reason, details);
      haptics.success();
      onDone(target, alsoBlock);
      Alert.alert(
        'Thanks for telling us',
        alsoBlock
          ? "We review every report within 24 hours. You won't see this user's posts or comments any more."
          : 'We review every report within 24 hours and remove anything that breaks our rules.',
      );
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Could not send your report', (e as Error).message ?? 'Please try again.');
    }
  };

  const who = target?.authorName ? `@${target.authorName}` : 'this user';

  return (
    <Modal
      visible={!!target}
      animationType="slide"
      onRequestClose={close}
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerBtn} />
          <Text style={styles.headerTitle}>
            Report {target ? NOUN[target.kind] : ''}
          </Text>
          <TouchableOpacity
            onPress={close}
            disabled={submitting}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Feather name="x" size={22} color={colors.textSub} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.lede}>
            Tell us what's wrong and we'll review it within 24 hours. We never tell
            {' '}{who} who reported them.
          </Text>

          <Text style={styles.sectionLabel}>WHAT'S THE PROBLEM?</Text>
          <View style={styles.reasonList}>
            {REPORT_REASONS.map(({ value, label }, i) => {
              const selected = reason === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.reasonRow, i > 0 && styles.reasonRowDivided]}
                  onPress={() => { haptics.tap(); setReason(value); }}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={selected ? 'check-circle' : 'circle'}
                    size={18}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>ANYTHING ELSE? (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={details}
            onChangeText={t => setDetails(t.slice(0, MAX_DETAILS))}
            placeholder="Add any detail that would help us review this."
            placeholderTextColor={colors.textMuted}
            multiline
            editable={!submitting}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{details.length}/{MAX_DETAILS}</Text>

          <View style={styles.blockRow}>
            <View style={styles.blockText}>
              <Text style={styles.blockTitle}>Also block {who}</Text>
              <Text style={styles.blockSub}>
                You'll stop seeing each other's posts and comments, and they can't send you
                friend requests. You can undo this in Settings.
              </Text>
            </View>
            <Switch
              value={alsoBlock}
              onValueChange={v => { haptics.tap(); setAlsoBlock(v); }}
              disabled={submitting}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !reason && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={!reason || submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {alsoBlock ? 'Report and block' : 'Submit report'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  flexFill: {
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
  content: {
    padding:       20,
    paddingBottom: 40,
  },
  lede: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textSub,
  },
  sectionLabel: {
    fontFamily:    FONT.semibold,
    fontSize:      11,
    color:         colors.textMuted,
    letterSpacing: 1,
    marginTop:     24,
    marginBottom:   10,
  },
  reasonList: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    overflow:        'hidden',
  },
  reasonRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  reasonRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  reasonText: {
    flex:     1,
    fontSize: 15,
    color:    colors.textSub,
  },
  reasonTextActive: {
    fontFamily: FONT.medium,
    color:      colors.text,
  },
  input: {
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.md,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingHorizontal: 16,
    paddingVertical:   14,
    color:             colors.text,
    fontSize:          15,
    minHeight:         96,
  },
  counter: {
    marginTop:  6,
    fontSize:   11,
    color:      colors.textMuted,
    textAlign:  'right',
  },
  blockRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    marginTop:       22,
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    padding:         16,
  },
  blockText: {
    flex: 1,
  },
  blockTitle: {
    fontFamily: FONT.medium,
    fontSize:   15,
    color:      colors.text,
  },
  blockSub: {
    fontSize:   12,
    lineHeight: 17,
    color:      colors.textMuted,
    marginTop:   4,
  },
  submitBtn: {
    marginTop:       24,
    backgroundColor: colors.danger,
    borderRadius:    RADIUS.md,
    paddingVertical: 16,
    alignItems:      'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontFamily: FONT.bold,
    fontSize:   16,
    color:      '#fff',
  },
});
