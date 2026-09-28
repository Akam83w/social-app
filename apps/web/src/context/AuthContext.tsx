import { createContext, useContext, useEffect, useState } from 'react';
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
  const stored = localStorage.getItem('accounts');
  return stored ? JSON.parse(stored) : [];
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

  const logout = () => {
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
  };

  const switchAccount = (userId: string) => {
    if (accounts.some((a) => a.user.id === userId)) {
      setCurrentUserId(userId);
      localStorage.setItem('currentUserId', userId);
    }
  };

  const currentAccount = accounts.find((a) => a.user.id === currentUserId) || null;

  useEffect(() => {
    // Always refresh the account from the server by its immutable user ID.
    // This keeps the same account after username, display name, phone, bio, or avatar changes.
    const account = currentAccount;
    if (!account?.token) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    let cancelled = false;

    void fetch(API_URL + '/auth/me', {
      headers: { Authorization: 'Bearer ' + account.token },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'AUTH_REFRESH_FAILED');
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
      .catch(() => {
        // Keep the locally stored session if the API is temporarily unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
