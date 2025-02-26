import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { setToken, setUser } from '../utils/auth';
import CustomButton from '../components/CustomButton';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(API_ENDPOINTS.login, {
        email,
        password,
      });

      await setToken(response.data.token);
      await setUser(response.data.user);
      
      router.replace('/');
    } catch (error: any) {
      Alert.alert(
        'Error', 
        error.response?.data?.error || 'Login failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.form}>
        <Text style={styles.title}>Welcome Back</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <CustomButton
          title={loading ? "Logging in..." : "Login"}
          onPress={handleLogin}
          variant="primary"
        />
        
        <CustomButton
          title="Create Account"
          onPress={() => router.push('/auth/signup')}
          variant="secondary"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
});
