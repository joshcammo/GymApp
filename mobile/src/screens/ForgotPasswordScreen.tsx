import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';

import { COLORS } from '../constants/colors';
import { authStyles } from '../constants/authStyles';
import { RootStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { GradientButton } from '../components/GradientButton';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
interface Props { navigation: Nav }

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email,   setEmail]   = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Missing info', 'Enter the email address for your account.');
      return;
    }

    setSending(true);
    try {
      // NOTE: Supabase only honors this redirect if it (or a matching
      // pattern, e.g. "gymtracker://*") is added to the project's
      // Authentication > URL Configuration > Redirect URLs allow-list in
      // the Supabase dashboard. Without that, Supabase silently falls back
      // to the project's default Site URL instead and this link never
      // reaches the app.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('reset-password'),
      });
      if (error) throw error;

      Alert.alert(
        'Check your email',
        'If an account exists for that address, we sent a link to reset your password.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not send the reset email. Please try again.');
    } finally {
      setSending(false);
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
          <Text style={styles.subtitle}>
            Enter the email address for your account and we’ll send you a link to reset your password.
          </Text>

          <View style={authStyles.formCard}>
            <Text style={authStyles.label}>Email</Text>
            <TextInput
              style={authStyles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="done"
              autoFocus
              onSubmitEditing={handleSend}
            />

            <GradientButton
              title="Send Reset Link"
              onPress={handleSend}
              loading={sending}
              style={styles.sendBtn}
            />
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
    padding:           24,
    paddingTop:        20,
  },
  subtitle: {
    fontSize:     14,
    color:        COLORS.textSub,
    lineHeight:   20,
    marginBottom: 24,
  },
  sendBtn: {
    marginTop: 6,
  },
});
