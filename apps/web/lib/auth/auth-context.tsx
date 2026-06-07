'use client';

import * as React from 'react';
import { api, getToken, setToken, getActiveCompany, setActiveCompany } from '@/lib/api/client';
import type { Company, LoginResult } from '@/lib/api/types';

interface SessionUser {
  userId: string;
  tenantId: string;
  email: string;
  avatarUrl?: string | null;
}

interface AuthState {
  ready: boolean;
  user: SessionUser | null;
  companies: Company[];
  activeCompany: Company | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (email: string, password: string, companyName: string) => Promise<LoginResult>;
  completeOAuth: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  selectCompany: (companyId: string) => void;
  reloadCompanies: () => Promise<Company[]>;
  /** Upload/replace (data URL) or remove (null) the current user's avatar. */
  setAvatar: (dataUrl: string | null) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);
const EMAIL_KEY = 'mgi.email';

function decodeJwt(token: string): { sub?: string; tid?: string } {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ ready: false, user: null, companies: [], activeCompany: null });

  const buildUser = React.useCallback((): SessionUser | null => {
    const token = getToken();
    if (!token) return null;
    const { sub, tid } = decodeJwt(token);
    if (!sub || !tid) return null;
    const email = (typeof window !== 'undefined' && window.localStorage.getItem(EMAIL_KEY)) || '';
    return { userId: sub, tenantId: tid, email };
  }, []);

  const loadCompanies = React.useCallback(async (): Promise<Company[]> => {
    const companies = await api<Company[]>('/companies', { company: false });
    let active: Company | null = null;
    const stored = getActiveCompany();
    active = companies.find((c) => c.id === stored) ?? companies[0] ?? null;
    if (active) setActiveCompany(active.id);
    setState((s) => ({ ...s, companies, activeCompany: active }));
    return companies;
  }, []);

  // bootstrap on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = buildUser();
      if (!user) {
        if (!cancelled) setState({ ready: true, user: null, companies: [], activeCompany: null });
        return;
      }
      try {
        const companies = await api<Company[]>('/companies', { company: false });
        if (cancelled) return;
        const stored = getActiveCompany();
        const active = companies.find((c) => c.id === stored) ?? companies[0] ?? null;
        if (active) setActiveCompany(active.id);
        setState({ ready: true, user, companies, activeCompany: active });
      } catch {
        if (!cancelled) setState({ ready: true, user, companies: [], activeCompany: null });
      }
    })();
    return () => { cancelled = true; };
  }, [buildUser]);

  const login = React.useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const result = await api<LoginResult>('/auth/login', { method: 'POST', body: { email, password }, anonymous: true, company: false });
    if (result.status === 'authenticated' && result.accessToken) {
      setToken(result.accessToken);
      if (typeof window !== 'undefined') window.localStorage.setItem(EMAIL_KEY, email);
      const user = buildUser();
      const companies = await loadCompanies();
      setState({ ready: true, user, companies, activeCompany: companies.find((c) => c.id === getActiveCompany()) ?? companies[0] ?? null });
    }
    return result;
  }, [buildUser, loadCompanies]);

  const register = React.useCallback(async (email: string, password: string, companyName: string): Promise<LoginResult> => {
    const result = await api<LoginResult>('/auth/register', { method: 'POST', body: { email, password, companyName }, anonymous: true, company: false });
    if (result.status === 'authenticated' && result.accessToken) {
      setToken(result.accessToken);
      if (typeof window !== 'undefined') window.localStorage.setItem(EMAIL_KEY, email);
      const user = buildUser();
      const companies = await loadCompanies();
      setState({ ready: true, user, companies, activeCompany: companies.find((c) => c.id === getActiveCompany()) ?? companies[0] ?? null });
    }
    return result;
  }, [buildUser, loadCompanies]);

  const completeOAuth = React.useCallback(async (accessToken: string) => {
    setToken(accessToken);
    const user = buildUser();
    const companies = await loadCompanies().catch(() => [] as Company[]);
    setState({ ready: true, user, companies, activeCompany: companies.find((c) => c.id === getActiveCompany()) ?? companies[0] ?? null });
  }, [buildUser, loadCompanies]);

  const logout = React.useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST', body: {}, company: false }); } catch { /* ignore */ }
    setToken(null);
    setActiveCompany(null);
    setState({ ready: true, user: null, companies: [], activeCompany: null });
  }, []);

  const selectCompany = React.useCallback((companyId: string) => {
    setActiveCompany(companyId);
    setState((s) => ({ ...s, activeCompany: s.companies.find((c) => c.id === companyId) ?? s.activeCompany }));
  }, []);

  const setAvatar = React.useCallback(async (dataUrl: string | null) => {
    const me = dataUrl
      ? await api<{ avatarUrl: string | null; email: string }>('/identity/avatar', { method: 'PUT', body: { dataUrl }, company: false })
      : await api<{ avatarUrl: string | null; email: string }>('/identity/avatar', { method: 'DELETE', company: false });
    setState((s) => (s.user ? { ...s, user: { ...s.user, avatarUrl: me.avatarUrl } } : s));
  }, []);

  // Hydrate the user's profile (avatar + authoritative email) once a session exists.
  React.useEffect(() => {
    if (!state.ready || !state.user || state.user.avatarUrl !== undefined) return;
    let cancelled = false;
    api<{ email: string; avatarUrl: string | null }>('/identity/me', { company: false })
      .then((me) => { if (!cancelled) setState((s) => (s.user ? { ...s, user: { ...s.user, avatarUrl: me.avatarUrl, email: me.email || s.user.email } } : s)); })
      .catch(() => { if (!cancelled) setState((s) => (s.user ? { ...s, user: { ...s.user, avatarUrl: null } } : s)); });
    return () => { cancelled = true; };
  }, [state.ready, state.user]);

  const value: AuthContextValue = { ...state, login, register, completeOAuth, logout, selectCompany, reloadCompanies: loadCompanies, setAvatar };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
