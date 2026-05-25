import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

interface Props {
  weekNumber: number;
  weekRange:  string;
  weekOffset: number;
  onPrev:     () => void;
  onNext:     () => void;
}

export function WeekNavigator({ weekNumber, weekRange, weekOffset, onPrev, onNext }: Props) {
  const isCurrentWeek = weekOffset === 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrev} style={styles.arrow} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.arrowText}>‹</Text>
      </TouchableOpacity>

      <View style={styles.middle}>
        <View style={styles.weekRow}>
          <Text style={styles.weekLabel}>Week</Text>
          <Text style={styles.weekNumber}>{weekNumber}</Text>
          {isCurrentWeek && (
            <View style={styles.nowBadge}>
              <Text style={styles.nowText}>NOW</Text>
            </View>
          )}
        </View>
        <Text style={styles.range}>{weekRange}</Text>
      </View>

      <TouchableOpacity onPress={onNext} style={styles.arrow} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.arrowText}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor: COLORS.bgAlt,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  arrow: {
    width: 36,
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 28,
    color:    COLORS.textSub,
    lineHeight: 32,
  },
  middle: {
    flex:      1,
    alignItems: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  weekLabel: {
    fontSize:   14,
    color:      COLORS.textMuted,
    fontWeight: '500',
  },
  weekNumber: {
    fontSize:   22,
    fontWeight: '800',
    color:      COLORS.text,
    letterSpacing: -0.5,
  },
  nowBadge: {
    backgroundColor: COLORS.primaryBg,
    borderRadius:    6,
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  nowText: {
    fontSize:   10,
    fontWeight: '700',
    color:      COLORS.primary,
    letterSpacing: 0.5,
  },
  range: {
    fontSize:  13,
    color:     COLORS.textMuted,
    marginTop: 3,
  },
});
