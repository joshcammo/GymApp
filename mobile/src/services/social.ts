import { supabase } from '../lib/supabase';
import { checkError } from './api';
import { Friendship, FriendshipStatus, Post, PostComment, Profile } from '../types';

export const profileApi = {
  /** The signed-in user's own profile row (always exists — created on signup). */
  getMine: async (): Promise<Profile> => {
    const { data: session } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .eq('id', session.session?.user.id)
      .single();
    checkError(error);
    return data as Profile;
  },

  /** Claim a username (3-20 chars, lowercase letters/numbers/underscore). */
  setUsername: async (username: string): Promise<void> => {
    const { error } = await supabase.rpc('set_username', { p_username: username });
    checkError(error);
  },

  /** Prefix search by username, excluding the caller. Empty query returns no results. */
  search: async (query: string): Promise<Profile[]> => {
    const q = query.trim();
    if (!q) return [];
    // Escape ILIKE metacharacters so a literal '%' or '_' in the query
    // can't widen the match beyond a plain prefix search.
    const escaped = q.replace(/[\\%_]/g, '\\$&');
    const { data: session } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .not('username', 'is', null)
      .ilike('username', `${escaped}%`)
      .neq('id', session.session?.user.id ?? '')
      .order('username', { ascending: true })
      .limit(20);
    checkError(error);
    return data as Profile[];
  },
};

export const friendsApi = {
  /** All of the caller's friendships (pending + accepted, sent + received), newest first. */
  list: async (): Promise<Friendship[]> => {
    const { data, error } = await supabase
      .from('friendships_with_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    checkError(error);
    return data as Friendship[];
  },

  /** Send a friend request by username; auto-accepts if they already requested the caller. */
  sendRequest: async (username: string): Promise<{ status: FriendshipStatus }> => {
    const { data, error } = await supabase.rpc('send_friend_request', { p_username: username });
    checkError(error);
    return data as { status: FriendshipStatus };
  },

  /** Accept or decline a pending request addressed to the caller. */
  respond: async (id: number, accept: boolean): Promise<void> => {
    const { error } = await supabase.rpc('respond_friend_request', { p_id: id, p_accept: accept });
    checkError(error);
  },

  /** Cancel a sent request or unfriend an accepted one. */
  remove: async (id: number): Promise<void> => {
    const { data, error } = await supabase.from('friendships').delete().eq('id', id).select('id');
    checkError(error);
    if (!data || data.length === 0) {
      throw new Error('Friendship not found — it may have already been removed.');
    }
  },
};

export const postsApi = {
  /** Friends' + the caller's own posts, newest first. */
  feed: async (): Promise<Post[]> => {
    const { data, error } = await supabase
      .from('posts_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    checkError(error);
    return data as Post[];
  },

  /** Share the caller's current heaviest set for one of their own exercises. */
  share: async (exerciseId: number, caption?: string): Promise<number> => {
    const { data, error } = await supabase.rpc('share_post', {
      p_exercise_id: exerciseId,
      p_caption:     caption ?? null,
    });
    checkError(error);
    return data as number;
  },

  /** Delete one of the caller's own posts. */
  remove: async (postId: number): Promise<void> => {
    const { data, error } = await supabase.from('posts').delete().eq('id', postId).select('id');
    checkError(error);
    if (!data || data.length === 0) {
      throw new Error('Post not found — it may have already been deleted.');
    }
  },

  like: async (postId: number): Promise<void> => {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId });
    checkError(error);
  },

  unlike: async (postId: number): Promise<void> => {
    // No user_id filter needed — the post_likes_delete_own RLS policy
    // already restricts this to the caller's own like row.
    const { error } = await supabase.from('post_likes').delete().eq('post_id', postId);
    checkError(error);
  },

  listComments: async (postId: number): Promise<PostComment[]> => {
    const { data, error } = await supabase
      .from('post_comments_with_profiles')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    checkError(error);
    return data as PostComment[];
  },

  addComment: async (postId: number, body: string): Promise<void> => {
    const { error } = await supabase.from('post_comments').insert({ post_id: postId, body });
    checkError(error);
  },
};
