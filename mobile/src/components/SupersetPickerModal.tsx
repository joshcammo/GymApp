import React, { useMemo } from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { Exercise } from '../types';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  visible: boolean;
  /** Candidate partners: the caller's already-loaded list of that day's
   *  exercises, with the one being added/edited filtered out. */
  exercises: Exercise[];
  onClose:  () => void;
  /** null clears the link. */
  onSelect: (partner: { id: number; name: string } | null) => void;
}

/**
 * Picker for pairing the exercise being added/edited with another one
 * already logged the same day, to form a superset. Unlike the catalog
 * picker this list is just that day's log, with no search or categories.
 */
export function SupersetPickerModal({ visible, exercises, onClose, onSelect }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pick = (partner: { id: number; name: string } | null) => {
    haptics.tap();
    onSelect(partner);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.header}>
          <View style={styles.headerBtn} />
          <Text style={styles.headerTitle}>Superset With</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Feather name="x" size={22} color={colors.textSub} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={exercises}
          keyExtractor={e => String(e.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <PressableScale style={styles.row} onPress={() => pick(null)} pressScale={0.98}>
              <View style={[styles.iconTile, styles.iconTileMuted]}>
                <Feather name="slash" size={18} color={colors.textMuted} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>None</Text>
                <Text style={styles.rowSub}>Log this exercise on its own</Text>
              </View>
            </PressableScale>
          }
          renderItem={({ item }) => {
            // Only found (and shown) when the partner is someone other than
            // the exercise being edited. Picking this row would silently
            // break that other pairing, so flag it up front.
            const partnerName = item.superset_partner_id != null
              ? exercises.find(e => e.id === item.superset_partner_id)?.name
              : undefined;
            return (
              <PressableScale
                style={styles.row}
                onPress={() => pick({ id: item.id, name: item.name })}
                pressScale={0.98}
              >
                <View style={styles.iconTile}>
                  <Feather name="link" size={18} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  {partnerName ? (
                    <Text style={styles.rowSub}>Already superset with {partnerName}</Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </PressableScale>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No other exercises logged this day yet.</Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth:  1,
    borderBottomColor:  colors.divider,
  },
  headerBtn: {
    width:      32,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONT.semibold,
    fontSize:   17,
    color:      colors.text,
  },
  listContent: {
    padding: 16,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    backgroundColor:   colors.card,
    borderRadius:      RADIUS.lg,
    padding:           10,
    paddingRight:      16,
    marginBottom:      10,
    borderWidth:        1,
    borderColor:        colors.cardBorder,
  },
  iconTile: {
    width:           44,
    height:          44,
    borderRadius:    RADIUS.md,
    backgroundColor: colors.primaryBg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconTileMuted: {
    backgroundColor: colors.bgAlt,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONT.medium,
    fontSize:   16,
    color:      colors.text,
  },
  rowSub: {
    fontSize:  12,
    color:     colors.textMuted,
    marginTop:  2,
  },
  emptyText: {
    color:      colors.textMuted,
    fontSize:   14,
    textAlign:  'center',
    marginTop:  24,
  },
});
