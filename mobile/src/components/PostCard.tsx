import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { Post } from '../types';
import { timeAgo } from '../utils/dateUtils';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  post:             Post;
  onToggleLike:     (post: Post) => void;
  /** Tapping the card body / comment count — omit to render a non-navigable card. */
  onPressComments?: () => void;
  /** Only passed for the caller's own posts. */
  onDelete?:        () => void;
}

/** '8 × 60 KG' or '60 KG' if reps weren't logged for the shared set. */
function setSummary(post: Post): string {
  return post.reps ? `${post.reps} × ${post.weight} ${post.unit}` : `${post.weight} ${post.unit}`;
}

export function PostCard({ post, onToggleLike, onPressComments, onDelete }: Props) {
  const name = post.display_name || post.username || 'Someone';

  return (
    <PressableScale style={styles.container} onPress={onPressComments} pressScale={0.99}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>{post.username ? `@${post.username}` : ''} · {timeAgo(post.created_at)}</Text>
        </View>
        {onDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="trash-2" size={14} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.liftRow}>
        <Feather name="award" size={14} color={COLORS.primary} />
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
          <Feather name="heart" size={16} color={post.liked_by_me ? COLORS.danger : COLORS.textSub} />
          <Text style={[styles.actionText, post.liked_by_me && styles.actionTextActive]}>
            {post.like_count}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onPressComments}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="message-circle" size={16} color={COLORS.textSub} />
          <Text style={styles.actionText}>{post.comment_count}</Text>
        </TouchableOpacity>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    padding:         16,
    marginBottom:    10,
    borderWidth:      1,
    borderColor:      COLORS.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  avatar: {
    width:           36,
    height:          36,
    borderRadius:    RADIUS.pill,
    backgroundColor: COLORS.primaryBg,
    borderWidth:      1,
    borderColor:      COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     10,
  },
  avatarText: {
    fontFamily: FONT.bold,
    fontSize:   15,
    color:      COLORS.primary,
  },
  identity: {
    flex: 1,
  },
  name: {
    fontFamily: FONT.semibold,
    fontSize:   15,
    color:      COLORS.text,
  },
  meta: {
    fontSize:  12,
    color:     COLORS.textMuted,
    marginTop:  1,
  },
  deleteBtn: {
    width:           28,
    height:          28,
    borderRadius:    RADIUS.sm,
    backgroundColor: COLORS.dangerBg,
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
    color:      COLORS.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    marginTop:     10,
  },
  chip: {
    backgroundColor:   COLORS.bgAlt,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        COLORS.border,
    paddingHorizontal: 11,
    paddingVertical:    5,
  },
  chipText: {
    fontFamily: FONT.medium,
    fontSize:   12,
    color:      COLORS.textSub,
  },
  caption: {
    fontSize:   14,
    color:      COLORS.textSub,
    marginTop:  10,
    lineHeight: 19,
  },
  actionsRow: {
    flexDirection: 'row',
    gap:           20,
    marginTop:     14,
    paddingTop:    12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  actionText: {
    fontFamily: FONT.medium,
    fontSize:   13,
    color:      COLORS.textSub,
  },
  actionTextActive: {
    color: COLORS.danger,
  },
});
