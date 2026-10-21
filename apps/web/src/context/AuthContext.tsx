import { API_URL } from "../lib/api";
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  supporterNumber?: string | null;
  supporterExpiresAt?: string | null;
  verifiedAt?: string | null;
  isPrivate?: boolean;
}

interface Account {
  user: User;
  token: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  accounts: Account[];
  login: (user: User, token: string) => void;
  logout: () => void;
  switchAccount: (userId: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadAccounts(): Account[] {
  try {
    const stored = localStorage.getItem('accounts');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: Account[]) {
  localStorage.setItem('accounts', JSON.stringify(accounts));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    const storedAccounts = loadAccounts();
    const storedCurrentId = localStorage.getItem('currentUserId');
    if (storedCurrentId && storedAccounts.some((a) => a.user.id === storedCurrentId)) {
      return storedCurrentId;
    }
    return storedAccounts[0]?.user.id ?? null;
  });

  const login = (userData: User, newToken: string) => {
    setAccounts((prev) => {
      const existingIndex = prev.findIndex((a) => a.user.id === userData.id);
      let updated: Account[];
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = { user: userData, token: newToken };
      } else {
        updated = [...prev, { user: userData, token: newToken }];
      }
      saveAccounts(updated);
      return updated;
    });
    setCurrentUserId(userData.id);
    localStorage.setItem('currentUserId', userData.id);
  };

  const logout = useCallback(() => {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.user.id !== currentUserId);
      saveAccounts(updated);
      if (updated.length > 0) {
        setCurrentUserId(updated[0].user.id);
        localStorage.setItem('currentUserId', updated[0].user.id);
      } else {
        setCurrentUserId(null);
        localStorage.removeItem('currentUserId');
      }
      return updated;
    });
  }, [currentUserId]);

  const invalidateSession = useCallback((reason?: string) => {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.user.id !== currentUserId);
      saveAccounts(updated);
      if (updated.length > 0) {
        setCurrentUserId(updated[0].user.id);
        localStorage.setItem('currentUserId', updated[0].user.id);
      } else {
        setCurrentUserId(null);
        localStorage.removeItem('currentUserId');
      }
      return updated;
    });
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sdm_cache_') || k.startsWith('feed-') || k.startsWith('stories-'))) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {}
    void reason;
  }, [currentUserId]);

  const switchAccount = (userId: string) => {
    if (accounts.some((a) => a.user.id === userId)) {
      setCurrentUserId(userId);
      localStorage.setItem('currentUserId', userId);
    }
  };

  const currentAccount = accounts.find((a) => a.user.id === currentUserId) || null;

  useEffect(() => {
    const account = currentAccount;
    if (!account?.token) return;

    let cancelled = false;

    void fetch(API_URL + '/auth/me', {
      headers: { Authorization: 'Bearer ' + account.token },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const err = String((data as any).error || 'AUTH_REFRESH_FAILED');
          if (response.status === 401 || err === 'UNAUTHORIZED' || err === 'SESSION_REVOKED') {
            throw Object.assign(new Error(err), { code: 'UNAUTHORIZED' });
          }
          throw new Error(err);
        }
        return data as { user: User; token: string };
      })
      .then((data) => {
        if (cancelled) return;
        setAccounts((prev) => {
          const updated = prev.map((item) =>
            item.user.id === data.user.id
              ? { user: data.user, token: data.token }
              : item
          );
          saveAccounts(updated);
          return updated;
        });
        setCurrentUserId(data.user.id);
        localStorage.setItem('currentUserId', data.user.id);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error && (error as any).code === 'UNAUTHORIZED') {
          invalidateSession(String(error.message || 'UNAUTHORIZED'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentAccount?.token, currentAccount?.user.id, invalidateSession]);

  useEffect(() => {
    const onUnauthorized = () => {
      invalidateSession('UNAUTHORIZED');
    };
    window.addEventListener('sdm:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sdm:unauthorized', onUnauthorized);
  }, [invalidateSession]);

  return (
    <AuthContext.Provider
      value={{
        user: currentAccount?.user || null,
        token: currentAccount?.token || null,
        accounts,
        login,
        logout,
        switchAccount,
        isAuthenticated: !!currentAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
