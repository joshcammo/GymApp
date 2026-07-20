import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { RADIUS } from '../constants/theme';
import { useFormStyles } from '../constants/formStyles';
import { RootStackParamList } from '../types';
import { profileApi } from '../services/social';
import { GradientButton } from '../components/GradientButton';
import { haptics } from '../utils/haptics';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type Nav = NativeStackNavigationProp<RootStackParamList, 'ChangeUsername'>;
interface Props { navigation: Nav }

export function ChangeUsernameScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const formStyles = useFormStyles();
  const [current,    setCurrent]    = useState<string | null>(null);
  const [username,   setUsername]  = useState('');
  const [loading,    setLoading]   = useState(true);
  const [saving,     setSaving]    = useState(false);

  useEffect(() => {
    profileApi.getMine()
      .then(p => { setCurrent(p.username); setUsername(p.username ?? ''); })
      .catch(() => Alert.alert('Error', 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  const normalized = username.trim().toLowerCase();
  const valid = USERNAME_RE.test(normalized);
  const unchanged = normalized === current;

  const handleSave = async () => {
    if (!valid || unchanged || saving) return;
    setSaving(true);
    try {
      await profileApi.setUsername(normalized);
      haptics.success();
      Alert.alert(
        'Username updated',
        `You're now @${normalized}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      haptics.warning();
      Alert.alert('Could not update username', (e as Error).message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={formStyles.label}>Username</Text>
            <TextInput
              style={formStyles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. josh_lifts"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              autoFocus
              onSubmitEditing={handleSave}
            />
            <Text style={styles.hint}>
              3-20 characters: lowercase letters, numbers, underscore only. Friends
              find you by this. Changing it means old links to your profile stop working.
            </Text>

            <GradientButton
              title="Save Username"
              onPress={handleSave}
              loading={saving}
              disabled={!valid || unchanged}
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
  centred: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  content: {
    flexGrow:   1,
    padding:    24,
    paddingTop: 20,
  },
  formCard: {
    backgroundColor: colors.bgAlt,
    borderRadius:    RADIUS.xl,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    padding:         20,
  },
  hint: {
    fontSize:     12,
    color:        colors.textMuted,
    marginTop:    -10,
    marginBottom: 20,
    lineHeight:   17,
  },
  saveBtn: {
    marginTop: 6,
  },
});
