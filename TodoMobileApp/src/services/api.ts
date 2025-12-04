import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// REPLACE THIS WITH YOUR RENDER URL OR LOCAL IP
// const API_URL = 'http://10.0.2.2:3000/api'; 
const API_URL = 'https://todo-app-fullstack-rho.vercel.app/api'; 

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log("token is here : ", token);
  
  return config;
});

export default api;