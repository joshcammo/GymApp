import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { LEGAL } from '../constants/legal';
import { RootStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { PressableScale } from '../components/PressableScale';
import { BlockedUsersModal } from '../components/BlockedUsersModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { haptics } from '../utils/haptics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;
interface Props { navigation: Nav }

export function SettingsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email,        setEmail]        = useState<string | null>(null);
  const [blocksOpen,   setBlocksOpen]   = useState(false);
  const [deleteOpen,   setDeleteOpen]   = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
  }, []);

  /** Open a legal/support page in the system browser. */
  const openUrl = async (url: string, label: string) => {
    haptics.tap();
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        `Could not open ${label}`,
        `Visit ${url} in your browser, or email ${LEGAL.supportEmail}.`,
      );
    }
  };

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {email && (
          <View style={styles.accountCard}>
            <Text style={styles.accountLabel}>SIGNED IN AS</Text>
            <Text style={styles.accountEmail}>{email}</Text>
          </View>
        )}

        <Text style={styles.sectionHeading}>ACCOUNT</Text>
        <View style={styles.section}>
          <PressableScale
            style={styles.row}
            onPress={() => navigation.navigate('Appearance')}
            pressScale={0.98}
          >
            <Feather name="sun" size={18} color={colors.textSub} />
            <Text style={styles.rowText}>Appearance</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableScale>
          <PressableScale
            style={[styles.row, styles.rowSpaced]}
            onPress={() => navigation.navigate('Presets')}
            pressScale={0.98}
          >
            <Feather name="layers" size={18} color={colors.textSub} />
            <Text style={styles.rowText}>Presets</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableScale>
          <PressableScale
            style={[styles.row, styles.rowSpaced]}
            onPress={() => navigation.navigate('ChangeUsername')}
            pressScale={0.98}
          >
            <Feather name="at-sign" size={18} color={colors.textSub} />
            <Text style={styles.rowText}>Change Username</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableScale>
          <PressableScale
            style={[styles.row, styles.rowSpaced]}
            onPress={() => navigation.navigate('ChangePassword')}
            pressScale={0.98}
          >
            <Feather name="lock" size={18} color={colors.textSub} />
            <Text style={styles.rowText}>Change Password</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableScale>
        </View>

        <Text style={styles.sectionHeading}>SAFETY</Text>
        <View style={styles.section}>
          <PressableScale
            style={styles.row}
            onPress={() => { haptics.tap(); setBlocksOpen(true); }}
            pressScale={0.98}
          >
            <Feather name="slash" size={18} color={colors.textSub} />
            <Text style={styles.rowText}>Blocked Users</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableScale>
        </View>

        <Text style={styles.sectionHeading}>ABOUT</Text>
        <View style={styles.section}>
          <PressableScale
            style={styles.row}
            onPress={() => openUrl(LEGAL.supportUrl, 'support')}
            pressScale={0.98}
          >
            <Feather name="help-circle" size={18} color={colors.textSub} />
            <Text style={styles.rowText}>Support &amp; Contact</Text>
            <Feather name="external-link" size={16} color={colors.textMuted} />
          </PressableScale>
          <PressableScale
            style={[styles.row, styles.rowSpaced]}
            onPress={() => openUrl(LEGAL.privacyUrl, 'the privacy policy')}
            pressScale={0.98}
          >
            <Feather name="shield" size={18} color={colors.textSub} />
            <Text style={styles.rowText}>Privacy Policy</Text>
            <Feather name="external-link" size={16} color={colors.textMuted} />
          </PressableScale>
          <PressableScale
            style={[styles.row, styles.rowSpaced]}
            onPress={() => openUrl(LEGAL.termsUrl, 'the terms of use')}
            pressScale={0.98}
          >
            <Feather name="file-text" size={18} color={colors.textSub} />
            <Text style={styles.rowText}>Terms of Use</Text>
            <Feather name="external-link" size={16} color={colors.textMuted} />
          </PressableScale>
        </View>

        <View style={[styles.section, styles.sectionSpaced]}>
          <PressableScale style={styles.row} onPress={handleSignOut} pressScale={0.98}>
            <Feather name="log-out" size={18} color={colors.danger} />
            <Text style={[styles.rowText, styles.dangerText]}>Sign Out</Text>
          </PressableScale>
          <PressableScale
            style={[styles.row, styles.rowSpaced]}
            onPress={() => { haptics.warning(); setDeleteOpen(true); }}
            pressScale={0.98}
          >
            <Feather name="trash-2" size={18} color={colors.danger} />
            <Text style={[styles.rowText, styles.dangerText]}>Delete Account</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </PressableScale>
        </View>
      </ScrollView>

      <BlockedUsersModal visible={blocksOpen} onClose={() => setBlocksOpen(false)} />
      <DeleteAccountModal visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  accountCard: {
    margin:            16,
    marginBottom:      0,
    padding:           16,
    backgroundColor:   colors.bgAlt,
    borderRadius:      RADIUS.lg,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
  },
  accountLabel: {
    fontFamily:    FONT.semibold,
    fontSize:      11,
    color:         colors.textMuted,
    letterSpacing: 1,
    marginBottom:   4,
  },
  accountEmail: {
    fontSize: 15,
    color:    colors.text,
  },
  sectionHeading: {
    fontFamily:    FONT.semibold,
    fontSize:      11,
    color:         colors.textMuted,
    letterSpacing: 1,
    marginTop:     24,
    marginBottom:   8,
    marginHorizontal: 16,
  },
  section: {
    marginHorizontal: 16,
  },
  // The sign-out/delete group has no heading above it, so it carries its
  // own top margin instead of inheriting one from sectionHeading.
  sectionSpaced: {
    marginTop: 24,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical:   16,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
  },
  rowSpaced: {
    marginTop: 10,
  },
  rowText: {
    flex:     1,
    fontSize: 16,
    color:    colors.text,
  },
  dangerText: {
    color: colors.danger,
  },
});
