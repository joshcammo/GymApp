import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../constants/colors';
import { FONT } from '../constants/theme';
import { Logo } from './Logo';

interface Props {
  emoji?:      string;
  message:     string;
  subMessage?: string;
  /** Optional extra content (e.g. a secondary action button) below the text. */
  action?:     React.ReactNode;
}

export function EmptyState({ emoji, message, subMessage, action }: Props) {
  return (
    <View style={styles.container}>
      {emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : (
        <View style={styles.logoWrap}>
          <Logo size={64} />
        </View>
      )}
      <Text style={styles.message}>{message}</Text>
      {subMessage ? <Text style={styles.sub}>{subMessage}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:              1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 32,
    paddingBottom:     80,
  },
  emoji: {
    fontSize:     52,
    marginBottom: 16,
  },
  logoWrap: {
    marginBottom: 20,
    opacity:      0.55,
  },
  message: {
    fontFamily: FONT.semibold,
    fontSize:   19,
    color:      COLORS.textSub,
    textAlign:  'center',
  },
  sub: {
    fontSize:   14,
    color:      COLORS.textMuted,
    textAlign:  'center',
    marginTop:   8,
    lineHeight: 20,
  },
  action: {
    marginTop: 20,
  },
});
