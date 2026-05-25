import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

interface Props {
  emoji?:      string;
  message:     string;
  subMessage?: string;
}

export function EmptyState({ emoji = '🏋️', message, subMessage }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.message}>{message}</Text>
      {subMessage ? <Text style={styles.sub}>{subMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    paddingHorizontal: 32,
    paddingBottom:  80,
  },
  emoji: {
    fontSize:    52,
    marginBottom: 16,
  },
  message: {
    fontSize:   20,
    fontWeight: '700',
    color:      COLORS.textSub,
    textAlign:  'center',
  },
  sub: {
    fontSize:  14,
    color:     COLORS.textMuted,
    textAlign: 'center',
    marginTop:  8,
    lineHeight: 20,
  },
});
