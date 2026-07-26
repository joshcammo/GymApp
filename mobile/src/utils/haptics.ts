import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptic helpers. No-ops on web, and failures are
 * swallowed: feedback must never break an interaction.
 */
const safe = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
};

export const haptics = {
  /** Light tick: selection changes, toggles, steppers */
  tap:     () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Medium thump: primary button presses */
  press:   () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Positive chime: successful save */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Warning buzz: destructive confirmations */
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
