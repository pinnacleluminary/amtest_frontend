import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { getToken, logout } from './utils/auth';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import Excel from 'exceljs';
import { Buffer } from 'buffer';
import * as DocumentPicker from 'expo-document-picker';
import LoadingSpinner from './components/LoadingSpinner';
import CustomButton from './components/CustomButton';

const { width } = Dimensions.get('window');

interface DataPoint {
  x: number;
  y: number;
}

interface ConeCondition {
  checker: boolean;
  status: string;
}

interface CBRData {
  strTitle: string;
  strIssueInfo: string;
  strDateTime: string;
  strClient: string;
  strSiteLocation: string;
  strSuplier: string;
  strTechnician: string;
  strMType: string;
  strZeroError: string;
  strCoreHoleDepth: string;
  strGPSCoord: string;
  strCoreSampleRef: string;

  strJobNumber: string;
  strDate: string;
  strClientRef: string;
  strSiteRef: string;
  strDateTested: string;
  strDCPRef: string;
  strTestLocation: string;
  strTrafficDirection: string;
  strLaneOffset: string;
  strTestPitRef: string;
  conecondition: ConeCondition;
  data: DataPoint[];
}

const transformDataPoints = (originalData: DataPoint[]): DataPoint[] => {
  if (originalData.length === 0) return [];

  const initialY = originalData[0].y; // Store the first y value
  
  return originalData.map((_, index) => {
    // Sum of all x values up to current index (inclusive)
    const sumX = originalData
      .slice(0, index + 1)
      .reduce((sum, point) => sum + point.x, 0);
    
    // Difference between current y and initial y
    const diffY = originalData[index].y - initialY;

    return {
      x: sumX,
      y: diffY
    };
  });
}

const generateChartHTML = (data: DataPoint[]) => {
  const maxX = Math.max(...data.map(point => point.x));
  const maxY = Math.max(...data.map(point => point.y));
  
  // Round up to the next multiple of 10
  const chartMaxX = Math.ceil(maxX / 10) * 10;
  const chartMaxY = Math.ceil(maxY / 100) * 100;

  console.log("chartMaxX:: ", chartMaxX, " chartMaxY::: ", chartMaxY)

  return `
  <!DOCTYPE html>
  <html>
  <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
          .chart-container {
              position: relative;
              height: 400px;
              width: 100%;
              
          }
      </style>
  </head>
  <body>
      <div class="chart-container">
          <canvas id="penetrationChart"></canvas>
      </div>
      <script>
          const ctx = document.getElementById('penetrationChart').getContext('2d');
          const chartData = ${JSON.stringify(data)};

          new Chart(ctx, {
              type: 'scatter',
              data: {
                  datasets: [{
                      data: chartData,
                      showLine: true,
                      borderColor: 'red',
                      backgroundColor: 'red',
                      pointRadius: 2.5,
                      borderWidth: 1.5
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  layout: {
                      padding: {
                          left: 10,
                          right: 30,
                          top: 30,
                          bottom: 10
                      }
                  },
                  scales: {
                      x: {
                          type: 'linear',
                          position: 'top',
                          title: {
                              display: true,
                              text: 'Number of Blows',
                              font: {
                                  size: 8,
                                  weight: 'bold'
                              }
                          },
                          min: 0,
                          max: ${chartMaxX},
                          ticks: {
                              stepSize: 5
                          },
                          grid: {
                              color: '#E5E5E5'
                          }
                      },
                      y: {
                          reverse: true,
                          title: {
                              display: true,
                              text: 'Depth of Penetration (mm)',
                              font: {
                                  size: 8,
                                  weight: 'bold'
                              }
                          },
                          min: 0,
                          max: ${chartMaxY},
                          ticks: {
                              stepSize: 50
                          },
                          grid: {
                              color: '#E5E5E5'
                          }
                      }
                  },
                  plugins: {
                      legend: {
                          display: false
                      }
                  }
              }
          });

          function captureChart() {
              const canvas = document.getElementById('penetrationChart');
              const imageData = canvas.toDataURL('image/png');
              window.ReactNativeWebView.postMessage(imageData);
          }

          setTimeout(captureChart, 1000);
      </script>
  </body>
  </html>
  `;
};

