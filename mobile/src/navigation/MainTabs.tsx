import React, { useCallback, useEffect, useState } from 'react';
import { createBottomTabNavigator, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../constants/colors';
import { FONT } from '../constants/theme';
import { MainTabParamList } from '../types';
import { friendsApi } from '../services/social';
import { HomeScreen } from '../screens/HomeScreen';
import { SocialScreen } from '../screens/SocialScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ProgressScreen } from '../screens/ProgressScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Feather.glyphMap> = {
  HomeTab:    'home',
  FeedTab:    'activity',
  FriendsTab: 'users',
  StatsTab:   'bar-chart-2',
};

/** Bottom tabs shown once signed in and past the username gate. Owns the
 *  pending-friend-request count so the Friends tab can badge it — refreshed
 *  on mount, on any tab press, and immediately after FriendsScreen resolves
 *  a request (no push notifications exist, so this polling-on-interaction
 *  approach is the closest to "real time" without that infrastructure). */
export function MainTabs() {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const friendships = await friendsApi.list();
      setPendingCount(friendships.filter(f => f.status === 'pending' && !f.is_requester).length);
    } catch {
      // The badge is a nicety, not critical — leave the last known count.
    }
  }, []);

  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: keyof MainTabParamList } }) => ({
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.bgAlt,
          borderTopColor:  COLORS.border,
        },
        tabBarLabelStyle: { fontFamily: FONT.medium, fontSize: 11 },
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <Feather name={ICONS[route.name]} size={size} color={color} />
        ),
        headerStyle:       { backgroundColor: COLORS.bgAlt },
        headerTintColor:   COLORS.text,
        headerTitleStyle:  { fontFamily: FONT.semibold, fontSize: 17 },
        headerShadowVisible: false,
      })}
      screenListeners={{
        tabPress: () => { refreshPendingCount(); },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ headerShown: false, tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="FeedTab"
        component={SocialScreen}
        options={{ title: 'Feed', tabBarLabel: 'Feed' }}
      />
      <Tab.Screen
        name="FriendsTab"
        options={{
          title: 'Friends',
          tabBarLabel: 'Friends',
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      >
        {(props: BottomTabScreenProps<MainTabParamList, 'FriendsTab'>) => (
          <FriendsScreen {...props} onRequestsChanged={refreshPendingCount} />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="StatsTab"
        component={ProgressScreen}
        options={{ title: 'Stats', tabBarLabel: 'Stats' }}
      />
    </Tab.Navigator>
  );
}
