import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { RootStackParamList, Post, PostComment } from '../types';
import { postsApi } from '../services/social';
import { supabase } from '../lib/supabase';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { timeAgo } from '../utils/dateUtils';
import { haptics } from '../utils/haptics';

type Route = RouteProp<RootStackParamList, 'PostDetail'>;
interface Props { route: Route }

export function PostDetailScreen({ route }: Props) {
  const { postId } = route.params;
  const [post,     setPost]     = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [draft,    setDraft]    = useState('');
  const [posting,  setPosting]  = useState(false);
  const [liking,   setLiking]   = useState(false);
  // Kept in sync with `post` so toggleLike always reads the current
  // liked_by_me/like_count instead of the stale snapshot PostCard was
  // rendered with when the tap fired.
  const postRef = useRef<Post | null>(null);
  postRef.current = post;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [{ data: postData, error: postError }, commentData] = await Promise.all([
        supabase.from('posts_feed').select('*').eq('id', postId).single(),
        postsApi.listComments(postId),
      ]);
      if (postError) throw new Error(postError.message);
      setPost(postData as Post);
      setComments(commentData);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleLike = async () => {
    // Ignore a re-tap while the previous like/unlike is still in flight —
    // see SocialScreen's toggleLike for why (stale-argument double-fire).
    if (liking || !postRef.current) return;
    const current = postRef.current;
    const wasLiked = current.liked_by_me;

    setLiking(true);
    setPost(p => p && ({ ...p, liked_by_me: !wasLiked, like_count: p.like_count + (wasLiked ? -1 : 1) }));
    try {
      if (wasLiked) await postsApi.unlike(current.id);
      else          await postsApi.like(current.id);
    } catch {
      setPost(p => p && ({ ...p, liked_by_me: wasLiked, like_count: current.like_count }));
    } finally {
      setLiking(false);
    }
  };

  const submitComment = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await postsApi.addComment(postId, body);
      setDraft('');
      const fresh = await postsApi.listComments(postId);
      setComments(fresh);
      setPost(p => p && ({ ...p, comment_count: p.comment_count + 1 }));
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not post comment');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <EmptyState emoji="⚠️" message="Could not load post" subMessage={error ?? undefined} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={comments}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<PostCard post={post} onToggleLike={toggleLike} />}
          renderItem={({ item }) => (
            <View style={styles.commentRow}>
              <Avatar name={item.display_name || item.username} size={28} />
              <View style={styles.commentBody}>
                <Text style={styles.commentMeta}>
                  <Text style={styles.commentName}>{item.display_name || item.username}</Text>
                  {'  '}{timeAgo(item.created_at)}
                </Text>
                <Text style={styles.commentText}>{item.body}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.noComments}>No comments yet — be the first.</Text>
          }
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment…"
            placeholderTextColor={COLORS.textMuted}
            maxLength={500}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || posting) && styles.sendBtnDisabled]}
            onPress={() => { haptics.tap(); submitComment(); }}
            disabled={!draft.trim() || posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="send" size={16} color="#FFFFFF" />
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
  centred: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  listContent: {
    padding:       16,
    paddingBottom: 24,
  },
  commentRow: {
    flexDirection: 'row',
    gap:           10,
    marginBottom:  14,
  },
  commentBody: {
    flex: 1,
  },
  commentMeta: {
    fontSize: 11,
    color:    COLORS.textMuted,
  },
  commentName: {
    fontFamily: FONT.semibold,
    color:      COLORS.textSub,
  },
  commentText: {
    fontSize:   14,
    color:      COLORS.text,
    marginTop:  3,
    lineHeight: 19,
  },
  noComments: {
    fontSize:  13,
    color:     COLORS.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
  composer: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderTopWidth:     1,
    borderTopColor:     COLORS.divider,
    backgroundColor:   COLORS.bg,
  },
  input: {
    flex:              1,
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.lg,
    borderWidth:        1,
    borderColor:        COLORS.border,
    paddingHorizontal: 14,
    paddingVertical:   10,
    color:             COLORS.text,
    fontSize:          14,
    maxHeight:         100,
  },
  sendBtn: {
    width:           38,
    height:          38,
    borderRadius:    RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
