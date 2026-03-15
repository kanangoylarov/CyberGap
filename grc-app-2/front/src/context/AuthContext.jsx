import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { post, get } from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'grc_token';
const USER_KEY = 'grc_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token && !user) {
      get('/api/auth/me')
        .then((res) => {
          if (res.success && res.data) {
            setUser(res.data);
            localStorage.setItem(USER_KEY, JSON.stringify(res.data));
          } else {
            logout();
          }
        })
        .catch(() => {
          logout();
        });
    }
  }, []);

  const saveAuth = useCallback((newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const res = await post('/api/auth/login', { email, password });
      if (res.success) {
        saveAuth(res.data.token, res.data.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Login failed' };
    } catch (e) {
      return { success: false, error: 'Connection error. Is the server running?' };
    } finally {
      setLoading(false);
    }
  }, [saveAuth]);

  const register = useCallback(async (firstName, lastName, email, company, password) => {
    setLoading(true);
    try {
      const res = await post('/api/auth/register', {
        firstName,
        lastName,
        email,
        company,
        password,
      });
      if (res.success) {
        saveAuth(res.data.token, res.data.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Registration failed' };
    } catch (e) {
      return { success: false, error: 'Connection error. Is the server running?' };
    } finally {
      setLoading(false);
    }
  }, [saveAuth]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const value = {
    token,
    user,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
