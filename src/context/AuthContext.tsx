import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole, LoginCredentials, SignUpData } from '../types/auth';
import { api } from '../api';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<User>;
  signUp: (data: SignUpData) => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  clearError: () => void;
  setUserSession: (user: User, token?: string) => void;
  switchRole: (newRole: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state directly from persistent storage for permanent authentication
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('fieldassist_user_profile');
      if (cached) {
        return JSON.parse(cached) as User;
      }
    } catch {
      // Ignore
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('fieldassist_auth_token');
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If Supabase is online and has an active session, sync in background
    const syncBackendSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const supaUser = data.session.user;
          const userObj: User = {
            id: supaUser.id,
            name: supaUser.user_metadata?.full_name || supaUser.email?.split('@')[0] || 'Field User',
            email: supaUser.email || '',
            role: (supaUser.user_metadata?.role as UserRole) || 'Sales Manager',
            avatar: supaUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(supaUser.email || 'User')}&background=0284c7&color=fff`,
            territory: supaUser.user_metadata?.territory || 'North Delhi',
            region: 'North Zone (Delhi-NCR)',
            department: 'Field Sales Operations',
            permissions: ['all', 'read:all', 'write:orders'],
          };
          setUser(userObj);
          setToken(data.session.access_token);
          localStorage.setItem('fieldassist_user_profile', JSON.stringify(userObj));
          localStorage.setItem('fieldassist_auth_token', data.session.access_token);
        }
      } catch {
        // Retain permanent local session on network failure or DNS timeout
      }
    };

    syncBackendSession();

    // Reactive listener for Supabase authentication state changes
    try {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setToken(null);
          localStorage.removeItem('fieldassist_user_profile');
          localStorage.removeItem('fieldassist_auth_token');
        } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          const supaUser = session.user;
          const userObj: User = {
            id: supaUser.id,
            name: supaUser.user_metadata?.full_name || supaUser.email?.split('@')[0] || 'Field User',
            email: supaUser.email || '',
            role: (supaUser.user_metadata?.role as UserRole) || 'Sales Manager',
            avatar: supaUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(supaUser.email || 'User')}&background=0284c7&color=fff`,
            territory: supaUser.user_metadata?.territory || 'North Delhi',
            region: 'North Zone (Delhi-NCR)',
            department: 'Field Sales Operations',
            permissions: ['all', 'read:all', 'write:orders'],
          };
          setUser(userObj);
          setToken(session.access_token);
          localStorage.setItem('fieldassist_user_profile', JSON.stringify(userObj));
          localStorage.setItem('fieldassist_auth_token', session.access_token);
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    } catch {
      // Ignore if offline
    }
  }, []);

  const login = async (credentials: LoginCredentials): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.auth.login(credentials);
      setUser(response.user);
      setToken(response.token);
      localStorage.setItem('fieldassist_user_profile', JSON.stringify(response.user));
      localStorage.setItem('fieldassist_auth_token', response.token);
      return response.user;
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (data: SignUpData): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.auth.signUp(data);
      setUser(response.user);
      setToken(response.token);
      localStorage.setItem('fieldassist_user_profile', JSON.stringify(response.user));
      localStorage.setItem('fieldassist_auth_token', response.token);
      return response.user;
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('fieldassist_user_profile');
      localStorage.removeItem('fieldassist_auth_token');
      setIsLoading(false);
    }
  };

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'System Admin') return true;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.permissions.includes('all')) return true;
    return user.permissions.includes(permission);
  };

  const clearError = () => setError(null);

  const setUserSession = (userObj: User, tokenStr?: string) => {
    const tk = tokenStr || `fieldassist_perm_token_${userObj.id}_${Date.now()}`;
    setUser(userObj);
    setToken(tk);
    localStorage.setItem('fieldassist_user_profile', JSON.stringify(userObj));
    localStorage.setItem('fieldassist_auth_token', tk);
    setIsLoading(false);
  };

  const switchRole = (newRole: UserRole) => {
    if (!user) return;
    const permissions =
      newRole === 'System Admin'
        ? ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps']
        : newRole === 'Sales Manager'
        ? ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics']
        : ['read:own', 'write:visits', 'write:orders', 'punch:attendance'];

    const updatedUser: User = {
      ...user,
      role: newRole,
      permissions,
      department:
        newRole === 'System Admin'
          ? 'Executive Administration'
          : newRole === 'Sales Manager'
          ? 'Regional Sales Management'
          : 'Field Sales Force',
    };

    setUserSession(updatedUser, token || undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        error,
        login,
        signUp,
        logout,
        hasRole,
        hasPermission,
        clearError,
        setUserSession,
        switchRole,
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
