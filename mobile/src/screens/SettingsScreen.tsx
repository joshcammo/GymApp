import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { RootStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { PressableScale } from '../components/PressableScale';
import { haptics } from '../utils/haptics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;
interface Props { navigation: Nav }

export function SettingsScreen({ navigation }: Props) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
  }, []);

  const handleSignOut = () => {
    haptics.warning();
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text:  'Sign Out',
        style: 'destructive',
        onPress: () => {
          // On success, the auth state listener in App.tsx switches to the login stack.
          supabase.auth.signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {email && (
        <View style={styles.accountCard}>
          <Text style={styles.accountLabel}>SIGNED IN AS</Text>
          <Text style={styles.accountEmail}>{email}</Text>
        </View>
      )}

      <View style={styles.section}>
        <PressableScale
          style={styles.row}
          onPress={() => navigation.navigate('Presets')}
          pressScale={0.98}
        >
          <Feather name="layers" size={18} color={COLORS.textSub} />
          <Text style={styles.rowText}>Presets</Text>
          <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
        </PressableScale>
        <PressableScale
          style={[styles.row, styles.rowSpaced]}
          onPress={() => navigation.navigate('ChangePassword')}
          pressScale={0.98}
        >
          <Feather name="lock" size={18} color={COLORS.textSub} />
          <Text style={styles.rowText}>Change Password</Text>
          <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
        </PressableScale>
      </View>

      <View style={styles.section}>
        <PressableScale style={styles.row} onPress={handleSignOut} pressScale={0.98}>
          <Feather name="log-out" size={18} color={COLORS.danger} />
          <Text style={[styles.rowText, styles.dangerText]}>Sign Out</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  accountCard: {
    margin:            16,
    marginBottom:      0,
    padding:           16,
    backgroundColor:   COLORS.bgAlt,
    borderRadius:      RADIUS.lg,
    borderWidth:        1,
    borderColor:        COLORS.cardBorder,
  },
  accountLabel: {
    fontFamily:    FONT.semibold,
    fontSize:      11,
    color:         COLORS.textMuted,
    letterSpacing: 1,
    marginBottom:   4,
  },
  accountEmail: {
    fontSize: 15,
    color:    COLORS.text,
  },
  section: {
    margin:       16,
    marginBottom:  0,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical:   16,
    borderWidth:        1,
    borderColor:        COLORS.cardBorder,
  },
  rowSpaced: {
    marginTop: 10,
  },
  rowText: {
    flex:     1,
    fontSize: 16,
    color:    COLORS.text,
  },
  dangerText: {
    color: COLORS.danger,
  },
});
