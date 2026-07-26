import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import { FONT } from '../constants/theme';
import { useTheme } from '../theme/ThemeContext';
import { MainTabParamList } from '../types';
import { HomeScreen } from '../screens/HomeScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { SocialScreen } from '../screens/SocialScreen';
import { ProgressScreen } from '../screens/ProgressScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Feather.glyphMap> = {
  HomeTab:    'home',
  WorkoutTab: 'edit-3',
  SocialTab:  'users',
  StatsTab:   'bar-chart-2',
};

/** Bottom tabs shown once signed in and past the username gate. */
export function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: keyof MainTabParamList } }) => ({
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgAlt,
          borderTopColor:  colors.border,
        },
        tabBarLabelStyle: { fontFamily: FONT.medium, fontSize: 11 },
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Feather name={ICONS[route.name]} size={size} color={color} />
        ),
        headerStyle:       { backgroundColor: colors.bgAlt },
        headerTintColor:   colors.text,
        headerTitleStyle:  { fontFamily: FONT.semibold, fontSize: 17 },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ headerShown: false, tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="WorkoutTab"
        component={WorkoutScreen}
        options={{ title: 'Workout', tabBarLabel: 'Workout' }}
      />
      <Tab.Screen
        name="SocialTab"
        component={SocialScreen}
        options={{ title: 'Social', tabBarLabel: 'Social' }}
      />
      <Tab.Screen
        name="StatsTab"
        component={ProgressScreen}
        options={{ title: 'Stats', tabBarLabel: 'Stats' }}
      />
    </Tab.Navigator>
  );
}
