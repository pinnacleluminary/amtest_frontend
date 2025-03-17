// app/components/LoadingSpinner.tsx
import React from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  message = 'Loading...', 
  fullScreen = true 
}: LoadingSpinnerProps) {
  return (
    <View style={[styles.container, fullScreen ? styles.fullScreen : null]}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  message: {
    marginTop: 10,
    color: COLORS.text,
    fontFamily: FONTS.medium,
  },
});
