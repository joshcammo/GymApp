import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
// QueryParams reaches into expo-auth-session's compiled output rather than a
// published public export — this is the exact helper Supabase's own Expo
// deep-linking guide uses, since it correctly parses both '?query' (PKCE)
// and '#fragment' (implicit) style auth redirects.
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

import { COLORS } from './src/constants/colors';
import { FONT } from './src/constants/theme';
import { RootStackParamList } from './src/types';
import { supabase } from './src/lib/supabase';
import { LoginScreen }          from './src/screens/LoginScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen }  from './src/screens/ResetPasswordScreen';
import { HomeScreen }           from './src/screens/HomeScreen';
import { DayDetailScreen }      from './src/screens/DayDetailScreen';
import { AddExerciseScreen }    from './src/screens/AddExerciseScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Pulls the access/refresh tokens out of a Supabase password-recovery
 * redirect. Returns null for any other link (or a malformed one).
 */
function parseRecoveryTokens(url: string): { access_token: string; refresh_token: string } | null {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode || params.type !== 'recovery') return null;

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  return { access_token, refresh_token };
}

export default function App() {
  const [session, setSession]           = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const url = Linking.useURL();

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

  // A recovery link both signs the user in (so ResetPasswordScreen can call
  // updateUser) and must route them there instead of straight into the app.
  // passwordRecovery is set BEFORE setSession runs, not after — setSession
  // triggers the onAuthStateChange listener above, and if that fired first
  // the navigator would briefly render the authenticated Home stack (with a
  // real data fetch) before flipping over to ResetPassword.
  useEffect(() => {
    if (!url) return;
    const tokens = parseRecoveryTokens(url);
    if (!tokens) return;

    setPasswordRecovery(true);
    supabase.auth.setSession(tokens).then(({ error }) => {
      if (error) setPasswordRecovery(false); // invalid/expired link
    });
  }, [url]);

  // Also used as the "cancel" escape hatch on ResetPasswordScreen (e.g. an
  // expired link) — signOut is awaited before clearing the gate so the
  // navigator doesn't fall through to the still-valid recovery session and
  // briefly show Home before landing on Login.
  const finishPasswordRecovery = useCallback(async () => {
    await supabase.auth.signOut();
    setPasswordRecovery(false);
  }, []);

  const renderResetPasswordScreen = useCallback(
    () => <ResetPasswordScreen onDone={finishPasswordRecovery} />,
    [finishPasswordRecovery]
  );

  if (initializing || !fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.bg} />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: COLORS.bgAlt,
            },
            headerTintColor: COLORS.text,
            headerTitleStyle: {
              fontFamily: FONT.semibold,
              fontSize:   17,
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: COLORS.bg,
            },
            animation: 'slide_from_right',
          }}
        >
          {passwordRecovery ? (
            <Stack.Screen name="ResetPassword" options={{ headerShown: false }}>
              {renderResetPasswordScreen}
            </Stack.Screen>
          ) : session ? (
            <>
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="DayDetail"
                component={DayDetailScreen}
              />
              <Stack.Screen
                name="AddExercise"
                component={AddExerciseScreen}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: 'Reset Password' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
