import AsyncStorage from '@react-native-async-storage/async-storage';

export const setToken = async (token: string) => {
  await AsyncStorage.setItem('token', token);
};

export const getToken = async () => {
  return await AsyncStorage.getItem('token');
};

export const removeToken = async () => {
  await AsyncStorage.removeItem('token');
};

export const setUser = async (user: any) => {
  await AsyncStorage.setItem('user', JSON.stringify(user));
};

export const getUser = async () => {
  const user = await AsyncStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const removeUser = async () => {
  await AsyncStorage.removeItem('user');
};

export const logout = async () => {
  await Promise.all([removeToken(), removeUser()]);
};
