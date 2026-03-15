import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Signup from './Signup';
import Dashboard from './Dashboard';

export default function App() {
  return (
    <MantineProvider defaultColorScheme="dark">
      <BrowserRouter>
        <Routes>
          {/* Redirect root (/) to login directly initially, or we could redirect based on token */}
          <Route path="/" element={<Navigate to="/login" />} />
          
          {/* Individual Pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* 404 Page (Optional) */}
          <Route path="*" element={<div style={{color: 'white', textAlign:'center', marginTop: '50px'}}>404 - Not Found</div>} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}