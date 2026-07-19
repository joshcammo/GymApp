import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { RADIUS } from '../constants/theme';
import { useFormStyles } from '../constants/formStyles';
import { RootStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { GradientButton } from '../components/GradientButton';
import { haptics } from '../utils/haptics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ChangePassword'>;
interface Props { navigation: Nav }

export function ChangePasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const formStyles = useFormStyles();
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
        'Your password has been changed.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not update your password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <Text style={formStyles.label}>New Password</Text>
            <TextInput
              style={formStyles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              returnKeyType="next"
              autoFocus
            />

            <Text style={formStyles.label}>Confirm Password</Text>
            <TextInput
              style={formStyles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
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
          </View>
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
  flexFill: { flex: 1 },
  content: {
    flexGrow:          1,
    padding:           24,
    paddingTop:        20,
  },
  formCard: {
    backgroundColor: colors.bgAlt,
    borderRadius:    RADIUS.xl,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    padding:         20,
  },
  saveBtn: {
    marginTop: 6,
  },
});
