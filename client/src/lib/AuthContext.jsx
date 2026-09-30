import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from './api.js';

// Single source of truth for who is signed in and whether they have a
// bank account, so every page reads one seller record and one refresh
// runs per page load.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('checking'); // checking | authed | anon
  const [seller, setSeller] = useState(null);

  const loadSeller = useCallback(async () => {
    try {
      const { seller: s } = await api.me();
      setSeller(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    api
      .refresh()
      .then(async ({ accessToken }) => {
        setAccessToken(accessToken);
        await loadSeller();
        setStatus('authed');
      })
      .catch(() => setStatus('anon'));
  }, [loadSeller]);

  const login = useCallback(
    async (accessToken) => {
      setAccessToken(accessToken);
      await loadSeller();
      setStatus('authed');
    },
    [loadSeller]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setAccessToken(null);
      setSeller(null);
      setStatus('anon');
    }
  }, []);

  const value = {
    status,
    seller,
    hasBankAccount: Boolean(seller?.bankAccount),
    login,
    logout,
    refreshSeller: loadSeller,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
