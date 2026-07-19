import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { RootStackParamList, Post } from '../types';
import { postsApi } from '../services/social';
import { supabase } from '../lib/supabase';
import { PostCard } from '../components/PostCard';
import { EmptyState } from '../components/EmptyState';
import { haptics } from '../utils/haptics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Social'>;
interface Props { navigation: Nav }

export function SocialScreen({ navigation }: Props) {
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [myId,       setMyId]       = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [likingIds,  setLikingIds]  = useState<Set<number>>(new Set());
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
          onPress={() => { haptics.tap(); navigation.navigate('Friends'); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="user-plus" size={17} color={COLORS.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

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
          <ActivityIndicator size="large" color={COLORS.primary} />
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
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
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
              subMessage="Add friends and share a PR from any exercise's award badge to get the feed going."
              action={
                <TouchableOpacity
                  style={styles.emptyLink}
                  onPress={() => { haptics.tap(); navigation.navigate('Friends'); }}
                >
                  <Feather name="user-plus" size={14} color={COLORS.primary} />
                  <Text style={styles.emptyLinkText}>Find friends</Text>
                </TouchableOpacity>
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
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
    backgroundColor: COLORS.primaryBg,
    borderWidth:      1,
    borderColor:      COLORS.primary,
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
    color:      COLORS.primary,
  },
});
