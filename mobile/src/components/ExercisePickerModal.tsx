import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, FlatList, Image,
  TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { EXERCISE_CATALOG, ExerciseCategory } from '../constants/exerciseCatalog';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  /** Called with the chosen exercise name; caller closes the modal. */
  onSelect: (name: string) => void;
}

/**
 * Two-level exercise browser: body-part categories → illustrated exercises.
 * Picking one fills the free-text name field on AddExerciseScreen — users
 * can always ignore this and type a custom name instead.
 */
export function ExercisePickerModal({ visible, onClose, onSelect }: Props) {
  const [category, setCategory] = useState<ExerciseCategory | null>(null);

  // Reset to the category list when the picker opens (not when it closes) —
  // resetting on close makes the content visibly flip back to the category
  // list during the slide-down animation.
  useEffect(() => {
    if (visible) setCategory(null);
  }, [visible]);

  const pick = (name: string) => {
    haptics.tap();
    onSelect(name);
  };

  // Android hardware-back steps up one level; on iOS onRequestClose fires
  // after a pageSheet swipe-dismiss, when the sheet is already natively
  // gone — anything but a full close would desync `visible` from reality
  // and permanently block reopening.
  const handleRequestClose =
    Platform.OS === 'android' && category ? () => setCategory(null) : onClose;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleRequestClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          {category ? (
            <TouchableOpacity
              onPress={() => setCategory(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.headerBtn}
            >
              <Feather name="chevron-left" size={22} color={COLORS.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn} />
          )}
          <Text style={styles.headerTitle}>{category ? category.name : 'Exercises'}</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Feather name="x" size={22} color={COLORS.textSub} />
          </TouchableOpacity>
        </View>

        {category ? (
          /* ── Exercise list ── */
          <FlatList
            data={category.exercises}
            keyExtractor={item => item.name}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <PressableScale style={styles.row} onPress={() => pick(item.name)} pressScale={0.98}>
                <Image source={item.image} style={styles.thumb} />
                <Text style={[styles.rowText, styles.rowTextFill]}>{item.name}</Text>
                <Feather name="plus" size={18} color={COLORS.primary} />
              </PressableScale>
            )}
          />
        ) : (
          /* ── Category list ── */
          <FlatList
            data={EXERCISE_CATALOG}
            keyExtractor={item => item.name}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <PressableScale style={styles.row} onPress={() => { haptics.tap(); setCategory(item); }} pressScale={0.98}>
                {/* Guard: a category stubbed out with no exercises must not crash the picker */}
                {item.exercises[0] ? (
                  <Image source={item.exercises[0].image} style={styles.thumb} />
                ) : (
                  <View style={styles.thumb} />
                )}
                <View style={styles.categoryText}>
                  <Text style={styles.rowText}>{item.name}</Text>
                  <Text style={styles.rowSub}>{item.exercises.length} exercises</Text>
                </View>
                <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
              </PressableScale>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth:  1,
    borderBottomColor:  COLORS.divider,
  },
  headerBtn: {
    width:      32,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONT.semibold,
    fontSize:   17,
    color:      COLORS.text,
  },
  listContent: {
    padding: 16,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.lg,
    padding:           10,
    paddingRight:      16,
    marginBottom:      10,
    borderWidth:        1,
    borderColor:        COLORS.cardBorder,
  },
  thumb: {
    width:           56,
    height:          56,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.bgAlt,
  },
  categoryText: {
    flex: 1,
  },
  rowText: {
    fontFamily: FONT.medium,
    fontSize:   16,
    color:      COLORS.text,
  },
  rowTextFill: {
    flex: 1,
  },
  rowSub: {
    fontSize:  12,
    color:     COLORS.textMuted,
    marginTop:  2,
  },
});
