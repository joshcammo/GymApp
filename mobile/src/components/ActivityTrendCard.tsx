import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { ColorTokens } from '../theme/colorways';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../constants/theme';
import { DailyActivityPoint } from '../types';
import { analyticsApi } from '../services/api';
import { parseDateStr } from '../utils/dateUtils';
import { haptics } from '../utils/haptics';

type Window = 7 | 30;

// Derived from the dashboard's own padding rather than hardcoded, so the
// chart can't drift out of sync with the card it sits in (same approach as
// ProgressScreen's CHART_WIDTH).
const SCREEN_PADDING = 16;
const CARD_PADDING   = 16;
const CHART_WIDTH = Dimensions.get('window').width - SCREEN_PADDING * 2 - CARD_PADDING * 2;

/** 1 decimal place, no trailing '.0'. Matches ProgressScreen's fmtKg. */
function fmtKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Compact for axis/summary use: 12.4k above 10,000. */
function fmtCompactKg(kg: number): string {
  if (kg >= 10000) return `${(kg / 1000).toFixed(1)}k`;
  return String(Math.round(kg));
}

/** 'May 19' from a 'YYYY-MM-DD' string */
function fmtShortDate(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

// Stable empty array for the loading and error states, so `rows` — and the
// useMemo below that depends on it — don't change identity on every render.
const NO_POINTS: DailyActivityPoint[] = [];

/**
 * Training volume per day over the last 7 or 30 days, a single series, so
 * one hue and no legend (the title says what's plotted).
 *
 * Volume is strength-only by definition (kg x reps), which is why the
 * caption says so outright: a cardio-only week reads as a flat zero line
 * here, and that would otherwise look like a bug rather than a category
 * that has no tonnage. Cardio's own totals live in the hero card above.
 *
 * A one-line summary sits under the chart so every headline value is
 * readable without touching the chart: the tooltip enhances, it doesn't
 * gate.
 */
export function ActivityTrendCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rangeDays, setRangeDays] = useState<Window>(7);
  const [points, setPoints] = useState<DailyActivityPoint[] | null | 'error'>(null);

  useEffect(() => {
    let stale = false;
    setPoints(null);
    analyticsApi.getDailyActivity(rangeDays)
      .then(data => { if (!stale) setPoints(data); })
      .catch(() => { if (!stale) setPoints('error'); });
    return () => { stale = true; };
  }, [rangeDays]);

  const rows = points === null || points === 'error' ? NO_POINTS : points;

  const totalVolume  = rows.reduce((sum, p) => sum + Number(p.volume_kg), 0);
  const trainedDays  = rows.filter(p => p.exercise_count > 0 || p.cardio_count > 0).length;
  const bestDay      = rows.reduce<DailyActivityPoint | null>(
    (best, p) => (best === null || Number(p.volume_kg) > Number(best.volume_kg) ? p : best),
    null,
  );
  const hasVolume = totalVolume > 0;

  // Label every nth day so 30-day labels don't collide; always label the
  // last point so the axis ends on a known date.
  const labelEvery = rangeDays === 7 ? 1 : 6;
  const chartData = useMemo(() => rows.map((p, i) => {
    const isLast = i === rows.length - 1;
    return {
      value: Math.round(Number(p.volume_kg)),
      label: (i % labelEvery === 0 || isLast) ? fmtShortDate(p.activity_date) : '',
      // Only the endpoint is directly labelled: a value on every point is
      // unreadable, and the summary row below carries the rest.
      dataPointText: isLast && Number(p.volume_kg) > 0 ? fmtCompactKg(Number(p.volume_kg)) : undefined,
    };
  }), [rows, labelEvery]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Training Volume</Text>
          <Text style={styles.caption}>Strength load per day (kg x reps)</Text>
        </View>
        <View style={styles.toggle}>
          {([7, 30] as Window[]).map(w => (
            <TouchableOpacity
              key={w}
              style={[styles.toggleBtn, rangeDays === w && styles.toggleBtnActive]}
              onPress={() => { haptics.tap(); setRangeDays(w); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, rangeDays === w && styles.toggleTextActive]}>{w}d</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {points === null ? (
        <View style={styles.fill}><ActivityIndicator color={colors.primary} /></View>
      ) : points === 'error' ? (
        <View style={styles.fill}>
          <Text style={styles.emptyText}>Could not load your trend right now.</Text>
        </View>
      ) : !hasVolume ? (
        <View style={styles.fill}>
          <Text style={styles.emptyText}>
            No strength volume logged in the last {rangeDays} days.
          </Text>
        </View>
      ) : (
        <>
          <LineChart
            data={chartData}
            width={CHART_WIDTH - 20}
            height={150}
            color={colors.primary}
            thickness={2}
            curved
            areaChart
            startFillColor={colors.primary}
            startOpacity={0.12}
            endOpacity={0.02}
            hideDataPoints={rangeDays === 30}
            dataPointsColor={colors.primary}
            dataPointsRadius={4}
            hideRules={false}
            rulesColor={colors.divider}
            rulesType="solid"
            yAxisTextStyle={{ color: colors.textMuted, fontSize: 11 }}
            xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
            yAxisColor={colors.divider}
            xAxisColor={colors.divider}
            initialSpacing={10}
            endSpacing={10}
            noOfSections={3}
            textColor1={colors.text}
            textFontSize={10}
            pointerConfig={{
              pointerColor: colors.primary,
              radius: 5,
              showPointerStrip: true,
              pointerStripColor: colors.divider,
              pointerStripWidth: 1,
              activatePointersOnLongPress: false,
              activatePointersInstantlyOnTouch: true,
              pointerLabelWidth: 110,
              pointerLabelHeight: 40,
              pointerLabelComponent: (items: { label?: string; value?: number }[]) => (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipValue}>{fmtKg(items[0]?.value ?? 0)} kg</Text>
                  <Text style={styles.tooltipLabel}>{items[0]?.label}</Text>
                </View>
              ),
            }}
          />

          {/* Headline values in text, so nothing is only reachable by tapping the chart. */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{fmtCompactKg(totalVolume)} kg</Text> total
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{trainedDays}</Text> day{trainedDays === 1 ? '' : 's'} trained
            </Text>
            {bestDay && Number(bestDay.volume_kg) > 0 && (
              <Text style={styles.summaryItem}>
                Best <Text style={styles.summaryValue}>{fmtShortDate(bestDay.activity_date)}</Text>
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  card: {
    backgroundColor: colors.bgAlt,
    borderRadius:    RADIUS.lg,
    borderWidth:      1,
    borderColor:      colors.cardBorder,
    padding:         CARD_PADDING,
    marginBottom:    12,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   12,
  },
  headerText: {
    flex: 1,
  },
  heading: {
    fontFamily:    FONT.semibold,
    fontSize:      12,
    color:         colors.textSub,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize:  12,
    color:     colors.textMuted,
    marginTop: 3,
  },
  toggle: {
    flexDirection:   'row',
    backgroundColor: colors.card,
    borderRadius:    RADIUS.sm,
    borderWidth:      1,
    borderColor:      colors.border,
    padding:          3,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:       7,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontFamily: FONT.bold,
    fontSize:   12,
    color:      colors.textMuted,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  fill: {
    height:         150,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize:          13,
    color:             colors.textMuted,
    textAlign:         'center',
    paddingHorizontal: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           14,
    marginTop:     14,
  },
  summaryItem: {
    fontSize: 12,
    color:    colors.textMuted,
  },
  summaryValue: {
    fontFamily: FONT.bold,
    color:      colors.textSub,
  },
  tooltip: {
    backgroundColor:   colors.cardRaised,
    borderRadius:      RADIUS.sm,
    borderWidth:        1,
    borderColor:        colors.border,
    paddingHorizontal: 10,
    paddingVertical:    6,
  },
  tooltipValue: {
    fontFamily: FONT.bold,
    fontSize:   13,
    color:      colors.text,
  },
  tooltipLabel: {
    fontSize: 11,
    color:    colors.textMuted,
  },
});
