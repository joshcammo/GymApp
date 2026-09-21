import { supabase } from '../lib/supabase';
import { checkError } from './api';
import { BlockedUser, ReportReason, ReportTarget } from '../types/moderation';

/**
 * Blocking and content reporting — the client half of migration 023.
 *
 * Every call here is an RPC rather than a table write. Blocking has to
 * drop the friendship in the same transaction, reporting has to snapshot
 * the reported text server-side, and the reports table is deliberately
 * unreadable by users, so none of this can be expressed as a plain
 * insert from the client.
 */

export const blocksApi = {
  /** Everyone the caller has blocked, newest first. */
  list: async (): Promise<BlockedUser[]> => {
    const { data, error } = await supabase.rpc('my_blocked_users');
    checkError(error);
    return (data ?? []) as BlockedUser[];
  },

  /**
   * Block a user. Immediate and mutual in effect: RLS stops each from
   * seeing the other's posts, comments and likes, removes them from
   * profile search, and refuses friend requests between them. Any
   * existing friendship or pending request is deleted.
   */
  block: async (userId: string): Promise<void> => {
    const { error } = await supabase.rpc('block_user', { p_user_id: userId });
    checkError(error);
  },

  /** Lift a block. Deliberately does not restore the friendship. */
  unblock: async (userId: string): Promise<void> => {
    const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
    checkError(error);
  },
};

export const reportsApi = {
  /**
   * Report a post, comment or user.
   *
   * Must be called *before* blocking the same user, not after: the RPC
   * runs as the caller and snapshots the reported content through their
   * own RLS, and a block hides the author's profile row from them.
   * `reportAndBlock` below exists so callers don't have to remember.
   */
  report: async (target: ReportTarget, reason: ReportReason, details?: string): Promise<void> => {
    const { error } = await supabase.rpc('report_content', {
      p_target_type: target.kind,
      p_reason:      reason,
      p_post_id:     target.kind === 'post'    ? target.postId    : null,
      p_comment_id:  target.kind === 'comment' ? target.commentId : null,
      p_user_id:     target.kind === 'user'    ? target.userId    : null,
      p_details:     details?.trim() || null,
    });
    checkError(error);
  },

  /**
   * Report, then block the author — the common case when someone sees
   * something they want gone. Ordering matters (see `report` above), so
   * it is enforced here rather than left to each call site.
   */
  reportAndBlock: async (
    target:  ReportTarget,
    reason:  ReportReason,
    details?: string,
  ): Promise<void> => {
    await reportsApi.report(target, reason, details);
    await blocksApi.block(target.authorId);
  },
};

export const accountApi = {
  /**
   * Permanently delete the caller's account and everything in it
   * (Guideline 5.1.1(v)). Irreversible — the server cascade erases
   * workouts, cardio, presets, profile, posts, comments and
   * friendships along with the auth row.
   *
   * Signs out locally afterwards rather than through the server: the
   * user the session belongs to no longer exists, so a normal
   * server-side sign-out would fail and strand the app on a dead
   * session. Clearing local storage is what actually returns the app
   * to the login screen, via the auth listener in App.tsx.
   */
  deleteAccount: async (): Promise<void> => {
    const { error } = await supabase.rpc('delete_my_account');
    checkError(error);
    await supabase.auth.signOut({ scope: 'local' });
  },
};
