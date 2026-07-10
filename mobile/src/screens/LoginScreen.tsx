import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../constants/colors';
import { supabase } from '../lib/supabase';

export function LoginScreen() {
  const [mode,            setMode]            = useState<'signIn' | 'signUp'>('signIn');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting,      setSubmitting]      = useState(false);

  const isSignUp = mode === 'signUp';

  const toggleMode = () => {
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
        <View style={styles.content}>
          <Text style={styles.title}>Gym Tracker</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Create an account to get started' : 'Sign in to view your workouts'}
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
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
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
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

          <TouchableOpacity
            style={[styles.signInBtn, submitting && styles.signInBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInBtnText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>

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
        </View>
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
    flex:              1,
    justifyContent:    'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize:     28,
    fontWeight:   '800',
    color:        COLORS.text,
    textAlign:    'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize:     14,
    color:        COLORS.textSub,
    textAlign:    'center',
    marginBottom: 40,
  },
  label: {
    fontSize:     13,
    fontWeight:   '600',
    color:        COLORS.textSub,
    marginBottom:  8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor:   COLORS.card,
    borderRadius:      12,
    borderWidth:        1,
    borderColor:        COLORS.border,
    paddingHorizontal: 16,
    paddingVertical:   14,
    color:             COLORS.text,
    fontSize:          16,
    marginBottom:      20,
  },
  signInBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    14,
    height:          54,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:        8,
    shadowColor:     COLORS.primary,
    shadowOpacity:   0.35,
    shadowRadius:    14,
    shadowOffset:    { width: 0, height: 5 },
    elevation:        6,
  },
  signInBtnDisabled: {
    opacity: 0.6,
  },
  signInBtnText: {
    fontSize:   17,
    fontWeight: '800',
    color:      '#FFFFFF',
    letterSpacing: 0.3,
  },
  toggleModeBtn: {
    marginTop:  20,
    alignItems: 'center',
  },
  toggleModeText: {
    fontSize: 14,
    color:    COLORS.textSub,
  },
  toggleModeTextAccent: {
    color:      COLORS.primary,
    fontWeight: '700',
  },
});
