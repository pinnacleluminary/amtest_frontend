// app/components/CustomButton.tsx
import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONTS, SIZES, SHADOWS } from '../constants/theme';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export default function CustomButton({ 
  title, 
  onPress, 
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: CustomButtonProps) {
  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        styles[variant], 
        styles[size],
        disabled && styles.disabled,
        style
      ]} 
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'outline' ? COLORS.primary : COLORS.white} 
          size="small" 
        />
      ) : (
        <>
          {icon}
          <Text 
            style={[
              styles.buttonText, 
              styles[`${variant}Text`],
              styles[`${size}Text`],
              textStyle
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: SIZES.base,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...SHADOWS.small,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
  },
  danger: {
    backgroundColor: COLORS.error,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  disabled: {
    opacity: 0.6,
  },
  small: {
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.medium,
  },
  medium: {
    paddingVertical: SIZES.medium,
    paddingHorizontal: SIZES.large,
  },
  large: {
    paddingVertical: SIZES.large,
    paddingHorizontal: SIZES.extraLarge,
  },
  buttonText: {
    fontFamily: FONTS.medium,
    fontSize: SIZES.font,
  },
  primaryText: {
    color: COLORS.white,
  },
  secondaryText: {
    color: COLORS.white,
  },
  dangerText: {
    color: COLORS.white,
  },
  outlineText: {
    color: COLORS.primary,
  },
  smallText: {
    fontSize: SIZES.small,
  },
  mediumText: {
    fontSize: SIZES.font,
  },
  largeText: {
    fontSize: SIZES.medium,
  },
});
