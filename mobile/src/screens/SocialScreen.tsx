import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { RootStackParamList, MainTabParamList, Post, ShareTarget } from '../types';
import { postsApi } from '../services/social';
import { supabase } from '../lib/supabase';
import { PostCard } from '../components/PostCard';
import { EmptyState } from '../components/EmptyState';
import { SharePickerModal } from '../components/SharePickerModal';
import { SharePostModal } from '../components/SharePostModal';
import { haptics } from '../utils/haptics';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'FeedTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;
interface Props { navigation: Nav }

export function SocialScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [myId,       setMyId]       = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [likingIds,  setLikingIds]  = useState<Set<number>>(new Set());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [shareTarget,   setShareTarget]   = useState<ShareTarget | null>(null);
  // Kept in sync with `posts` so toggleLike always reads the current
  // liked_by_me/like_count instead of the (possibly stale) snapshot the
  // FlatList row was rendered with when the tap fired.
  const postsRef = useRef<Post[]>([]);
  postsRef.current = posts;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => { haptics.tap(); setPickerVisible(true); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="plus" size={19} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const load = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true);
    setError(null);
    try {
      const [data, session] = await Promise.all([postsApi.feed(), supabase.auth.getSession()]);
      setPosts(data);
      setMyId(session.data.session?.user.id ?? null);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load the feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load(false);
  };

  const toggleLike = async ({ id: postId }: Post) => {
    // Ignore re-taps while a like/unlike for this post is already in
    // flight — otherwise a rapid double-tap fires the request twice
    // against the same stale liked_by_me value, and the second call
    // errors (duplicate insert / already-removed) and reverts a like
    // that had already succeeded.
    if (likingIds.has(postId)) return;
    const current = postsRef.current.find(p => p.id === postId);
    if (!current) return;
    const wasLiked = current.liked_by_me;

    setLikingIds(prev => new Set(prev).add(postId));
    // Optimistic — feels instant, and a failure just reverts below.
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, liked_by_me: !wasLiked, like_count: p.like_count + (wasLiked ? -1 : 1) }
      : p
    ));
    try {
      if (wasLiked) await postsApi.unlike(postId);
      else          await postsApi.like(postId);
    } catch {
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, liked_by_me: wasLiked, like_count: current.like_count }
        : p
      ));
    } finally {
      setLikingIds(prev => { const next = new Set(prev); next.delete(postId); return next; });
    }
  };

  const handleDelete = (post: Post) => {
    haptics.warning();
    Alert.alert('Delete Post', 'Remove this shared lift from your friends\' feeds?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await postsApi.remove(post.id);
            haptics.success();
            setPosts(prev => prev.filter(p => p.id !== post.id));
          } catch {
            Alert.alert('Error', 'Could not delete post. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centred}>
          <EmptyState emoji="⚠️" message="Could not load the feed" subMessage={error} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onToggleLike={toggleLike}
              onPressComments={() => navigation.navigate('PostDetail', { postId: item.id })}
              onDelete={item.user_id === myId ? () => handleDelete(item) : undefined}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              message="No posts yet"
              subMessage="Tap + above to share a PR, or add friends from the Friends tab to see theirs."
              action={
                <TouchableOpacity
                  style={styles.emptyLink}
                  onPress={() => { haptics.tap(); setPickerVisible(true); }}
                >
                  <Feather name="plus" size={14} color={colors.primary} />
                  <Text style={styles.emptyLinkText}>Share a PR</Text>
                </TouchableOpacity>
              }
            />
          }
        />
      )}

      <SharePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={target => { setPickerVisible(false); setShareTarget(target); }}
      />
      <SharePostModal
        target={shareTarget}
        onClose={() => setShareTarget(null)}
        onShared={() => { setShareTarget(null); load(); }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  centred: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  listContent: {
    padding:       16,
    flexGrow:      1,
  },
  headerBtn: {
    width:           38,
    height:          38,
    borderRadius:    RADIUS.pill,
    backgroundColor: colors.primaryBg,
    borderWidth:      1,
    borderColor:      colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  emptyLink: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  emptyLinkText: {
    fontFamily: FONT.bold,
    fontSize:   13,
    color:      colors.primary,
  },
});
