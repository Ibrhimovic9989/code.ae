'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type ApiUser } from './api-client';

interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: ApiUser | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string; locale?: 'ar' | 'en' }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  const hydrate = useCallback(async () => {
    try {
      const { accessToken } = await api.refresh();
      api.setAccessToken(accessToken);
      const { user } = await api.me();
      setState({ status: 'authenticated', user });
    } catch {
      api.setAccessToken(null);
      setState({ status: 'unauthenticated', user: null });
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const login = useCallback<AuthContextValue['login']>(async (email, password) => {
    const { user, accessToken } = await api.login({ email, password });
    api.setAccessToken(accessToken);
    setState({ status: 'authenticated', user });
  }, []);

  const register = useCallback<AuthContextValue['register']>(async (input) => {
    const { user, accessToken } = await api.register(input);
    api.setAccessToken(accessToken);
    setState({ status: 'authenticated', user });
  }, []);

  const logout = useCallback<AuthContextValue['logout']>(async () => {
    try {
      await api.logout();
    } finally {
      api.setAccessToken(null);
      setState({ status: 'unauthenticated', user: null });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
