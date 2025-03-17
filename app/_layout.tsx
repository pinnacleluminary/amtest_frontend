import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS } from './constants/theme';
import CustomSplashScreen from './components/SplashScreen';
import { AlertProvider } from './context/AlertContext';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  });
  
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Hide the Expo splash screen
      SplashScreen.hideAsync();
      
      // Show our custom splash screen for a bit longer
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 5000); // Show splash for 2 seconds
      
      return () => clearTimeout(timer);
    }
  }, [loaded]);

  if (!loaded || showSplash) {
    return <CustomSplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AlertProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen 
            name="(auth)" 
            options={{
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen 
            name="(tabs)" 
            options={{
              animation: 'fade',
            }}
          />
        </Stack>
      </AlertProvider>
    </GestureHandlerRootView>
  );
}
