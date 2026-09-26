import { useRef } from 'react';
import { Keyboard, TextInput } from 'react-native';

/** Back/Next focus chaining across a screen's numeric inputs.
 *
 *  `keys` lists every input in visual order and is rebuilt each render, so
 *  adding or removing rows just changes the list. Each input registers its
 *  ref under its key; `next`/`prev` step through the list from a given key.
 *
 *  `accessoryId` gives each input its own iOS InputAccessoryView id.
 *  Sharing one id across several inputs is broken since RN 0.76: the bar
 *  only attaches to the first input focused (facebook/react-native#47865).
 *  `scope` keeps ids unique when two screens using this are both mounted. */
export function useFieldChain(scope: string, keys: string[]) {
  const refs = useRef<Record<string, TextInput | null>>({});

  const register = (key: string) => (el: TextInput | null) => { refs.current[key] = el; };

  const indexOf = (key: string) => keys.indexOf(key);

  const hasPrev = (key: string) => indexOf(key) > 0;
  const hasNext = (key: string) => {
    const i = indexOf(key);
    return i >= 0 && i < keys.length - 1;
  };

  const prev = (key: string) => {
    if (!hasPrev(key)) return;
    refs.current[keys[indexOf(key) - 1]]?.focus();
  };

  // Past the last input there's nowhere to go, so close the keypad. This
  // is also what Android's keyboard next key does on the final box.
  const next = (key: string) => {
    if (!hasNext(key)) {
      Keyboard.dismiss();
      return;
    }
    refs.current[keys[indexOf(key) + 1]]?.focus();
  };

  const accessoryId = (key: string) => `${scope}-${key}`;

  /** Spread onto each chained TextInput: its ref, Android's keyboard next
   *  key, and its own iOS accessory bar (render a KeyboardFieldBar per key). */
  const inputProps = (key: string) => ({
    ref:                  register(key),
    returnKeyType:        'next' as const,
    blurOnSubmit:         false,
    onSubmitEditing:      () => next(key),
    inputAccessoryViewID: accessoryId(key),
  });

  return { keys, prev, next, hasPrev, hasNext, accessoryId, inputProps };
}
