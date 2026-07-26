import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { haptics } from '../utils/haptics';

const REST_DURATION_KEY = '@gym_tracker_rest_duration';
const PRESETS = [30, 60, 90, 120, 180]; // seconds

const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Optional rest-between-sets countdown. Fully self-contained (own
 * AsyncStorage-persisted duration, own interval). Drop it in wherever
 * sets are being logged. Never tied to save/add-set actions; the user
 * starts and stops it manually.
 */
export function RestTimer() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [duration,  setDuration]  = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running,   setRunning]   = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(REST_DURATION_KEY).then(saved => {
      const secs = saved ? Number(saved) : NaN;
      if (PRESETS.includes(secs)) {
        setDuration(secs);
        setRemaining(secs);
      }
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id);
          setRunning(false);
          finishedRef.current = true;
          haptics.success();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const selectPreset = (secs: number) => {
    haptics.tap();
    setDuration(secs);
    setRemaining(secs);
    setRunning(false);
    finishedRef.current = false;
    AsyncStorage.setItem(REST_DURATION_KEY, String(secs));
  };

  const toggleRunning = () => {
    haptics.tap();
    if (!running && (remaining === 0 || finishedRef.current)) {
      finishedRef.current = false;
      setRemaining(duration);
    }
    setRunning(r => !r);
  };

  const reset = () => {
    haptics.tap();
    setRunning(false);
    finishedRef.current = false;
    setRemaining(duration);
  };

  const done = remaining === 0 && !running;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="clock" size={14} color={colors.primary} />
        <Text style={styles.headerText}>Rest Timer</Text>
      </View>

      <View style={styles.presetRow}>
        {PRESETS.map(secs => (
          <TouchableOpacity
            key={secs}
            style={[styles.chip, duration === secs && styles.chipActive]}
            onPress={() => selectPreset(secs)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, duration === secs && styles.chipTextActive]}>
              {secs < 60 ? `${secs}s` : `${secs / 60}m${secs % 60 ? ` ${secs % 60}s` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.controlRow}>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={reset}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="rotate-ccw" size={17} color={colors.textSub} />
        </TouchableOpacity>

        <Text style={[styles.countdown, done && styles.countdownDone]}>
          {formatTime(remaining)}
        </Text>

        <TouchableOpacity style={styles.playBtn} onPress={toggleRunning} activeOpacity={0.8}>
          <Feather name={running ? 'pause' : 'play'} size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  card: {
    backgroundColor: colors.bgAlt,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    padding:         16,
    marginBottom:    14,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  12,
  },
  headerText: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         colors.textSub,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  presetRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  16,
  },
  chip: {
    flex:              1,
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingVertical:    8,
    alignItems:        'center',
  },
  chipActive: {
    backgroundColor: colors.primaryBg,
    borderColor:     colors.primary,
  },
  chipText: {
    fontFamily: FONT.medium,
    fontSize:   12,
    color:      colors.textSub,
  },
  chipTextActive: {
    color:      colors.primary,
    fontFamily: FONT.bold,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
    gap:           20,
  },
  countdown: {
    fontFamily: FONT.bold,
    fontSize:   36,
    color:      colors.text,
    minWidth:   110,
    textAlign:  'center',
    fontVariant: ['tabular-nums'],
  },
  countdownDone: {
    color: colors.primary,
  },
  resetBtn: {
    width:           40,
    height:          40,
    borderRadius:    RADIUS.pill,
    backgroundColor: colors.card,
    borderWidth:      1,
    borderColor:      colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  playBtn: {
    width:           48,
    height:          48,
    borderRadius:    RADIUS.pill,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
