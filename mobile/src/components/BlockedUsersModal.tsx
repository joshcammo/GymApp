import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { BlockedUser } from '../types/moderation';
import { blocksApi } from '../services/moderation';
import { Avatar } from './Avatar';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Manage the caller's blocks. Reached from Settings → Blocked Users.
 *
 *  Guideline 1.2 requires the ability to block abusive users; being able
 *  to see and undo those blocks is what makes it a feature rather than a
 *  trapdoor. */
export function BlockedUsersModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [users,     setUsers]     = useState<BlockedUser[] | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  // Per-row, so unblocking one doesn't disable the whole list.
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await blocksApi.list());
    } catch (e) {
      setError((e as Error).message ?? 'Could not load your blocked users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const confirmUnblock = (user: BlockedUser) => {
    const name = user.display_name || user.username || 'this user';
    haptics.warning();
    Alert.alert(
      `Unblock ${name}?`,
      "You'll be able to see each other's posts and comments again. You won't be friends again unless one of you sends a new request.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => unblock(user) },
      ],
    );
  };

  const unblock = async (user: BlockedUser) => {
    setUnblocking(user.user_id);
    // Drop the row straight away — the RPC is a delete, so the only
    // realistic failure is the network, and that restores it below.
    setUsers(list => list?.filter(u => u.user_id !== user.user_id) ?? null);
    try {
      await blocksApi.unblock(user.user_id);
      haptics.success();
    } catch (e) {
      setUsers(list => (list ? [user, ...list] : [user]));
      Alert.alert('Could not unblock', (e as Error).message ?? 'Please try again.');
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.header}>
          <View style={styles.headerBtn} />
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Feather name="x" size={22} color={colors.textSub} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centred}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={users ?? []}
            keyExtractor={u => u.user_id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Avatar name={item.display_name || item.username} size={40} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.display_name || item.username || 'Unknown user'}
                  </Text>
                  {!!item.username && (
                    <Text style={styles.rowSub} numberOfLines={1}>@{item.username}</Text>
                  )}
                </View>
                <PressableScale
                  style={styles.unblockBtn}
                  onPress={() => confirmUnblock(item)}
                  disabled={unblocking === item.user_id}
                  pressScale={0.96}
                >
                  <Text style={styles.unblockText}>
                    {unblocking === item.user_id ? '…' : 'Unblock'}
                  </Text>
                </PressableScale>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
                <Text style={styles.emptySub}>
                  Blocking someone hides their posts and comments from you, hides yours from
                  them, and stops them sending you friend requests. You can block a user from
                  the ⋯ menu on any of their posts or comments.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth:  1,
    borderBottomColor:  colors.divider,
  },
  headerBtn: {
    width:      32,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONT.semibold,
    fontSize:   17,
    color:      colors.text,
  },
  centred: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color:     colors.textSub,
    fontSize:  14,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
  },
  retryText: {
    fontFamily: FONT.semibold,
    fontSize:   15,
    color:      colors.primary,
  },
  listContent: {
    padding: 16,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.lg,
    padding:           12,
    marginBottom:      10,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONT.medium,
    fontSize:   16,
    color:      colors.text,
  },
  rowSub: {
    fontSize:  12,
    color:     colors.textMuted,
    marginTop:  2,
  },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical:    8,
    borderRadius:      RADIUS.md,
    backgroundColor:   colors.primaryBg,
  },
  unblockText: {
    fontFamily: FONT.semibold,
    fontSize:   14,
    color:      colors.primary,
  },
  emptyWrap: {
    paddingTop:        24,
    paddingHorizontal: 8,
  },
  emptyText: {
    fontFamily: FONT.semibold,
    fontSize:   16,
    color:      colors.textSub,
    textAlign:  'center',
  },
  emptySub: {
    fontSize:   13,
    color:      colors.textMuted,
    textAlign:  'center',
    marginTop:   8,
    lineHeight: 19,
  },
});
