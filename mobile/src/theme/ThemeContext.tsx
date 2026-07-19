import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORWAYS, COLORWAY_IDS, ColorTokens, ColorwayId } from './colorways';

const COLORWAY_KEY = '@gym_tracker_colorway';
const MODE_KEY      = '@gym_tracker_theme_mode';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colors:       ColorTokens;
  colorwayId:   ColorwayId;
  mode:         ThemeMode;
  /** 'system' resolved against the device scheme — what actually renders. */
  effectiveMode: 'light' | 'dark';
  setColorwayId: (id: ColorwayId) => void;
  setMode:       (mode: ThemeMode) => void;
  colorwayList:  { id: ColorwayId; label: string }[];
}

// Sensible pre-load default — matches the app's original always-dark look,
// so there's no flash of the wrong theme while AsyncStorage resolves.
const DEFAULT_COLORWAY: ColorwayId = 'ember';
const DEFAULT_MODE: ThemeMode = 'dark';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [colorwayId, setColorwayIdState] = useState<ColorwayId>(DEFAULT_COLORWAY);
  const [mode, setModeState]             = useState<ThemeMode>(DEFAULT_MODE);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(COLORWAY_KEY),
      AsyncStorage.getItem(MODE_KEY),
    ]).then(([savedColorway, savedMode]) => {
      if (savedColorway && (COLORWAY_IDS as string[]).includes(savedColorway)) {
        setColorwayIdState(savedColorway as ColorwayId);
      }
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
        setModeState(savedMode);
      }
    });
  }, []);

  const setColorwayId = useCallback((id: ColorwayId) => {
    setColorwayIdState(id);
    AsyncStorage.setItem(COLORWAY_KEY, id);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next);
  }, []);

  const effectiveMode: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;

  const colors = COLORWAYS[colorwayId][effectiveMode];

  const colorwayList = useMemo(
    () => COLORWAY_IDS.map(id => ({ id, label: COLORWAYS[id].label })),
    [],
  );

  const value: ThemeContextValue = {
    colors, colorwayId, mode, effectiveMode, setColorwayId, setMode, colorwayList,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
