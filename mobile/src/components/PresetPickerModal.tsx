import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { Preset } from '../types';
import { presetApi } from '../services/api';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  visible: boolean;
  /** Date ('YYYY-MM-DD') the chosen preset is applied to. */
  date:    string;
  onClose: () => void;
  /** Called after a preset has been applied — caller should reload the day. */
  onApplied: () => void;
  /** Navigate to the full preset management screen. */
  onManage:  () => void;
}

/**
 * Bottom-sheet list of the caller's saved presets. Tapping one applies it
 * to `date` immediately (appending exercises, same as adding them one at a
 * time) and closes. A footer link hands off to full preset management.
 */
export function PresetPickerModal({ visible, date, onClose, onApplied, onManage }: Props) {
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    presetApi.list()
      .then(setPresets)
      .catch(e => setError((e as Error).message ?? 'Could not load presets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  const apply = async (preset: Preset) => {
    if (applyingId) return;
    haptics.tap();
    setApplyingId(preset.id);
    try {
      await presetApi.applyToDay(preset.id, date);
      haptics.success();
      onApplied();
      onClose();
    } catch (e) {
      haptics.warning();
      setError((e as Error).message ?? 'Could not apply preset');
    } finally {
      setApplyingId(null);
    }
  };

  const manage = () => {
    haptics.tap();
    onClose();
    onManage();
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
          <Text style={styles.headerTitle}>Load Preset</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Feather name="x" size={22} color={COLORS.textSub} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.centred}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={presets ?? []}
            keyExtractor={p => String(p.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <PressableScale
                style={styles.row}
                onPress={() => apply(item)}
                pressScale={0.98}
              >
                <View style={styles.iconTile}>
                  <Feather name="layers" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowSub}>
                    {item.exercises.length} exercise{item.exercises.length === 1 ? '' : 's'}
                  </Text>
                </View>
                {applyingId === item.id ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
                )}
              </PressableScale>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No presets yet.</Text>
                <Text style={styles.emptySub}>
                  Create one to quickly log a recurring day, like "Monday - Chest and Triceps".
                </Text>
              </View>
            }
            ListFooterComponent={
              <TouchableOpacity style={styles.manageBtn} onPress={manage} activeOpacity={0.7}>
                <Feather name="settings" size={15} color={COLORS.primary} />
                <Text style={styles.manageBtnText}>Manage Presets</Text>
              </TouchableOpacity>
            }
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
  centred: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            14,
  },
  errorText: {
    color:             COLORS.textSub,
    fontSize:          14,
    textAlign:         'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    backgroundColor:   COLORS.primaryBg,
    borderRadius:      RADIUS.pill,
    borderWidth:        1,
    borderColor:        COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical:    8,
  },
  retryText: {
    fontFamily: FONT.bold,
    fontSize:   13,
    color:      COLORS.primary,
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
  iconTile: {
    width:           44,
    height:          44,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.primaryBg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONT.medium,
    fontSize:   16,
    color:      COLORS.text,
  },
  rowSub: {
    fontSize:  12,
    color:     COLORS.textMuted,
    marginTop:  2,
  },
  emptyWrap: {
    paddingTop:        24,
    paddingHorizontal: 8,
  },
  emptyText: {
    fontFamily: FONT.semibold,
    fontSize:   16,
    color:      COLORS.textSub,
    textAlign:  'center',
  },
  emptySub: {
    fontSize:   13,
    color:      COLORS.textMuted,
    textAlign:  'center',
    marginTop:   8,
    lineHeight: 19,
  },
  manageBtn: {
    flexDirection:   'row',
    gap:             7,
    marginTop:       8,
    paddingVertical: 14,
    borderRadius:    RADIUS.md,
    borderWidth:      1,
    borderStyle:     'dashed',
    borderColor:      COLORS.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  manageBtnText: {
    fontFamily:    FONT.bold,
    fontSize:      13,
    color:         COLORS.primary,
    letterSpacing: 0.4,
  },
});
