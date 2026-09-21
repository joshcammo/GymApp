import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { Post } from '../types';
import { timeAgo } from '../utils/dateUtils';
import { PressableScale } from './PressableScale';
import { Avatar } from './Avatar';
import { haptics } from '../utils/haptics';

interface Props {
  post:             Post;
  onToggleLike:     (post: Post) => void;
  /** Tapping the card body / comment count. Omit to render a non-navigable card. */
  onPressComments?: () => void;
  /**
   * The ⋯ overflow menu. The caller decides what it contains: delete for
   * the caller's own posts, report/block for everyone else's (Guideline
   * 1.2 wants both reachable from the content itself). Omit to hide it.
   */
  onMenu?:          () => void;
}

/** '8 × 60 KG' or '60 KG' if reps weren't logged for the shared set. */
function setSummary(post: Post): string {
  return post.reps ? `${post.reps} × ${post.weight} ${post.unit}` : `${post.weight} ${post.unit}`;
}

export function PostCard({ post, onToggleLike, onPressComments, onMenu }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const name = post.display_name || post.username || 'Someone';

  return (
    <PressableScale style={styles.container} onPress={onPressComments} pressScale={0.99}>
      <View style={styles.topRow}>
        <Avatar name={name} size={36} />
        <View style={styles.identity}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>{post.username ? `@${post.username}` : ''} · {timeAgo(post.created_at)}</Text>
        </View>
        {onMenu && (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={onMenu}
            accessibilityLabel="Post options"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="more-horizontal" size={18} color={colors.textSub} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.liftRow}>
        <Feather name="award" size={14} color={colors.primary} />
        <Text style={styles.exerciseName}>{post.exercise_name}</Text>
      </View>

      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{setSummary(post)}</Text>
        </View>
        {post.e1rm_kg != null && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>Est. 1RM {post.e1rm_kg} KG</Text>
          </View>
        )}
      </View>

      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => { haptics.tap(); onToggleLike(post); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="heart" size={16} color={post.liked_by_me ? colors.danger : colors.textSub} />
          <Text style={[styles.actionText, post.liked_by_me && styles.actionTextActive]}>
            {post.like_count}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onPressComments}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="message-circle" size={16} color={colors.textSub} />
          <Text style={styles.actionText}>{post.comment_count}</Text>
        </TouchableOpacity>
      </View>
    </PressableScale>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    padding:         16,
    marginBottom:    10,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  identity: {
    flex: 1,
  },
  name: {
    fontFamily: FONT.semibold,
    fontSize:   15,
    color:      colors.text,
  },
  meta: {
    fontSize:  12,
    color:     colors.textMuted,
    marginTop:  1,
  },
  menuBtn: {
    width:           28,
    height:          28,
    borderRadius:    RADIUS.sm,
    backgroundColor: colors.bgAlt,
    alignItems:      'center',
    justifyContent:  'center',
  },
  liftRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
    marginTop:     14,
  },
  exerciseName: {
    fontFamily: FONT.semibold,
    fontSize:   16,
    color:      colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    marginTop:     10,
  },
  chip: {
    backgroundColor:   colors.bgAlt,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingHorizontal: 11,
    paddingVertical:    5,
  },
  chipText: {
    fontFamily: FONT.medium,
    fontSize:   12,
    color:      colors.textSub,
  },
  caption: {
    fontSize:   14,
    color:      colors.textSub,
    marginTop:  10,
    lineHeight: 19,
  },
  actionsRow: {
    flexDirection: 'row',
    gap:           20,
    marginTop:     14,
    paddingTop:    12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  actionText: {
    fontFamily: FONT.medium,
    fontSize:   13,
    color:      colors.textSub,
  },
  actionTextActive: {
    color: colors.danger,
  },
});
