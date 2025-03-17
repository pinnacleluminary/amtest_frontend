// app/context/AlertContext.tsx
import React, { createContext, useState, useContext, ReactNode } from 'react';
import CustomAlert from '../components/CustomAlert';

interface AlertButton {
  text: string;
  onPress: () => void;
  type?: 'default' | 'cancel' | 'destructive' | 'primary';
  icon?: string;
}

interface AlertContextType {
  showAlert: (options: {
    title: string;
    message?: string;
    buttons: AlertButton[];
    type?: 'success' | 'error' | 'warning' | 'info';
  }) => void;
  hideAlert: () => void;
  confirm: (options: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    type?: 'warning' | 'info';
  }) => void;
  success: (options: {
    title: string;
    message?: string;
    buttonText?: string;
    onPress?: () => void;
  }) => void;
  error: (options: {
    title: string;
    message?: string;
    buttonText?: string;
    onPress?: () => void;
  }) => void;
  showPdfOptions: (fileUri: string, viewPdf: (uri: string) => void, sharePdf: (uri: string) => void) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    buttons: [] as AlertButton[],
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  const showAlert = ({
    title,
    message = '',
    buttons,
    type = 'info',
  }: {
    title: string;
    message?: string;
    buttons: AlertButton[];
    type?: 'success' | 'error' | 'warning' | 'info';
  }) => {
    setAlertConfig({
      title,
      message,
      buttons,
      type,
    });
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
  };

  const confirm = ({
    title,
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel = () => {},
    type = 'warning',
  }: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    type?: 'warning' | 'info';
  }) => {
    showAlert({
      title,
      message,
      type,
      buttons: [
        {
          text: cancelText,
          type: 'cancel',
          onPress: onCancel,
        },
        {
          text: confirmText,
          type: 'primary',
          onPress: onConfirm,
        },
      ],
    });
  };

  const success = ({
    title,
    message = '',
    buttonText = 'OK',
    onPress = () => {},
  }: {
    title: string;
    message?: string;
    buttonText?: string;
    onPress?: () => void;
  }) => {
    showAlert({
      title,
      message,
      type: 'success',
      buttons: [
        {
          text: buttonText,
          type: 'primary',
          onPress,
        },
      ],
    });
  };

  const error = ({
    title,
    message = '',
    buttonText = 'OK',
    onPress = () => {},
  }: {
    title: string;
    message?: string;
    buttonText?: string;
    onPress?: () => void;
  }) => {
    showAlert({
      title,
      message,
      type: 'error',
      buttons: [
        {
          text: buttonText,
          type: 'primary',
          onPress,
        },
      ],
    });
  };

  // Add this method to show PDF options without using hooks inside functions
  const showPdfOptions = (
    fileUri: string, 
    viewPdf: (uri: string) => void, 
    sharePdf: (uri: string) => void
  ) => {
    showAlert({
      title: 'Report Options',
      message: 'What would you like to do with your report?',
      type: 'success',
      buttons: [
        {
          text: 'View',
          type: 'primary',
          icon: 'eye-outline',
          onPress: () => viewPdf(fileUri),
        },
        {
          text: 'Share',
          type: 'default',
          icon: 'share-outline',
          onPress: () => sharePdf(fileUri),
        },
        {
          text: 'Close',
          type: 'cancel',
          onPress: () => {},
        },
      ],
    });
  };

  return (
    <AlertContext.Provider value={{ 
      showAlert, 
      hideAlert, 
      confirm, 
      success, 
      error,
      showPdfOptions 
    }}>
      {children}
      <CustomAlert
        visible={visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
        type={alertConfig.type}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
