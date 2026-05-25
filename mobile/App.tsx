import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { COLORS } from './src/constants/colors';
import { RootStackParamList } from './src/types';
import { HomeScreen }        from './src/screens/HomeScreen';
import { DayDetailScreen }   from './src/screens/DayDetailScreen';
import { AddExerciseScreen } from './src/screens/AddExerciseScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
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
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
