import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { formStyles } from '../constants/formStyles';
import { profileApi } from '../services/social';
import { Logo } from '../components/Logo';
import { GradientButton } from '../components/GradientButton';
import { haptics } from '../utils/haptics';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

interface Props {
  /** Called with the claimed username after it's successfully set. */
  onComplete: (username: string) => void;
}

export function UsernameSetupScreen({ onComplete }: Props) {
  const [username,   setUsername]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const normalized = username.trim().toLowerCase();
  const valid = USERNAME_RE.test(normalized);

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await profileApi.setUsername(normalized);
      haptics.success();
      onComplete(normalized);
    } catch (e) {
      haptics.warning();
      Alert.alert('Could not set username', (e as Error).message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
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
            <Logo size={72} />
            <Text style={styles.title}>Pick a username</Text>
            <Text style={styles.subtitle}>
              This is how friends will find you in the Social section.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={formStyles.label}>Username</Text>
            <TextInput
              style={formStyles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. josh_lifts"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Text style={styles.hint}>
              3-20 characters: lowercase letters, numbers, underscore only.
            </Text>

            <GradientButton
              title="Continue"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!valid}
              style={styles.submitBtn}
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
    justifyContent:    'center',
    paddingHorizontal: 24,
    paddingVertical:   32,
  },
  hero: {
    alignItems:   'center',
    marginBottom: 36,
  },
  title: {
    marginTop:  16,
    fontFamily: FONT.bold,
    fontSize:   22,
    color:      COLORS.text,
  },
  subtitle: {
    marginTop:  8,
    fontSize:   14,
    color:      COLORS.textSub,
    textAlign:  'center',
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: COLORS.bgAlt,
    borderRadius:    RADIUS.xl,
    borderWidth:      1,
    borderColor:      COLORS.cardBorder,
    padding:         20,
  },
  hint: {
    fontSize:     12,
    color:        COLORS.textMuted,
    marginTop:    -10,
    marginBottom: 20,
  },
  submitBtn: {
    marginTop: 6,
  },
});
