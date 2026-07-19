import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

const createStyles = (colors: ColorTokens) => StyleSheet.create({
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
    color:      colors.textSub,
    textAlign:  'center',
  },
  sub: {
    fontSize:   14,
    color:      colors.textMuted,
    textAlign:  'center',
    marginTop:   8,
    lineHeight: 20,
  },
  action: {
    marginTop: 20,
  },
});
