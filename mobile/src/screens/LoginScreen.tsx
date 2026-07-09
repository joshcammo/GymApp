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
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }

    setSigningIn(true);
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
      setSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Gym Tracker</Text>
          <Text style={styles.subtitle}>Sign in to view your workouts</Text>

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
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />

          <TouchableOpacity
            style={[styles.signInBtn, signingIn && styles.signInBtnDisabled]}
            onPress={handleSignIn}
            disabled={signingIn}
            activeOpacity={0.85}
          >
            {signingIn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInBtnText}>Sign In</Text>
            )}
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
});
