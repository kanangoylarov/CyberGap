import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT token
// api.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem('token');
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// // Response interceptor: unwrap data / handle 401
// api.interceptors.response.use(
//   (response) => response.data,
//   (error) => {
//     if (error.response?.status === 401) {
//       localStorage.removeItem('token');
//       localStorage.removeItem('userId');
//       localStorage.removeItem('isAdmin');
//       window.location.href = '/login';
//     }
    
//     const message =
//       error.response?.data?.message ||
//       error.response?.data?.error ||
//       error.message ||
//       'An unexpected error occurred';
      
//     return Promise.reject(new Error(message));
//   }
// );

export default api;
