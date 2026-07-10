import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../constants/colors';
import { authStyles } from '../constants/authStyles';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { GradientButton } from '../components/GradientButton';
import { haptics } from '../utils/haptics';

interface Props {
  /**
   * Called once the password has been updated, or if the user cancels —
   * either way the caller signs out the recovery session and returns to
   * Login. There's otherwise no way off this screen (e.g. an expired or
   * already-used recovery link would leave updateUser permanently failing).
   */
  onDone: () => void;
}

/**
 * Shown when the app is opened via a Supabase password-recovery deep link.
 * A valid (recovery) session already exists by the time this renders —
 * see the deep-link handler in App.tsx.
 */
export function ResetPasswordScreen({ onDone }: Props) {
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving,          setSaving]          = useState(false);

  const handleSave = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Missing info', 'Enter and confirm your new password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords don’t match', 'Double-check your password and try again.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      haptics.success();
      Alert.alert(
        'Password updated',
        'Your password has been changed. Please sign in again.',
        [{ text: 'OK', onPress: onDone }]
      );
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not update your password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    haptics.tap();
    Alert.alert(
      'Cancel password reset?',
      'You’ll need to request a new reset link to try again.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: onDone },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Logo size={72} withWordmark />
            <Text style={styles.subtitle}>Choose a new password for your account</Text>
          </View>

          <View style={authStyles.formCard}>
            <Text style={authStyles.label}>New Password</Text>
            <TextInput
              style={authStyles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              returnKeyType="next"
              autoFocus
            />

            <Text style={authStyles.label}>Confirm Password</Text>
            <TextInput
              style={authStyles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <GradientButton
              title="Update Password"
              onPress={handleSave}
              loading={saving}
              style={styles.saveBtn}
            />

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
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
  flexFill: { flex: 1 },
  content: {
    flexGrow:          1,
    justifyContent:    'center',
    paddingHorizontal: 24,
    paddingVertical:   32,
  },
  hero: {
    alignItems:   'center',
    marginBottom: 36,
  },
  subtitle: {
    marginTop:  12,
    fontSize:   14,
    color:      COLORS.textSub,
    textAlign:  'center',
  },
  saveBtn: {
    marginTop: 6,
  },
  cancelBtn: {
    marginTop:  16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 13,
    color:    COLORS.textSub,
  },
});
