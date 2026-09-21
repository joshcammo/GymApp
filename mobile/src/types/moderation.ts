/**
 * Moderation types — blocking and content reporting.
 *
 * Kept out of types/index.ts deliberately: these back a self-contained
 * feature added for App Store Guideline 1.2 compliance, and nothing in
 * the existing workout/social types depends on them.
 */

/** A user the caller has blocked, as returned by the my_blocked_users() RPC. */
export interface BlockedUser {
  user_id:      string;
  username:     string | null;
  display_name: string | null;
  created_at:   string;
}

/**
 * Report reasons, matching the CHECK constraint on
 * content_reports.reason in migration 023. Adding one here without
 * adding it there will fail at insert time.
 */
export type ReportReason =
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'spam'
  | 'impersonation'
  | 'other';

/** User-facing label for each reason, in the order the picker shows them. */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment',    label: 'Harassment or bullying' },
  { value: 'hate',          label: 'Hate speech or a slur' },
  { value: 'sexual',        label: 'Sexually explicit content' },
  { value: 'violence',      label: 'Violence or threats' },
  { value: 'spam',          label: 'Spam or a scam' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other',         label: 'Something else' },
];

/** What is being reported. Exactly one id is sent, matching the kind. */
export type ReportTarget =
  | { kind: 'post';    postId: number;    authorId: string; authorName: string | null }
  | { kind: 'comment'; commentId: number; authorId: string; authorName: string | null }
  | { kind: 'user';    userId: string;    authorId: string; authorName: string | null };
