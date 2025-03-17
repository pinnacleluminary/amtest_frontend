// app/components/SplashScreen.tsx
import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Animated, Easing, StatusBar, Dimensions } from 'react-native';
import { COLORS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const scaleAnim = new Animated.Value(0.3);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    // Hide the status bar during splash screen
    StatusBar.setHidden(true);

    Animated.sequence([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.elastic(1.2),
        useNativeDriver: true,
      }),
    ]).start();

    // Clean up - show status bar when component unmounts
    return () => {
      StatusBar.setHidden(false);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/splash-bg.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    zIndex: 2,
  },
  logo: {
    width: 150,
    height: 150,
  },
});
