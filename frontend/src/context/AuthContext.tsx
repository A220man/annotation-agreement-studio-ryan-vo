import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/api';
import { api, setAuthToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  role: string;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  loginDemo: (role: string) => Promise<void>;
  initiateOidcLogin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>('analyst');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [authConfig, setAuthConfig] = useState<any>(null);

  useEffect(() => {
    api.auth.getConfig()
      .then((cfg) => {
        setAuthConfig(cfg);
        setIsDemoMode(Boolean(cfg.demo_mode));
        // In local demo mode, auto-login default analyst persona
        if (cfg.demo_mode) {
          loginDemo('analyst');
        }
      })
      .catch(() => {
        // Fallback default
        setIsDemoMode(true);
        loginDemo('analyst');
      });
  }, []);

  const loginDemo = async (targetRole: string) => {
    try {
      const resp = await api.auth.getDemoToken(targetRole, `demo-${targetRole}`, `${targetRole}@example.com`);
      setAuthToken(resp.access_token);
      setRole(targetRole);
      const me = await api.auth.getMe();
      setUser(me);
    } catch (err) {
      console.error('Demo authentication failed:', err);
    }
  };

  const initiateOidcLogin = () => {
    if (!authConfig) return;
    // Generate PKCE code verifier and code challenge
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const verifier = Array.from(array, (dec) => ('0' + dec.toString(16)).substr(-2)).join('');
    const state = Math.random().toString(36).substring(2, 15);

    // Save temporary PKCE state in sessionStorage (temporary across redirect)
    sessionStorage.setItem('oidc_state', state);
    sessionStorage.setItem('oidc_verifier', verifier);

    const redirectUri = window.location.origin + '/callback';
    const authUrl = `${authConfig.oidc_issuer_url}/protocol/openid-connect/auth?` +
      `client_id=${encodeURIComponent(authConfig.oidc_client_id)}` +
      `&response_type=code` +
      `&scope=openid%20profile%20email` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}` +
      `&code_challenge_method=plain` +
      `&code_challenge=${verifier}`;

    window.location.href = authUrl;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Continue client-side wipe
    }
    setAuthToken(null);
    setUser(null);
    sessionStorage.removeItem('oidc_state');
    sessionStorage.removeItem('oidc_verifier');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isDemoMode,
        loginDemo,
        initiateOidcLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
