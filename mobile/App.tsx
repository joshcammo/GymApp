import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';

import { COLORS } from './src/constants/colors';
import { RootStackParamList } from './src/types';
import { supabase } from './src/lib/supabase';
import { LoginScreen }       from './src/screens/LoginScreen';
import { HomeScreen }        from './src/screens/HomeScreen';
import { DayDetailScreen }   from './src/screens/DayDetailScreen';
import { AddExerciseScreen } from './src/screens/AddExerciseScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession]         = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

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

  if (initializing) {
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
            headerTintColor:       COLORS.text,
            headerTitleStyle: {
              fontWeight: '700',
              fontSize:    17,
            },
            headerShadowVisible:   false,
            contentStyle: {
              backgroundColor: COLORS.bg,
            },
            animation: 'slide_from_right',
          }}
        >
          {session ? (
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
