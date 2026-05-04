import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { message } from 'antd';
import api, { apiEndpoints } from './services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await apiEndpoints.me();
      setUser(res.data || res);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (payload) => {
    setLoading(true);
    try {
      await apiEndpoints.login(payload);
      await fetchMe();
      message.success('Logged in');
      return true;
    } catch (e) {
      message.error(e?.message || 'Login failed');
      setLoading(false);
      return false;
    }
  }, [fetchMe]);

  const register = useCallback(async (payload) => {
    setLoading(true);
    try {
      await apiEndpoints.register(payload);
      // Auto-login after register
      await apiEndpoints.login({ email: payload.email, password: payload.password });
      await fetchMe();
      message.success('Account created');
      return true;
    } catch (e) {
      message.error(e?.message || 'Registration failed');
      setLoading(false);
      return false;
    }
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await apiEndpoints.logout();
    } catch {}
    setUser(null);
    message.success('Logged out');
  }, []);

  const value = useMemo(() => ({
    user, loading, login, register, logout, refresh: fetchMe
  }), [user, loading, login, register, logout, fetchMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
