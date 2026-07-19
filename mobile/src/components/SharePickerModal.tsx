import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { MyExercisePr, ShareTarget } from '../types';
import { postsApi } from '../services/social';
import { PressableScale } from './PressableScale';
import { haptics } from '../utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** An exercise was picked — caller should close this modal and open SharePostModal with it. */
  onPick:  (target: ShareTarget) => void;
}

/** Bottom-sheet list of every exercise the caller has a current PR for, so
 *  they can share one without having to find a PR'd entry in the day view. */
export function SharePickerModal({ visible, onClose, onPick }: Props) {
  const [prs,     setPrs]     = useState<MyExercisePr[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    postsApi.myPrs()
      .then(setPrs)
      .catch(e => setError((e as Error).message ?? 'Could not load your PRs'))
      .finally(() => setLoading(false));
  }, [visible]);

  const pick = (pr: MyExercisePr) => {
    haptics.tap();
    onPick({
      exerciseDefId: pr.exercise_def_id,
      exerciseName:  pr.name,
      weight:        pr.weight,
      reps:          pr.reps,
      unit:          pr.unit,
    });
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
          <Text style={styles.headerTitle}>Share a PR</Text>
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
          </View>
        ) : (
          <FlatList
            data={prs ?? []}
            keyExtractor={p => String(p.exercise_def_id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <PressableScale style={styles.row} onPress={() => pick(item)} pressScale={0.98}>
                <View style={styles.iconTile}>
                  <Feather name="award" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowSub}>
                    {item.reps ? `${item.reps} × ${item.weight} ${item.unit}` : `${item.weight} ${item.unit}`}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
              </PressableScale>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No PRs yet.</Text>
                <Text style={styles.emptySub}>
                  Log a weighted set for any exercise, then come back here to share it.
                </Text>
              </View>
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
  },
  errorText: {
    color:             COLORS.textSub,
    fontSize:          14,
    textAlign:         'center',
    paddingHorizontal: 32,
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
});
