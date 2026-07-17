import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT, RADIUS } from '../constants/theme';
import { RootStackParamList, Preset } from '../types';
import { presetApi } from '../services/api';
import { PressableScale } from '../components/PressableScale';
import { EmptyState } from '../components/EmptyState';
import { haptics } from '../utils/haptics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Presets'>;
interface Props { navigation: Nav }

export function PresetsScreen({ navigation }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPresets(await presetApi.list());
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Failed to load presets');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerAdd}
          onPress={() => navigation.navigate('EditPreset', {})}
        >
          <Feather name="plus" size={15} color={COLORS.primary} />
          <Text style={styles.headerAddText}>New</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleDelete = (preset: Preset) => {
    haptics.warning();
    Alert.alert(
      'Delete Preset',
      `Delete "${preset.name}"? This won't remove exercises already logged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:  'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await presetApi.delete(preset.id);
              haptics.success();
              setPresets(prev => prev.filter(p => p.id !== preset.id));
            } catch (e) {
              Alert.alert('Error', 'Could not delete preset. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : presets.length === 0 ? (
        <EmptyState
          message="No presets yet"
          subMessage="Tap 'New' in the top-right corner to group exercises into a reusable day, like 'Monday - Chest and Triceps'."
        />
      ) : (
        <FlatList
          data={presets}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <PressableScale
              style={styles.row}
              onPress={() => navigation.navigate('EditPreset', { preset: item })}
              pressScale={0.98}
            >
              <View style={styles.iconTile}>
                <Feather name="layers" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSub} numberOfLines={2}>
                  {item.exercises.map(e => e.name).join(', ') || 'No exercises'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="trash-2" size={15} color={COLORS.danger} />
              </TouchableOpacity>
            </PressableScale>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  centred: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
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
  deleteBtn: {
    width:           30,
    height:          30,
    borderRadius:    RADIUS.sm,
    backgroundColor: COLORS.dangerBg,
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      4,
  },
  headerAdd: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 10,
    paddingVertical:    6,
    borderRadius:      RADIUS.pill,
    backgroundColor:   COLORS.primaryBg,
  },
  headerAddText: {
    fontFamily: FONT.bold,
    fontSize:   14,
    color:      COLORS.primary,
  },
});
