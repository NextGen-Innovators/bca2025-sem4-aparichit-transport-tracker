
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '../types';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  role: UserRole | null;
  setRole: (role: UserRole) => void;
  signInWithPhone: (phoneNumber: string, role: UserRole) => Promise<any>;
  verifyOTP: (confirmationResult: any, otp: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setRole(data.user.role as UserRole);
      } else {
        setUser(null);
        setRole(null);
      }
    } catch (e) {
      console.error('Session check failed', e);
    } finally {
      setLoading(false);
    }
  };

  // Deprecated/Stubbed for compatibility or used as wrapper for new Login
  const signInWithPhone = async (phoneNumber: string, role: UserRole) => {
    // In new flow, we don't return a confirmation result object, we just trigger request
    // This signature matches old code usage in page.tsx somewhat
    // But we are rewriting page.tsx too, so we can change this signature if we want.
    // However, keeping it generic helps.
    throw new Error("Use standard login instead");
  };

  const verifyOTP = async (confirmationResult: any, otp: string, role: UserRole) => {
    throw new Error("Use standard login instead");
  };

  const logout = async () => {
    // Implement logout API or just clear cookie on client (not possible for HttpOnly)
    // So separate Logout API needed.
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setRole(null);
    router.push('/auth');
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      role,
      setRole, // Manually setting role might be needed before login for UI state
      signInWithPhone,
      verifyOTP,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};
