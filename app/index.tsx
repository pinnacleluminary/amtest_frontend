// app/index.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ActivityIndicator, 
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  RefreshControl,
  Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import { API_ENDPOINTS } from './config/api';
import { COLORS, FONTS, SIZES, SHADOWS } from './constants/theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import LoadingSpinner from './components/LoadingSpinner';
import CustomButton from './components/CustomButton';
import { StatusBar } from 'expo-status-bar';
import { useAlert } from './context/AlertContext';
import * as MediaLibrary from 'expo-media-library';

// Define types
interface User {
  id: string;
  email: string;
  name?: string;
}

interface ApiResponse {
  token?: string;
  user?: User;
  pdfBase64?: string;
  reportData?: {
    reportHTML?: string;
    [key: string]: any;
  };
  msg?: any;
  error?: string;
}

// Auth utility functions
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const getUser = async (): Promise<User | null> => {
  try {
    const userData = await AsyncStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

export const saveToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving token:', error);
    throw error;
  }
};

export const saveUser = async (user: User): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving user:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

export default function App(): JSX.Element {
  const router = useRouter();
  const { confirm, success, error: showError, showPdfOptions } = useAlert();
  const [loading, setLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [sheetName, setSheetName] = useState<string>('');
  const [processingExcel, setProcessingExcel] = useState<boolean>(false);
  const [reportHtml, setReportHtml] = useState<string>('');
  const [pdfUri, setPdfUri] = useState<string>('');
  const [excelFilename, setExcelFilename] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    checkAuthStatus();
    animateContent();
  }, []);

  const animateContent = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const checkAuthStatus = async (): Promise<void> => {
    try {
      const token = await getToken();
      const userData = await getUser();
      
      if (!token) {
        router.replace('/auth/login');
        return;
      }
      
      setUser(userData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking auth status:', error);
      router.replace('/auth/login');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkAuthStatus();
    setRefreshing(false);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      confirm({
        title: "Logout",
        message: "Are you sure you want to logout?",
        type: "warning",
        confirmText: "Logout",
        cancelText: "Cancel",
        onConfirm: async () => {
          try {
            await logout();
            router.replace('/auth/login');
          } catch (error) {
            console.error('Error during logout:', error);
            showError({
              title: 'Error',
              message: 'Failed to logout. Please try again.'
            });
          }
        }
      });
    } catch (error) {
      console.error('Error showing logout confirmation:', error);
      showError({
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.'
      });
    }
  };

  const viewPdf = (uri: string): void => {
    // This would open the PDF in a PDF viewer
    // For now, we'll just share it which will open in the default PDF viewer
    sharePdf(uri);
  };

  const sharePdf = async (uri: string): Promise<void> => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Material Test Report'
      });
    } else {
      showError({
        title: 'Sharing not available',
        message: 'Sharing is not available on this device'
      });
    }
  };

  const selectExcel = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Select document
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        setLoading(false);
        return;
      }
  
      // Read the file
      const { uri, name } = result.assets[0];
      setExcelFilename(name || `excel_${Date.now()}.xlsx`);
      
      const fileContent = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Parse Excel file
      const workbook = XLSX.read(fileContent, { type: 'base64' });
      
      // Check if there are any worksheets
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        showError({
          title: 'Error',
          message: 'No worksheets found in the Excel file.'
        });
        setLoading(false);
        return;
      }
      
      // Use the first worksheet if 'WorkSheets' doesn't exist
      const selectedSheetName = workbook.SheetNames.includes('WorkSheets') 
        ? 'WorkSheets' 
        : workbook.SheetNames[0];
      
      console.log(`Using sheet: ${selectedSheetName}`);
      setSheetName(selectedSheetName);
      
      // Get the worksheet and convert to HTML for display
      const worksheet = workbook.Sheets[selectedSheetName];
      
      if (!worksheet || !worksheet['!ref']) {
        showError({
          title: 'Error',
          message: `The worksheet "${selectedSheetName}" is empty or invalid.`
        });
        setLoading(false);
        return;
      }
      
      // Convert to HTML for display
      const html = XLSX.utils.sheet_to_html(worksheet);
      const styledHtml = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 10px;
                background-color: ${COLORS.background};
              }
              table {
                border-collapse: collapse;
                width: 100%;
                margin-top: 10px;
                background-color: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              th, td {
                border: 1px solid #ddd;
                padding: 12px 8px;
                text-align: left;
              }
              th {
                background-color: ${COLORS.primary};
                color: white;
                position: sticky;
                top: 0;
              }
              tr:nth-child(even) {
                background-color: #f9f9f9;
              }
              tr:hover {
                background-color: #f1f1f1;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;
      
      setHtmlContent(styledHtml);
      
      // Send Excel data to backend for processing
      try {
        setProcessingExcel(true);
        
        // Send both the Excel file and the styled HTML to the backend
        await sendExcelAndHtmlToBackend(fileContent, styledHtml, name || `excel_${Date.now()}.xlsx`, selectedSheetName);
        
        console.log('Excel file and HTML sent to backend for processing');
      } catch (sendError) {
        console.error('Error sending data to backend:', sendError);
        showError({
          title: 'Error',
          message: `Failed to send data to backend: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`
        });
      } finally {
        setProcessingExcel(false);
      }
      
      setLoading(false);
      
    } catch (error) {
      console.error('Error:', error);
      showError({
        title: 'Error',
        message: `Failed to process the Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setLoading(false);
    }
  };

  const sendExcelAndHtmlToBackend = async (
    base64Excel: string, 
    htmlContent: string, 
    filename: string, 
    sheetName: string
  ): Promise<ApiResponse | undefined> => {
    try {
      const token = await getToken();
      
      if (!API_ENDPOINTS.imageparser) {
        throw new Error('Image parser endpoint is not defined in API_ENDPOINTS');
      }
      
      // Send both the Excel file and the styled HTML to the backend
      const response = await axios.post<ApiResponse>(
        API_ENDPOINTS.imageparser, 
        {
          excelFile: base64Excel,
          htmlContent: htmlContent,
          filename: filename,
          sheetName: sheetName
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : undefined
          }
        }
      );
      
      console.log('Backend processing response received');
      
      // If the server returns the PDF and report data
      if (response.data && response.data.pdfBase64) {
        const pdfBase64 = response.data.pdfBase64;
        const pdfFilename = `test_report_${Date.now()}.pdf`;
        
        // Save to app's cache directory (temporary)
        const tempFileUri = `${FileSystem.cacheDirectory}${pdfFilename}`;
        await FileSystem.writeAsStringAsync(tempFileUri, pdfBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Request storage permissions
        const { status } = await MediaLibrary.requestPermissionsAsync();
        
        if (status !== 'granted') {
          showError({
            title: 'Permission Denied',
            message: 'Storage permission is required to save the PDF file.'
          });
          return response.data;
        }
        
        try {
          if (Platform.OS === 'android') {
            // For Android: Use the Sharing API to save the file to external storage
            // This will trigger the system file picker, allowing the user to select where to save
            
            // First, create an asset in the media library
            const asset = await MediaLibrary.createAssetAsync(tempFileUri);
            if (!asset) {
              throw new Error('Failed to create asset');
            }
            
            // Get the actual file URI
            const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
            const fileUri = assetInfo.localUri || assetInfo.uri;
            
            if (!fileUri) {
              throw new Error('Could not get file URI');
            }
            
            // Use the Sharing API to let the user save the file
            const UTI = 'application/pdf';
            const shareResult = await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Save PDF to amtest folder',
              UTI
            });
            
            console.log('Share result:', shareResult);
            
            // Set the PDF URI for later use
            setPdfUri(fileUri);
            
            // If there's HTML report content, set it for display
            if (response.data.reportData && response.data.reportData.reportHTML) {
              setReportHtml(response.data.reportData.reportHTML);
            }
            
            // Show success message with instructions
            success({
              title: 'Report Generated',
              message: 'Your test report has been generated. Please save it to the amtest folder at the root of your storage.',
              buttonText: 'View Options',
              onPress: () => {
                showPdfOptions(fileUri, viewPdf, sharePdf);
              }
            });
            
            // Clean up temporary file
            await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
            
            return response.data;
          } else {
            // iOS implementation (unchanged)
            const asset = await MediaLibrary.createAssetAsync(tempFileUri);
            
            if (!asset) {
              throw new Error('Failed to create asset from PDF file');
            }
            
            // Get asset info
            const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
            const fileUri = assetInfo.localUri || assetInfo.uri;
            
            // Try to create an album for organization
            try {
              let album = await MediaLibrary.getAlbumAsync('amtest');
              
              if (!album) {
                album = await MediaLibrary.createAlbumAsync('amtest', asset, false);
              } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
              }
            } catch (albumError) {
              console.warn('Could not create or add to album:', albumError);
            }
            
            setPdfUri(fileUri);
            
            // Clean up temp file
            await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
            
            // If there's HTML report content, set it for display
            if (response.data.reportData && response.data.reportData.reportHTML) {
              setReportHtml(response.data.reportData.reportHTML);
            }
            
            success({
              title: 'Report Generated',
              message: 'Your test report has been generated and saved to your device.',
              buttonText: 'View Options',
              onPress: () => {
                showPdfOptions(fileUri, viewPdf, sharePdf);
              }
            });
          }
        } catch (error) {
          console.error('Error saving to external storage:', error);
          
          // Fallback to internal app storage
          const internalFileUri = `${FileSystem.documentDirectory}${pdfFilename}`;
          
          try {
            // Copy from temp to documents directory
            await FileSystem.moveAsync({
              from: tempFileUri,
              to: internalFileUri
            });
            
            setPdfUri(internalFileUri);
            
            // If there's HTML report content, set it for display
            if (response.data.reportData && response.data.reportData.reportHTML) {
              setReportHtml(response.data.reportData.reportHTML);
            }
            
            success({
              title: 'Report Generated',
              message: 'Your test report has been generated but could only be saved to app storage.',
              buttonText: 'View Options',
              onPress: () => {
                showPdfOptions(internalFileUri, viewPdf, sharePdf);
              }
            });
          } catch (fallbackError) {
            console.error('Even fallback storage failed:', fallbackError);
            showError({
              title: 'Storage Error',
              message: 'Failed to save the PDF file to any location.'
            });
          }
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Error processing data on server:', error);
      throw error;
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading app..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.headerLogo} 
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Material Test Report</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Animated.View 
          style={[
            styles.welcomeContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <Text style={styles.welcomeText}>
            Welcome, {user?.name || 'User'}
          </Text>
          <Text style={styles.welcomeSubtext}>
            Generate material test reports from your Excel data
          </Text>
        </Animated.View>
        
        <Animatable.View 
          animation="fadeInUp" 
          duration={800} 
          delay={300}
          style={styles.actionCard}
        >
          <View style={styles.actionCardHeader}>
            <MaterialCommunityIcons name="file-excel" size={24} color={COLORS.primary} />
            <Text style={styles.actionCardTitle}>Excel Processing</Text>
          </View>
          
          <Text style={styles.actionCardDescription}>
            Upload an Excel file to generate a material test report. The system will analyze the data and create a professional PDF report.
          </Text>
          
          <CustomButton
            title="Select Excel File"
            onPress={selectExcel}
            disabled={loading || processingExcel}
            loading={loading}
            variant="primary"
            icon={<Ionicons name="document-attach-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />}
            style={styles.actionButton}
          />
          
          {excelFilename ? (
            <View style={styles.fileInfoContainer}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.text} />
              <Text style={styles.filenameText}>{excelFilename}</Text>
            </View>
          ) : null}
        </Animatable.View>
        
        {processingExcel && (
          <Animatable.View 
            animation="fadeIn" 
            duration={500}
            style={styles.processingCard}
          >
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.processingText}>Generating test report...</Text>
            <Text style={styles.processingSubtext}>This may take a moment</Text>
          </Animatable.View>
        )}
        
        {pdfUri && (
          <Animatable.View 
            animation="fadeInUp" 
            duration={800}
            style={styles.resultCard}
          >
            <View style={styles.resultCardHeader}>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color={COLORS.success} />
              <Text style={styles.resultCardTitle}>Report Ready</Text>
            </View>
            
            <Text style={styles.resultCardDescription}>
              Your material test report has been generated successfully. You can view or share the PDF.
            </Text>
            
            <View style={styles.pdfButtonsContainer}>
              <CustomButton
                title="View PDF"
                onPress={() => viewPdf(pdfUri)}
                variant="primary"
                icon={<Ionicons name="eye-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />}
                style={styles.pdfButton}
              />
              <CustomButton
                title="Share PDF"
                onPress={() => sharePdf(pdfUri)}
                variant="outline"
                icon={<Ionicons name="share-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />}
                style={styles.pdfButton}
                textStyle={{ color: COLORS.primary }}
              />
            </View>
          </Animatable.View>
        )}
        
        {htmlContent ? (
          <Animatable.View 
            animation="fadeInUp" 
            duration={800}
            delay={200}
            style={styles.webViewCard}
          >
            <View style={styles.webViewCardHeader}>
              <MaterialCommunityIcons name="table" size={24} color={COLORS.primary} />
              <Text style={styles.webViewCardTitle}>Excel Data Preview</Text>
              <Text style={styles.sheetNameText}>{sheetName}</Text>
            </View>
            
            <View style={styles.webViewWrapper}>
              <WebView
                originWhitelist={['*']}
                source={{ html: htmlContent }}
                style={styles.webView}
                javaScriptEnabled={true}
                onLoadEnd={() => console.log('Excel WebView loaded')}
              />
            </View>
          </Animatable.View>
        ) : null}
        
        {reportHtml ? (
          <Animatable.View 
            animation="fadeInUp" 
            duration={800}
            delay={400}
            style={styles.webViewCard}
          >
            <View style={styles.webViewCardHeader}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color={COLORS.primary} />
              <Text style={styles.webViewCardTitle}>Test Report Preview</Text>
            </View>
            
            <View style={styles.webViewWrapper}>
              <WebView
                originWhitelist={['*']}
                source={{ html: reportHtml }}
                style={styles.webView}
                javaScriptEnabled={true}
                onLoadEnd={() => console.log('Report WebView loaded')}
              />
            </View>
          </Animatable.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.primary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: SIZES.large,
    fontFamily: FONTS.semiBold,
    color: COLORS.white,
  },
  logoutButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  welcomeContainer: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: SIZES.extraLarge,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 8,
  },
  welcomeSubtext: {
    fontSize: SIZES.medium,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  actionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCardTitle: {
    fontSize: SIZES.large,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginLeft: 10,
  },
  actionCardDescription: {
    fontSize: SIZES.medium,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  actionButton: {
    width: '100%',
  },
  fileInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
  },
  filenameText: {
    fontSize: SIZES.font,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    marginLeft: 8,
  },
  processingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  processingText: {
    fontSize: SIZES.medium,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginTop: 16,
  },
  processingSubtext: {
    fontSize: SIZES.font,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  resultCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultCardTitle: {
    fontSize: SIZES.large,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginLeft: 10,
  },
  resultCardDescription: {
    fontSize: SIZES.medium,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  pdfButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pdfButton: {
    width: '48%',
  },
  webViewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  webViewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  webViewCardTitle: {
    fontSize: SIZES.large,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginLeft: 10,
  },
  sheetNameText: {
    fontSize: SIZES.small,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  webViewWrapper: {
    height: 400,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  webView: {
    flex: 1,
  },
});