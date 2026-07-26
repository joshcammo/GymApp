import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

import { FONT } from './src/constants/theme';
import { RootStackParamList, Profile } from './src/types';
import { supabase } from './src/lib/supabase';
import { profileApi } from './src/services/social';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { LoginScreen }           from './src/screens/LoginScreen';
import { MainTabs }              from './src/navigation/MainTabs';
import { SettingsScreen }        from './src/screens/SettingsScreen';
import { AppearanceScreen }      from './src/screens/AppearanceScreen';
import { ChangePasswordScreen }  from './src/screens/ChangePasswordScreen';
import { DayDetailScreen }       from './src/screens/DayDetailScreen';
import { AddExerciseScreen }     from './src/screens/AddExerciseScreen';
import { AddCardioScreen }       from './src/screens/AddCardioScreen';
import { AiWorkoutScreen }       from './src/screens/AiWorkoutScreen';
import { PresetsScreen }         from './src/screens/PresetsScreen';
import { EditPresetScreen }      from './src/screens/EditPresetScreen';
import { PostDetailScreen }      from './src/screens/PostDetailScreen';
import { UsernameSetupScreen }   from './src/screens/UsernameSetupScreen';
import { ChangeUsernameScreen }  from './src/screens/ChangeUsernameScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { colors, effectiveMode } = useTheme();
  const [session, setSession]           = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  // undefined = not yet fetched for the current session; null = fetch failed.
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  // If loading fails we proceed with system fonts rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Load the caller's profile (for the username gate) whenever a session
  // appears, and drop it on sign-out so a different user's stale profile
  // never briefly renders after switching accounts.
  useEffect(() => {
    if (!session) {
      setProfile(undefined);
      return;
    }
    profileApi.getMine()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (initializing || !fontsReady || (session && profile === undefined)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={effectiveMode === 'dark' ? 'light' : 'dark'} backgroundColor={colors.bg} />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.bgAlt,
            },
            headerTintColor: colors.text,
            headerTitleStyle: {
              fontFamily: FONT.semibold,
              fontSize:   17,
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: colors.bg,
            },
            animation: 'slide_from_right',
            // Otherwise the back button shows the previous screen's title —
            // "MainTabs" for every screen pushed straight from a tab, since
            // that Stack.Screen has no title of its own. iOS only hides an
            // overlong label automatically, so short titles (e.g. "Friday")
            // were leaking it while longer ones (e.g. "Thursday") happened
            // to collapse to just the chevron.
            headerBackTitleVisible: false,
          }}
        >
          {session && profile && !profile.username ? (
            <Stack.Screen
              name="UsernameSetup"
              options={{ headerShown: false }}
            >
              {() => (
                <UsernameSetupScreen
                  onComplete={username => setProfile(p => (p ? { ...p, username } : p))}
                />
              )}
            </Stack.Screen>
          ) : session ? (
            <>
              <Stack.Screen
                name="MainTabs"
                component={MainTabs}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
              />
              <Stack.Screen
                name="Appearance"
                component={AppearanceScreen}
                options={{ title: 'Appearance' }}
              />
              <Stack.Screen
                name="ChangePassword"
                component={ChangePasswordScreen}
                options={{ title: 'Change Password' }}
              />
              <Stack.Screen
                name="ChangeUsername"
                component={ChangeUsernameScreen}
                options={{ title: 'Change Username' }}
              />
              <Stack.Screen
                name="DayDetail"
                component={DayDetailScreen}
              />
              <Stack.Screen
                name="AddExercise"
                component={AddExerciseScreen}
              />
              <Stack.Screen
                name="AddCardio"
                component={AddCardioScreen}
              />
              <Stack.Screen
                name="AiWorkout"
                component={AiWorkoutScreen}
              />
              <Stack.Screen
                name="Presets"
                component={PresetsScreen}
                options={{ title: 'Presets' }}
              />
              <Stack.Screen
                name="EditPreset"
                component={EditPresetScreen}
              />
              <Stack.Screen
                name="PostDetail"
                component={PostDetailScreen}
                options={{ title: 'Post' }}
              />
            </>
          ) : (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
