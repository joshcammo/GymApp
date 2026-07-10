import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { authStyles } from '../constants/authStyles';
import { RootStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { GradientButton } from '../components/GradientButton';
import { haptics } from '../utils/haptics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;
interface Props { navigation: Nav }

export function LoginScreen({ navigation }: Props) {
  const [mode,            setMode]            = useState<'signIn' | 'signUp'>('signIn');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting,      setSubmitting]      = useState(false);

  const isSignUp = mode === 'signUp';

  const toggleMode = () => {
    haptics.tap();
    setMode(m => (m === 'signIn' ? 'signUp' : 'signIn'));
    setPassword('');
    setConfirmPassword('');
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email:    email.trim(),
        password,
      });
      if (error) throw error;
      haptics.success();
      // On success, the auth state listener in App.tsx switches to the main stack.
    } catch (e) {
      Alert.alert('Sign in failed', (e as Error).message ?? 'Check your credentials and connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      Alert.alert('Missing info', 'Fill in your email and password.');
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

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email:    email.trim(),
        password,
      });
      if (error) throw error;

      if (!data.session) {
        // Email confirmation is required before a session is issued.
        Alert.alert(
          'Confirm your email',
          'We sent you a confirmation link. Verify your email, then sign in.'
        );
        setMode('signIn');
        setPassword('');
        setConfirmPassword('');
      } else {
        haptics.success();
      }
      // If a session was returned, the auth state listener in App.tsx switches to the main stack.
    } catch (e) {
      Alert.alert('Sign up failed', (e as Error).message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => (isSignUp ? handleSignUp() : handleSignIn());

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
          {/* ── Brand hero ── */}
          <View style={styles.hero}>
            <Logo size={88} withWordmark />
            <Text style={styles.subtitle}>
              {isSignUp ? 'Create an account to get started' : 'Sign in to view your workouts'}
            </Text>
          </View>

          {/* ── Form card ── */}
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
              returnKeyType="next"
            />

            <Text style={authStyles.label}>Password</Text>
            <TextInput
              style={authStyles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={isSignUp ? 'password-new' : 'password'}
              returnKeyType={isSignUp ? 'next' : 'done'}
              onSubmitEditing={isSignUp ? undefined : handleSubmit}
            />

            {isSignUp && (
              <>
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
                  onSubmitEditing={handleSubmit}
                />
              </>
            )}

            <GradientButton
              title={isSignUp ? 'Sign Up' : 'Sign In'}
              onPress={handleSubmit}
              loading={submitting}
              style={styles.submitBtn}
            />

            {!isSignUp && (
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Mode toggle ── */}
          <TouchableOpacity
            style={styles.toggleModeBtn}
            onPress={toggleMode}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleModeText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleModeTextAccent}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
            </Text>
          </TouchableOpacity>
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
  submitBtn: {
    marginTop: 6,
  },
  forgotBtn: {
    marginTop:  16,
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 13,
    color:    COLORS.textSub,
  },
  toggleModeBtn: {
    marginTop:  24,
    alignItems: 'center',
  },
  toggleModeText: {
    fontSize: 14,
    color:    COLORS.textSub,
  },
  toggleModeTextAccent: {
    fontFamily: FONT.bold,
    color:      COLORS.primary,
  },
});
