import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  Animated, 
  Dimensions, 
  TouchableWithoutFeedback 
} from 'react-native';
import { COLORS, FONTS, SIZES, SHADOWS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface ButtonProps {
  text: string;
  onPress: () => void;
  type?: 'default' | 'cancel' | 'destructive' | 'primary';
  icon?: string;
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: ButtonProps[];
  onClose: () => void;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export default function CustomAlert({
  visible,
  title,
  message,
  buttons,
  onClose,
  type = 'info'
}: CustomAlertProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getIconByType = () => {
    switch (type) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={40} color={COLORS.success} />;
      case 'error':
        return <Ionicons name="close-circle" size={40} color={COLORS.error} />;
      case 'warning':
        return <Ionicons name="warning" size={40} color={COLORS.warning} />;
      case 'info':
      default:
        return <Ionicons name="information-circle" size={40} color={COLORS.primary} />;
    }
  };

  const renderButton = (button: ButtonProps, index: number) => {
    const getButtonStyle = () => {
      switch (button.type) {
        case 'primary':
          return styles.primaryButton;
        case 'destructive':
          return styles.destructiveButton;
        case 'cancel':
          return styles.cancelButton;
        case 'default':
        default:
          return styles.defaultButton;
      }
    };

    const getTextStyle = () => {
      switch (button.type) {
        case 'primary':
          return styles.primaryButtonText;
        case 'destructive':
          return styles.destructiveButtonText;
        case 'cancel':
          return styles.cancelButtonText;
        case 'default':
        default:
          return styles.defaultButtonText;
      }
    };

    // Determine button width based on number of buttons and position
    let buttonWidth = {};
    
    if (buttons.length === 1) {
      // Single button should be centered with reasonable width
      buttonWidth = { width: '100%', maxWidth: 200 };
    } else if (buttons.length === 2) {
      // Two buttons side by side
      buttonWidth = { width: '48%' };
    } else if (buttons.length >= 3) {
      // For 3 or more buttons
      if (index === buttons.length - 1 && buttons.length % 2 === 1) {
        // Last button in odd-numbered set should be full width
        buttonWidth = { width: '100%' };
      } else {
        // Other buttons are half width
        buttonWidth = { width: '48%' };
      }
    }

    return (
      <TouchableOpacity
        key={index}
        style={[styles.button, getButtonStyle(), buttonWidth]}
        onPress={() => {
          // Always close the alert first, then perform the action
          onClose();
          // Small delay to ensure the alert is closed before the action
          setTimeout(() => {
            button.onPress();
          }, 50);
        }}
      >
        {button.icon && (
          <Ionicons 
            name={button.icon as any} 
            size={18} 
            color={button.type === 'primary' ? COLORS.white : 
                  button.type === 'destructive' ? COLORS.white : 
                  COLORS.primary} 
            style={styles.buttonIcon} 
          />
        )}
        <Text style={[styles.buttonText, getTextStyle()]}>{button.text}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.alertContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View style={styles.iconContainer}>
                {getIconByType()}
              </View>
              
              <Text style={styles.title}>{title}</Text>
              
              {message && <Text style={styles.message}>{message}</Text>}
              
              <View style={[
                styles.buttonContainer, 
                buttons.length === 1 && styles.singleButtonContainer
              ]}>
                {buttons.map(renderButton)}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: width * 0.85,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: SIZES.large,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: SIZES.medium,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  singleButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  destructiveButton: {
    backgroundColor: COLORS.error,
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray,
  },
  defaultButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  buttonText: {
    fontFamily: FONTS.medium,
    fontSize: SIZES.font,
  },
  primaryButtonText: {
    color: COLORS.white,
  },
  destructiveButtonText: {
    color: COLORS.white,
  },
  cancelButtonText: {
    color: COLORS.text,
  },
  defaultButtonText: {
    color: COLORS.primary,
  },
  buttonIcon: {
    marginRight: 8,
  },
});
