import React, { useRef } from 'react';
import {
  Animated, Pressable, StyleProp, ViewStyle,
  GestureResponderEvent, Insets,
} from 'react-native';

// Animate the Pressable itself so layout styles (position, margins) stay on
// the touchable and the hit target always matches the visible bounds.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  onPress?:   (e: GestureResponderEvent) => void;
  disabled?:  boolean;
  style?:     StyleProp<ViewStyle>;
  children:   React.ReactNode;
  hitSlop?:   Insets;
  /** How far the press sinks the element (default 0.97) */
  pressScale?: number;
}

/**
 * Touchable that sinks slightly on press, used in place of
 * TouchableOpacity so every tappable surface responds the same way.
 */
export function PressableScale({
  onPress, disabled, style, children, hitSlop, pressScale = 0.97,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) =>
    Animated.spring(scale, {
      toValue:         value,
      useNativeDriver: true,
      speed:           40,
      bounciness:      4,
    }).start();

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={()  => animateTo(pressScale)}
      onPressOut={() => animateTo(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
