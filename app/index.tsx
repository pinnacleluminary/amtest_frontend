import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Alert, 
  ActivityIndicator, 
  SafeAreaView,
  TouchableOpacity,
  ScrollView
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

// Define types
interface User {
  id: string;
  email: string;
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

export const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting token:', error);
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

export const logout = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

export default function App(): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [sheetName, setSheetName] = useState<string>('');
  const [processingExcel, setProcessingExcel] = useState<boolean>(false);
  const [reportHtml, setReportHtml] = useState<string>('');
  const [pdfUri, setPdfUri] = useState<string>('');
  const [excelFilename, setExcelFilename] = useState<string>('');

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
      const { uri, name } = result.assets[0];
      setExcelFilename(name || `excel_${Date.now()}.xlsx`);
      
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
      
      // Get the worksheet and convert to HTML for display
      const worksheet = workbook.Sheets[selectedSheetName];
      
      if (!worksheet || !worksheet['!ref']) {
        Alert.alert('Error', `The worksheet "${selectedSheetName}" is empty or invalid.`);
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
      
      setHtmlContent(styledHtml);
      
      // Send Excel data to backend for processing
      try {
        setProcessingExcel(true);
        
        // Send both the Excel file and the styled HTML to the backend
        await sendExcelAndHtmlToBackend(fileContent, styledHtml, name || `excel_${Date.now()}.xlsx`, selectedSheetName);
        
        console.log('Excel file and HTML sent to backend for processing');
      } catch (sendError) {
        console.error('Error sending data to backend:', sendError);
        Alert.alert('Error', `Failed to send data to backend: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`);
      } finally {
        setProcessingExcel(false);
      }
      
      setLoading(false);
      
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', `Failed to process the Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        const fileUri = `${FileSystem.documentDirectory}${pdfFilename}`;
        
        await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        setPdfUri(fileUri);
        console.log('PDF saved to:', fileUri);
        
        // If there's HTML report content, set it for display
        if (response.data.reportData && response.data.reportData.reportHTML) {
          setReportHtml(response.data.reportData.reportHTML);
        }
        
        Alert.alert(
          'Report Generated', 
          'Your test report has been generated. Would you like to view or share it?',
          [
            {
              text: 'View',
              onPress: () => viewPdf(fileUri)
            },
            {
              text: 'Share',
              onPress: () => sharePdf(fileUri)
            },
            {
              text: 'Close',
              style: 'cancel'
            }
          ]
        );
      }
      
      return response.data;
    } catch (error) {
      console.error('Error processing data on server:', error);
      throw error;
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
      Alert.alert('Sharing not available', 'Sharing is not available on this device');
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
        <Text style={styles.headerTitle}>Material Test Report Generator</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.button}
            onPress={selectExcel}
            disabled={loading || processingExcel}
          >
            <Text style={styles.buttonText}>Select Excel File</Text>
          </TouchableOpacity>
          
          {excelFilename ? (
            <Text style={styles.filenameText}>Selected file: {excelFilename}</Text>
          ) : null}
          
          {(loading || processingExcel) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text>{processingExcel ? 'Generating test report...' : 'Processing Excel file...'}</Text>
            </View>
          )}
          
          {pdfUri && (
            <View style={styles.pdfButtonsContainer}>
              <TouchableOpacity
                style={[styles.button, styles.pdfButton]}
                onPress={() => viewPdf(pdfUri)}
              >
                <Text style={styles.buttonText}>View PDF Report</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.pdfButton]}
                onPress={() => sharePdf(pdfUri)}
              >
                <Text style={styles.buttonText}>Share PDF Report</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {htmlContent ? (
            <View style={styles.webViewContainer}>
              <Text style={styles.subtitle}>Excel Data Preview: {sheetName}</Text>
              <View style={styles.webViewWrapper}>
                <WebView
                  originWhitelist={['*']}
                  source={{ html: htmlContent }}
                  style={styles.webView}
                  javaScriptEnabled={true}
                  onLoadEnd={() => console.log('Excel WebView loaded')}
                />
              </View>
            </View>
          ) : null}
          
          {reportHtml ? (
            <View style={styles.webViewContainer}>
              <Text style={styles.subtitle}>Test Report</Text>
              <View style={styles.webViewWrapper}>
                <WebView
                  originWhitelist={['*']}
                  source={{ html: reportHtml }}
                  style={styles.webView}
                  javaScriptEnabled={true}
                  onLoadEnd={() => console.log('Report WebView loaded')}
                />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flex: 1,
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
  filenameText: {
    marginTop: 10,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  webViewContainer: {
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  webViewWrapper: {
    height: 400, // Fixed height for WebView
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
    marginVertical: 10,
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
  },
  pdfButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 10,
  },
  pdfButton: {
    width: '45%',
  },
  reportContainer: {
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
});
