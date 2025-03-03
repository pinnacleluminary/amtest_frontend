import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Alert, 
  ActivityIndicator, 
  SafeAreaView,
  TouchableOpacity
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from './config/api';
import ViewShot from 'react-native-view-shot';

// Auth utility functions
const TOKEN_KEY = 'token';

export const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

export default function App() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [sheetName, setSheetName] = useState<string>('');
  const [capturingImage, setCapturingImage] = useState<boolean>(false);
  const webViewRef = useRef<WebView | null>(null);
  // Use the correct type for ViewShot from the library
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async (): Promise<void> => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/auth/login');
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const selectExcel = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Select document
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      
      if (result.canceled) {
        setLoading(false);
        return;
      }

      // Read the file
      const { uri } = result.assets[0];
      const fileContent = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Parse Excel file
      const workbook = XLSX.read(fileContent, { type: 'base64' });
      
      // Check if there are any worksheets
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        Alert.alert('Error', 'No worksheets found in the Excel file.');
        setLoading(false);
        return;
      }
      
      // Use the first worksheet if 'WorkSheets' doesn't exist
      const selectedSheetName = workbook.SheetNames.includes('WorkSheets') 
        ? 'WorkSheets' 
        : workbook.SheetNames[0];
      
      console.log(`Using sheet: ${selectedSheetName}`);
      setSheetName(selectedSheetName);
      
      // Get the worksheet
      const worksheet = workbook.Sheets[selectedSheetName];
      
      // Check if worksheet is valid and has a reference range
      if (!worksheet || !worksheet['!ref']) {
        Alert.alert('Error', `The worksheet "${selectedSheetName}" is empty or invalid.`);
        setLoading(false);
        return;
      }
      
      let html;
      try {
        html = XLSX.utils.sheet_to_html(worksheet);
      } catch (sheetError) {
        console.error('Error converting sheet to HTML:', sheetError);
        Alert.alert('Error', 'Failed to convert worksheet to HTML format.');
        setLoading(false);
        return;
      }
      
      // Add some styling to make it look better
      const styledHtml = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 10px;
              }
              table {
                border-collapse: collapse;
                width: 100%;
                margin-top: 10px;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
              }
              th {
                background-color: #f2f2f2;
                position: sticky;
                top: 0;
              }
              tr:nth-child(even) {
                background-color: #f9f9f9;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;
      
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer xai-NdtET7QFy1ryaevqBV2OkRqMlSetc0NnopM3KVnaPpJ3mZZLc3NnfYC1sP2N65Ia4kE6C6KZVacEVhjv`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are Grok, a chatbot inspired by the Hitchhikers Guide to the Galaxy.",
            },
            {
              role: "user",
              content: styledHtml + '\n What is this content?',
            },
          ],
          model: "grok-beta",
          stream: false,
          temperature: 0,
        }),
      });

      const data = await response.json();

      console.log(data); 
      setHtmlContent(styledHtml);
      setLoading(false);
      
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', `Failed to process the Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const captureAndSendWebView = async (): Promise<void> => {
    try {
      if (!htmlContent) {
        Alert.alert('Error', 'No content to capture');
        return;
      }

      setCapturingImage(true);

      // Wait for WebView to fully render
      setTimeout(async () => {
        try {
          // Use non-null assertion operator to tell TypeScript that we'll handle the null check
          const viewShot = viewShotRef.current;
          
          if (!viewShot) {
            throw new Error('ViewShot reference is not available');
          }
          
          // Use type assertion to tell TypeScript that capture method exists
          const uri = await (viewShot as any).capture();
          
          console.log('Image captured:', uri);
          
          // Convert to base64
          const base64Image = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Send to backend
          await sendImageToBackend(base64Image);
          
          Alert.alert('Success', 'Excel content captured and sent to server');
        } catch (error) {
          console.error('Capture error:', error);
          Alert.alert('Error', `Failed to capture WebView content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setCapturingImage(false);
        }
      }, 1000); // Give WebView time to render completely
    } catch (error) {
      console.error('Error in capture process:', error);
      setCapturingImage(false);
      Alert.alert('Error', 'Failed to process capture');
    }
  };

  const sendImageToBackend = async (base64Image: string): Promise<any> => {
    try {
      const token = await getToken();
      
      if (!API_ENDPOINTS.imageparser) {
        throw new Error('Image parser endpoint is not defined in API_ENDPOINTS');
      }
      
      const response = await axios.post(
        API_ENDPOINTS.imageparser, 
        {
          image: base64Image,
          filename: `excel_${Date.now()}.png`,
          sheetName: sheetName
        }
      );
      
      console.log('Image upload response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending image to backend:', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Excel Worksheet Viewer</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.button}
          onPress={selectExcel}
          disabled={loading || capturingImage}
        >
          <Text style={styles.buttonText}>Select Excel File</Text>
        </TouchableOpacity>
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Processing Excel file...</Text>
          </View>
        )}
        
        {capturingImage && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Capturing and sending image...</Text>
          </View>
        )}
        
        {htmlContent ? (
          <>
            <View style={styles.webViewContainer}>
              <Text style={styles.subtitle}>Worksheet: {sheetName}</Text>
              <ViewShot 
                ref={viewShotRef}
                options={{ format: 'png', quality: 0.9 }}
                style={styles.viewShot}
              >
                <WebView
                  ref={webViewRef}
                  originWhitelist={['*']}
                  source={{ html: htmlContent }}
                  style={styles.webView}
                  javaScriptEnabled={true}
                  onLoadEnd={() => console.log('WebView loaded')}
                />
              </ViewShot>
            </View>
            
            <TouchableOpacity
              style={[styles.button, { marginTop: 20, backgroundColor: '#4CAF50' }]}
              onPress={captureAndSendWebView}
              disabled={loading || capturingImage}
            >
              <Text style={styles.buttonText}>Capture and Send to Server</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f8f8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  webViewContainer: {
    marginTop: 20,
    width: '100%',
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  viewShot: {
    flex: 1,
    width: '100%',
  },
  webView: {
    flex: 1,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});
