import React, { useMemo, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { accountApi } from '../services/moderation';
import { haptics } from '../utils/haptics';

/** The word the user has to type to arm the delete button. */
const CONFIRM_WORD = 'DELETE';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Permanent account deletion (Guideline 5.1.1(v)).
 *
 *  Deliberately spells out exactly what is erased before asking for a
 *  typed confirmation. The guideline wants deletion to be easy to
 *  *find*, not easy to do by accident — this is one tap from Settings,
 *  and irreversible once confirmed.
 *
 *  A typed word rather than Alert.prompt, which is iOS-only. */
export function DeleteAccountModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [confirm,  setConfirm]  = useState('');
  const [deleting, setDeleting] = useState(false);

  const armed = confirm.trim().toUpperCase() === CONFIRM_WORD;

  const close = () => {
    if (deleting) return;
    setConfirm('');
    onClose();
  };

  const handleDelete = async () => {
    if (!armed || deleting) return;
    setDeleting(true);
    try {
      await accountApi.deleteAccount();
      haptics.success();
      // No navigation needed: deleteAccount clears the local session, and
      // the auth listener in App.tsx swaps the stack back to Login.
    } catch (e) {
      setDeleting(false);
      Alert.alert(
        'Could not delete your account',
        (e as Error).message ?? 'Please check your connection and try again.',
      );
    }
  };

  return (
    <Modal
      visible={visible}
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
          <Text style={styles.headerTitle}>Delete Account</Text>
          <TouchableOpacity
            onPress={close}
            disabled={deleting}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Feather name="x" size={22} color={colors.textSub} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.warnTile}>
            <Feather name="alert-triangle" size={22} color={colors.danger} />
          </View>

          <Text style={styles.lede}>
            This permanently deletes your account. It cannot be undone, and we cannot
            recover anything afterwards.
          </Text>

          <Text style={styles.sectionLabel}>WHAT GETS ERASED</Text>
          <View style={styles.list}>
            {[
              'Every workout, set and personal record you have logged',
              'Your workout presets',
              'Any custom exercises you created',
              'Your profile, username and display name',
              'Your posts, comments and likes',
              'Your friendships and pending friend requests',
            ].map(line => (
              <View key={line} style={styles.listRow}>
                <Feather name="x" size={14} color={colors.danger} style={styles.listIcon} />
                <Text style={styles.listText}>{line}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.note}>
            Prefer to step away without losing your log? Sign out instead — your data stays
            put and you can sign back in any time.
          </Text>

          <Text style={styles.sectionLabel}>TYPE {CONFIRM_WORD} TO CONFIRM</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
            returnKeyType="done"
            onSubmitEditing={handleDelete}
          />

          <TouchableOpacity
            style={[styles.deleteBtn, !armed && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={!armed || deleting}
            activeOpacity={0.8}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteBtnText}>Delete my account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={close}
            disabled={deleting}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
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
  warnTile: {
    width:           48,
    height:          48,
    borderRadius:    RADIUS.md,
    backgroundColor: colors.dangerBg,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  lede: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.text,
  },
  sectionLabel: {
    fontFamily:    FONT.semibold,
    fontSize:      11,
    color:         colors.textMuted,
    letterSpacing: 1,
    marginTop:     26,
    marginBottom:   10,
  },
  list: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    padding:         14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:   8,
  },
  listIcon: {
    marginTop:   3,
    marginRight: 10,
  },
  listText: {
    flex:       1,
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textSub,
  },
  note: {
    marginTop:  18,
    fontSize:   13,
    lineHeight: 19,
    color:      colors.textMuted,
  },
  input: {
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.md,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingHorizontal: 16,
    paddingVertical:   14,
    color:             colors.text,
    fontFamily:        FONT.semibold,
    fontSize:          16,
    letterSpacing:     2,
  },
  deleteBtn: {
    marginTop:       20,
    backgroundColor: colors.danger,
    borderRadius:    RADIUS.md,
    paddingVertical: 16,
    alignItems:      'center',
  },
  deleteBtnDisabled: {
    opacity: 0.4,
  },
  deleteBtnText: {
    fontFamily: FONT.bold,
    fontSize:   16,
    color:      '#fff',
  },
  cancelBtn: {
    marginTop:  14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 15,
    color:    colors.textSub,
  },
});
