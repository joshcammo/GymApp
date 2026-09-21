import React, { useState } from 'react';
import { Alert } from 'react-native';

import { ReportTarget } from '../types/moderation';
import { blocksApi } from '../services/moderation';
import { ReportModal } from './ReportModal';
import { haptics } from '../utils/haptics';

interface Options {
  /**
   * The author was blocked (directly, or as part of a report). The
   * caller should drop that user's content from whatever it is showing
   * — RLS has already hidden it server-side, but the list on screen was
   * fetched before the block existed.
   */
  onBlocked?: (userId: string) => void;
}

/**
 * The ⋯ menu behind every piece of content the signed-in user doesn't
 * own, plus the report sheet it opens.
 *
 * Guideline 1.2 wants reporting and blocking reachable from the content
 * itself, not buried in settings. Three screens need the same two
 * actions with the same wording and the same follow-up, so the Alert,
 * the modal and the block handling live here rather than being pasted
 * into each of them.
 *
 * Usage:
 *   const { openMenu, reportSheet } = useContentActions({ onBlocked });
 *   ...
 *   <PostCard onMenu={() => openMenu(target)} />
 *   {reportSheet}
 */
export function useContentActions({ onBlocked }: Options = {}) {
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const block = async (target: ReportTarget) => {
    try {
      await blocksApi.block(target.authorId);
      haptics.success();
      onBlocked?.(target.authorId);
    } catch (e) {
      Alert.alert('Could not block', (e as Error).message ?? 'Please try again.');
    }
  };

  const confirmBlock = (target: ReportTarget) => {
    const who = target.authorName ? `@${target.authorName}` : 'this user';
    haptics.warning();
    Alert.alert(
      `Block ${who}?`,
      "You'll stop seeing each other's posts and comments, any friendship between you ends, " +
      "and they won't be able to send you friend requests. You can undo this in Settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => block(target) },
      ],
    );
  };

  /** Opens the ⋯ menu for content belonging to someone else. */
  const openMenu = (target: ReportTarget) => {
    const who = target.authorName ? `@${target.authorName}` : 'this user';
    haptics.tap();
    Alert.alert(who, undefined, [
      { text: 'Report…', style: 'destructive', onPress: () => setReportTarget(target) },
      { text: 'Block',   style: 'destructive', onPress: () => confirmBlock(target) },
      { text: 'Cancel',  style: 'cancel' },
    ]);
  };

  const reportSheet = (
    <ReportModal
      target={reportTarget}
      onClose={() => setReportTarget(null)}
      onDone={(target, blocked) => {
        setReportTarget(null);
        if (blocked) onBlocked?.(target.authorId);
      }}
    />
  );

  return { openMenu, confirmBlock, reportSheet };
}
