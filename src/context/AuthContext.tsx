import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AgentShieldApi, extractApiError, getStoredToken, setStoredToken } from '../api/client';
import type { AdminUser } from '../types/api';

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  globalLockdown: boolean;
  llmMode: 'gemini' | 'deterministic_mock';
  pendingApprovals: number;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithGoogleDemo: (email?: string, name?: string) => Promise<void>;
  loginDemoAdmin: () => Promise<void>;
  logout: () => void;
  refreshSystemStatus: () => Promise<void>;
  authError: string | null;
  gmailConnected: boolean;
  gmailEmail: string | null;
  gmailLoading: boolean;
  connectGmailWithCode: (code: string) => Promise<void>;
  disconnectGmail: () => Promise<void>;
  refreshGmailStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalLockdown, setGlobalLockdown] = useState(false);
  const [llmMode, setLlmMode] = useState<'gemini' | 'deterministic_mock'>('deterministic_mock');
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);

  const refreshSystemStatus = useCallback(async () => {
    try {
      const stats = await AgentShieldApi.getDashboardStats();
      setGlobalLockdown(stats.global_lockdown);
      setLlmMode(stats.llm_mode);
      setPendingApprovals(stats.pending_approvals);
    } catch {
      // Ignore transient status refresh failures
    }
  }, []);

  const refreshGmailStatus = useCallback(async () => {
    try {
      const status = await AgentShieldApi.getGmailStatus();
      setGmailConnected(status.connected);
      setGmailEmail(status.email ?? null);
    } catch {
      setGmailConnected(false);
      setGmailEmail(null);
    }
  }, []);

  const connectGmailWithCode = useCallback(async (code: string) => {
    setGmailLoading(true);
    try {
      const res = await AgentShieldApi.exchangeGmailOAuthCode(code);
      setGmailConnected(res.connected);
      setGmailEmail(res.email ?? null);
    } finally {
      setGmailLoading(false);
    }
  }, []);

  const disconnectGmail = useCallback(async () => {
    setGmailLoading(true);
    try {
      await AgentShieldApi.disconnectGmail();
      setGmailConnected(false);
      setGmailEmail(null);
    } finally {
      setGmailLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const res = await AgentShieldApi.login(email, password);
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const loginDemoAdmin = useCallback(async () => {
    await login('admin@agentshield.io', 'ShieldAdmin2026!');
  }, [login]);

  const loginWithGoogle = useCallback(async (credential: string) => {
    setAuthError(null);
    const res = await AgentShieldApi.loginWithGoogle(credential);
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const loginWithGoogleDemo = useCallback(async (email?: string, name?: string) => {
    setAuthError(null);
    const res = await AgentShieldApi.loginWithGoogleDemo(email, name);
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setGmailConnected(false);
    setGmailEmail(null);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = getStoredToken();
        if (token) {
          try {
            const me = await AgentShieldApi.me();
            if (active) setUser(me.user);
            await refreshGmailStatus();
          } catch {
            setStoredToken(null);
            if (active) setUser(null);
          }
        }
        await refreshSystemStatus();
      } catch (err) {
        if (active) setAuthError(extractApiError(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshGmailStatus, refreshSystemStatus]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        globalLockdown,
        llmMode,
        pendingApprovals,
        login,
        loginWithGoogle,
        loginWithGoogleDemo,
        loginDemoAdmin,
        logout,
        refreshSystemStatus,
        authError,
        gmailConnected,
        gmailEmail,
        gmailLoading,
        connectGmailWithCode,
        disconnectGmail,
        refreshGmailStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