const App: React.FC = () => {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [chartImageBase64, setChartImageBase64] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const [cbrData, setCbrData] = useState<CBRData>({
    strTitle: '-',
    strClientRef: '-',
    strCoreHoleDepth: '-',
    strDate: '-',
    strClient: '-',
    strCoreSampleRef: '-',
    strDateTested: '-',
    strDateTime: '-',
    strDCPRef: '-',
    strGPSCoord: '-',
    strIssueInfo: '-',
    strJobNumber: '-',
    strLaneOffset: '-',
    strMType: '-',
    strSiteLocation: '-',
    strSiteRef: '-',
    strSuplier: '-',
    strTechnician: '-',
    strTestLocation: '-',
    strTestPitRef: '-',
    strTrafficDirection: '-',
    strZeroError: '-',
    conecondition: {
      checker: true,
      status: '-'
    },

    data: [
      // { x: 0, y: 0 }, { x: 1, y: 40 }, { x: 2, y: 75 }, { x: 3, y: 95 },
      // { x: 4, y: 115 }, { x: 5, y: 125 }, { x: 7, y: 140 }, { x: 9, y: 155 },
      // { x: 12, y: 175 }, { x: 15, y: 195 }, { x: 17, y: 220 }, { x: 18, y: 240 },
      // { x: 20, y: 270 }, { x: 22, y: 305 }, { x: 23, y: 325 }, { x: 25, y: 355 },
      // { x: 28, y: 385 }, { x: 31, y: 425 }, { x: 34, y: 455 }, { x: 37, y: 475 },
      // { x: 41, y: 535 }, { x: 45, y: 555 }, { x: 47, y: 585 }, { x: 49, y: 595 },
      // { x: 53, y: 625 }, { x: 57, y: 675 }, { x: 59, y: 685 }, 
    ]
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
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

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    // Add your refresh logic here
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const onWebViewMessage = (event: any) => {
    const base64Data = event.nativeEvent.data;
    setChartImageBase64(base64Data);
  };

  const dateToString = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const formattedDate = `${day}-${month}-${year}`;
    return formattedDate;
  }

  const selectAndParseExcel = async () => {
    try {
      setIsAnalyzing(true);
      setShowResults(false);

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      if (result.canceled) {
        setIsAnalyzing(false);
        return;
      }

      const { uri } = result.assets[0];

      const fileContent = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const binaryString = atob(fileContent);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const workbook = new Excel.Workbook();
      await workbook.xlsx.load(bytes.buffer);

      const worksheet = workbook.getWorksheet('WorkSheets');
      if (!worksheet) {
        throw new Error('No worksheet found in Excel file');
      }

      const jsonData: DataPoint[] = [];
      const newCBRData: CBRData = {
        strTitle: '-',
        strClientRef: '-',
        strCoreHoleDepth: '-',
        strDate: '-',
        strClient: '-',
        strCoreSampleRef: '-',
        strDateTested: '-',
        strDateTime: '-',
        strDCPRef: '-',
        strGPSCoord: '-',
        strIssueInfo: '-',
        strJobNumber: '-',
        strLaneOffset: '-',
        strMType: '-',
        strSiteLocation: '-',
        strSiteRef: '-',
        strSuplier: '-',
        strTechnician: '-',
        strTestLocation: '-',
        strTestPitRef: '-',
        strTrafficDirection: '-',
        strZeroError: '-',
        conecondition: {
          checker: true,
          status: '-'
        },

        data: [
          // { x: 0, y: 0 }, { x: 1, y: 40 }, { x: 2, y: 75 }, { x: 3, y: 95 },
          // { x: 4, y: 115 }, { x: 5, y: 125 }, { x: 7, y: 140 }, { x: 9, y: 155 },
          // { x: 12, y: 175 }, { x: 15, y: 195 }, { x: 17, y: 220 }, { x: 18, y: 240 },
          // { x: 20, y: 270 }, { x: 22, y: 305 }, { x: 23, y: 325 }, { x: 25, y: 355 },
          // { x: 28, y: 385 }, { x: 31, y: 425 }, { x: 34, y: 455 }, { x: 37, y: 475 },
          // { x: 41, y: 535 }, { x: 45, y: 555 }, { x: 47, y: 585 }, { x: 49, y: 595 },
          // { x: 53, y: 625 }, { x: 57, y: 675 }, { x: 59, y: 685 }, 
        ]
      };

      // Get metadata from specific cells
      newCBRData.strTitle = worksheet.getCell('C1').value?.toString() || '-';
      newCBRData.strIssueInfo = worksheet.getCell('I1').value?.toString() || '-';
      newCBRData.strDateTime = worksheet.getCell('C3').value?.toString() || '-';
      newCBRData.strClient = worksheet.getCell('C4').value?.toString() || '-';
      newCBRData.strSiteLocation = worksheet.getCell('C5').value?.toString() || '-';
      newCBRData.strSuplier = worksheet.getCell('C6').value?.toString() || '-';
      newCBRData.strTechnician = worksheet.getCell('C7').value?.toString() || '-';
      newCBRData.strMType = worksheet.getCell('C8').value?.toString() || '-';
      newCBRData.strZeroError = worksheet.getCell('C9').value?.toString() || '-';
      newCBRData.strCoreHoleDepth = worksheet.getCell('C10').value?.toString() || '-';
      newCBRData.strGPSCoord = worksheet.getCell('C11').value?.toString() || '-';
      newCBRData.strCoreSampleRef = worksheet.getCell('C12').value?.toString() || '-';
      newCBRData.strJobNumber = worksheet.getCell('H3').value?.toString() || '-';
      newCBRData.strClientRef = worksheet.getCell('H4').value?.toString() || '-';
      newCBRData.strSiteRef = worksheet.getCell('H5').value?.toString() || '-';
      newCBRData.strDateTested = worksheet.getCell('H6').value?.toString() || '-';
      newCBRData.strDCPRef = worksheet.getCell('H7').value?.toString() || '-';
      newCBRData.strTestLocation = worksheet.getCell('H8').value?.toString() || '-';
      newCBRData.strTrafficDirection = worksheet.getCell('H9').value?.toString() || '-';
      newCBRData.strLaneOffset = worksheet.getCell('H10').value?.toString() || '-';
      newCBRData.strTestPitRef = worksheet.getCell('H11').value?.toString() || '-';
      newCBRData.conecondition.checker = worksheet.getCell('H12').value?.toString() === 'true' ? true : false;
      newCBRData.conecondition.status = worksheet.getCell('I12').value?.toString() || '-';

      console.log("newCBRData: ", newCBRData);

      // Get DCP test data starting from row 17
      for (let row = 16; row <= 40; row++) {
        const point = worksheet.getCell(`A${row}`).value;
        const blows = worksheet.getCell(`C${row}`).value;
        const pd = worksheet.getCell(`D${row}`).value;

        if (point !== null && blows !== null && pd !== null) {
          const pointNum = typeof point === 'number' ? point : Number(point);
          const blowsNum = typeof blows === 'number' ? blows : Number(blows);
          const pdNum = typeof pd === 'number' ? pd : Number(pd);

          if (!isNaN(pointNum) && !isNaN(blowsNum) && !isNaN(pdNum)) {
            jsonData.push({
              x: blowsNum,
              y: pdNum
            });
          }
        }

        

        // Get data from middle columns (Point 26-50)
        const point2 = worksheet.getCell(`E${row}`).value;
        const blows2 = worksheet.getCell(`F${row}`).value;
        const pd2 = worksheet.getCell(`G${row}`).value;

        if (point2 && blows2 && pd2) {
          const point2Num = typeof point2 === 'number' ? point2 : Number(point2);
          const blows2Num = typeof blows2 === 'number' ? blows2 : Number(blows2);
          const pd2Num = typeof pd2 === 'number' ? pd2 : Number(pd2);

          if (!isNaN(point2Num) && !isNaN(blows2Num) && !isNaN(pd2Num)) {
            jsonData.push({
              x: blows2Num,
              y: pd2Num
            });
          }
        }

        // Get data from right columns (Point 51-75)
        const point3 = worksheet.getCell(`H${row}`).value;
        const blows3 = worksheet.getCell(`I${row}`).value;
        const pd3 = worksheet.getCell(`J${row}`).value;

        if (point3 && blows3 && pd3) {
          const point3Num = typeof point3 === 'number' ? point3 : Number(point3);
          const blows3Num = typeof blows3 === 'number' ? blows3 : Number(blows3);
          const pd3Num = typeof pd3 === 'number' ? pd3 : Number(pd3);

          if (!isNaN(point3Num) && !isNaN(blows3Num) && !isNaN(pd3Num)) {
            jsonData.push({
              x: blows3Num,
              y: pd3Num
            });
          }
        }
      }

      // Sort data by penetration depth (y value)
      jsonData.sort((a, b) => a.y - b.y);

      const data = transformDataPoints(jsonData);
      newCBRData.data = data;
      setCbrData(newCBRData);

      setShowResults(true);
      Alert.alert('Success', 'Excel file parsed successfully');
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      Alert.alert('Error', 'Failed to parse Excel file');
    } finally {
      setIsAnalyzing(false)
    }
  };

  const generateCBRReport = async () => {
    try {
      setIsAnalyzing(true);

      if (!chartImageBase64) {
        Alert.alert('Error', 'Chart image not ready');
        return;
      }

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Estimation of California Bearing Ratio (CBR)</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            font-family: Arial, sans-serif;
        }

        body {
            font-family: Arial, sans-serif;
            max-width: 596px;
            padding: 60px 40px;
        }

        .header {
            display: flex;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 5px;
        }

        .logo {
            width: 15%;
            height: auto;
        }

        .title {
            flex-grow: 1;
            text-align: center;
        }

        .title h1 {
            font-size: 12px;
            margin: 0;
            font-weight: bold;
        }

        .doc-info {
            text-align: left;
            font-size: 8px;
            line-height: 1;
        }

        /* Updated table styles */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;

        }

        td {
            padding: 1px;
            font-size: 8px;
            vertical-align: middle;
            font-family: Arial, sans-serif;
            color: black;
        }

        /* Left column pair */
        .td_first {
            width: 15%;
            border: 1px solid black;
            background: white;
        }

        .td_header {
            border: 1px solid black;
            padding: 0.5px;
            background: white;
        }

        .td_second {
            width: 35%;
            border: 1px solid black;
            background: white;
        }

        .td_third {
            width: 20%;
            border: 1px solid black;
            background: white;
        }

        .td_fourth {
            width: 35%;
            border: 1px solid black;
            background: white;
        }

        .td_checkbox {
            width: 10%;
            border: 1px solid black;
            background: white;
            text-align: center;
        }

        .td_fifth {
            width: 20%;
            border: 1px solid black;
            background: white;
            text-align: left;
        }

        input[type="checkbox"] {
            transform: scale(0.5);
            vertical-align: middle;
            margin: 0;
        }

        .test-results {
            display: flex;
            gap: 20px;
            margin: 30px 0;
        }

        .chart-container {
            flex: 2;
            height: 600px;
            border: 1px solid #ccc;
            padding: 20px;
        }

        .gradients {
            flex: 1;
        }

        .gradient-box {
            border: 1px solid #000;
            margin-bottom: 15px;
            padding: 10px;
        }

        .gradient-box h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            font-weight: bold;
        }

        .gradient-row {
            display: flex;
            margin: 5px 0;
            font-size: 12px;
        }

        .gradient-label {
            flex: 1.2;
        }

        .gradient-value {
            flex: 0.8;
            background: #e8ffe8;
        }

        .footer {
            margin-top: 30px;
            font-size: 12px;
        }

        .signature-box {
            float: right;
            width: 300px;
            border: 1px solid #000;
            padding: 15px;
            margin-left: 20px;
            text-align: right;
        }

        .signature-img {
            width: 150px;
            margin: 10px 0;
        }

        .remarks {
            clear: both;
            padding-top: 20px;
        }

        .remarks p {
            margin: 5px 0;
            font-size: 12px;
        }
    </style>
</head>

<body>
    <div class="header">
        <img src="logo.png" alt="AMTEST UK" class="logo">
        <div class="title">
            <pre style="margin: 0px; text-align: center; font-size: 12px; margin: 0; font-weight: bold;">
              ${cbrData.strTitle}</pre>
        </div>
        <div class="doc-info">
            <pre style="margin: 0px; text-align: left; font-size: 8px; line-height: 1;">
              ${cbrData.strIssueInfo}</pre>
        </div>
    </div>

    <table>
        <tr>
            <td class="td_header" colspan="5"></td>
        </tr>
        <tr>
            <td class="td_first">Date/Time:</td>
            <td class="td_second">${dateToString(new Date(cbrData.strDateTime))}</td>
            <td class="td_third">Job Number:</td>
            <td class="td_fourth" colspan="2">${cbrData.strJobNumber}</td>
        </tr>
        <tr>
            <td class="td_first">Client:</td>
            <td class="td_second">${cbrData.strClient}</td>
            <td class="td_third">Client Ref.:</td>
            <td class="td_fourth" colspan="2">${cbrData.strClientRef}</td>
        </tr>
        <tr>
            <td class="td_first">Site / Location:</td>
            <td class="td_second">${cbrData.strSiteLocation}</td>
            <td class="td_third">Site Ref.:</td>
            <td class="td_fourth" colspan="2">${cbrData.strSiteRef}</td>
        </tr>
        <tr>
            <td class="td_first">Supplier:</td>
            <td class="td_second">${cbrData.strSuplier}</td>
            <td class="td_third">Date Tested:</td>
            <td class="td_fourth" colspan="2">${cbrData.strDateTested}</td>
        </tr>
        <tr>
            <td class="td_first">Technician:</td>
            <td class="td_second">${cbrData.strTechnician}</td>
            <td class="td_third">DCP Reference:</td>
            <td class="td_fourth" colspan="2">${cbrData.strDCPRef}</td>
        </tr>
        <tr>
            <td class="td_first">Material Type:</td>
            <td class="td_second">${cbrData.strMType}</td>
            <td class="td_third">Test Location / Chainage:</td>
            <td class="td_fourth" colspan="2">${cbrData.strTestLocation}</td>
        </tr>
        <tr>
            <td class="td_first">Zero Error:</td>
            <td class="td_second">${cbrData.strZeroError}</td>
            <td class="td_third">Traffic Direction:</td>
            <td class="td_fourth" colspan="2">${cbrData.strTrafficDirection}</td>
        </tr>
        <tr>
            <td class="td_first">Core Hole Depth:</td>
            <td class="td_second">${cbrData.strCoreHoleDepth}</td>
            <td class="td_third">Lane / Offset / Datum:</td>
            <td class="td_fourth" colspan="2">${cbrData.strLaneOffset}</td>
        </tr>
        <tr>
            <td class="td_first">GPS Coordinates:</td>
            <td class="td_second">${cbrData.strGPSCoord}</td>
            <td class="td_third">Test Pit Ref:</td>
            <td class="td_fourth" colspan="2">${cbrData.strTestPitRef}</td>
        </tr>
        <tr>
            <td class="td_first">Core Sample Ref:</td>
            <td class="td_second">${cbrData}</td>
            <td class="td_third">Cone 60°/Condition</td>
            <td class="td_checkbox">
                <input type="checkbox" ${cbrData.conecondition.checker ? 'checked' : ''}>
            </td>
            <td class="td_fifth">${cbrData.conecondition.status}</td>
        </tr>
    </table>

    <h3>Test Results</h3>
    <div class="test-results">
        <div class="chart-container">
            <img src="${chartImageBase64}" class="chart-image" />
        </div>
        <div class="gradients">
            <div class="gradient-box">
                <h3>Gradient 1</h3>
                <div class="gradient-row">
                    <div class="gradient-label">Depth from (mm):</div>
                    <div class="gradient-value">0</div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">depth to(mm):</div>
                    <div class="gradient-value">475</div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">No. of Blows:</div>
                    <div class="gradient-value">37</div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">Blow Rate (mm/Blow):</div>
                    <div class="gradient-value">12.8</div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">Estimated CBR (%):</div>
                    <div class="gradient-value">20.3</div>
                </div>
            </div>
            <div class="gradient-box">
                <h3>Gradient 2</h3>
                <div class="gradient-row">
                    <div class="gradient-label">Depth from (mm):</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">depth to(mm):</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">No. of Blows:</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">Blow Rate (mm/Blow):</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">Estimated CBR (%):</div>
                    <div class="gradient-value"></div>
                </div>
            </div>
            <div class="gradient-box">
                <h3>Gradient 3</h3>
                <div class="gradient-row">
                    <div class="gradient-label">Depth from (mm):</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">depth to(mm):</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">No. of Blows:</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">Blow Rate (mm/Blow):</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">Estimated CBR (%):</div>
                    <div class="gradient-value"></div>
                </div>
            </div>
            <div class="gradient-box">
                <h3>Gradient 4</h3>
                <div class="gradient-row">
                    <div class="gradient-label">Depth from (mm):</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">depth to(mm):</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">No. of Blows:</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">Blow Rate (mm/Blow):</div>
                    <div class="gradient-value"></div>
                </div>
                <div class="gradient-row">
                    <div class="gradient-label">Estimated CBR (%):</div>
                    <div class="gradient-value"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="footer">
        <div class="signature-box">
            <p>For and on behalf of AMTEST UK</p>
            <p>Approved by: R.Adams</p>
            <p>Position Held: Senior Technician</p>
            <img src="signature.png" alt="Signature" class="signature-img">
            <p>Date Reported: 28.01.2025</p>
        </div>
        <div class="remarks">
            <p>① Test results reported only relate to the item(s) tested and apply to the sample as received.</p>
            <p>② This report shall not be reproduced, except in full, without approval of the Laboratory.</p>
            <p>③ The laboratory does not apply a statement of conformity to the Test Report as standard, unless
                specifically requested by the client.</p>
            <p>AMTEST UK LTD Unit A 2D/6 Project Park, North Crescent, Canning Town E16 4TQ</p>
        </div>
    </div>
</body>

</html>`;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      const asset = await MediaLibrary.createAssetAsync(uri);

      if (Platform.OS === 'android') {
        const album = await MediaLibrary.getAlbumAsync('Download');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      }

      Alert.alert('Success', 'CBR Report generated successfully');

    } catch (error) {
      console.error('Error generating CBR report:', error);
      Alert.alert('Error', 'Failed to generate CBR report');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView>

      <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <CustomButton
            title="Logout"
            onPress={handleLogout}
            variant="danger"
          />
        </View>

        <View style={styles.container}>
          <TouchableOpacity
            style={styles.button}
            onPress={selectAndParseExcel}
            disabled={isAnalyzing}
          >
            <Text style={styles.buttonText}>Select Excel File</Text>
          </TouchableOpacity>

          {isAnalyzing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.loadingText}>Analyzing data...</Text>
            </View>
          )}

          {showResults && (
            <>
              <View style={styles.chartContainer}>
                <WebView
                  ref={webViewRef}
                  source={{ html: generateChartHTML(cbrData.data) }}
                  style={{ width: width - 40, height: 300 }}
                  onMessage={onWebViewMessage}
                  javaScriptEnabled={true}
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={generateCBRReport}
                disabled={isAnalyzing || !chartImageBase64}
              >
                <Text style={styles.buttonText}>Generate CBR Report</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    width: width - 40,
    height: 300,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    width: '80%',
    marginVertical: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  }
});

export default App;
