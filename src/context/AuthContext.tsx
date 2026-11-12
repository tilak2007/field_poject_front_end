import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole, LoginCredentials, ChangePasswordData, CreateUserData, AccountStatus } from '../types/auth';
import { api } from '../api';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<User>;
  changePassword: (data: ChangePasswordData) => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  clearError: () => void;
  setUserSession: (user: User, token?: string) => void;
  // Admin-only management capabilities
  adminCreateUser: (data: CreateUserData) => Promise<User>;
  adminToggleStatus: (userId: string, email: string, status: AccountStatus) => Promise<void>;
  adminResetPassword: (userId: string, email: string) => Promise<void>;
  adminDeleteUser: (userId: string, email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state directly from persistent storage
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

  // Synchronize and verify active session with Supabase & serverless backend
  useEffect(() => {
    const syncBackendSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const supaUser = data.session.user;

          // Fetch verified profile from database
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', supaUser.id)
            .maybeSingle();

          // Check if deactivated
          if (profile?.status === 'Deactivated') {
            await logout();
            setError('Your account has been deactivated by the System Administrator.');
            return;
          }

          const role = (profile?.role as UserRole) || (supaUser.user_metadata?.role as UserRole) || 'Sales Representative';
          const mustChangePassword = profile?.must_change_password ?? false;

          const userObj: User = {
            id: supaUser.id,
            name: profile?.full_name || supaUser.user_metadata?.full_name || supaUser.email?.split('@')[0] || 'Field User',
            email: supaUser.email || '',
            role,
            status: profile?.status || 'Active',
            mustChangePassword,
            avatar: profile?.avatar_url || '',
            territory: profile?.territory || 'North Delhi',
            region: profile?.region || 'North Zone (Delhi-NCR)',
            department: profile?.department || (role === 'System Admin' ? 'Executive Administration' : role === 'Sales Manager' ? 'Regional Sales Management' : 'Field Sales Force'),
            permissions: role === 'System Admin' ? ['all'] : role === 'Sales Manager' ? ['read:all', 'write:orders', 'write:retailers'] : ['read:own', 'write:visits', 'write:orders'],
            createdAt: profile?.created_at,
          };

          setUser(userObj);
          setToken(data.session.access_token);
          localStorage.setItem('fieldassist_user_profile', JSON.stringify(userObj));
          localStorage.setItem('fieldassist_auth_token', data.session.access_token);
        }
      } catch {
        // Retain local session
      }
    };

    syncBackendSession();

    // Listen for auth state changes
    try {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setToken(null);
          localStorage.removeItem('fieldassist_user_profile');
          localStorage.removeItem('fieldassist_auth_token');
        } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          const supaUser = session.user;
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', supaUser.id)
            .maybeSingle();

          if (profile?.status === 'Deactivated') {
            await logout();
            setError('Your account has been deactivated by the System Administrator.');
            return;
          }

          const role = (profile?.role as UserRole) || (supaUser.user_metadata?.role as UserRole) || 'Sales Representative';
          const userObj: User = {
            id: supaUser.id,
            name: profile?.full_name || supaUser.user_metadata?.full_name || supaUser.email?.split('@')[0] || 'Field User',
            email: supaUser.email || '',
            role,
            status: profile?.status || 'Active',
            mustChangePassword: profile?.must_change_password ?? false,
            avatar: profile?.avatar_url || '',
            territory: profile?.territory || 'North Delhi',
            region: profile?.region || 'North Zone (Delhi-NCR)',
            department: profile?.department || 'Field Sales Force',
            permissions: role === 'System Admin' ? ['all'] : role === 'Sales Manager' ? ['read:all', 'write:orders'] : ['read:own', 'write:orders'],
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
      if (response.user.status === 'Deactivated') {
        throw new Error('Your account has been deactivated by the System Administrator. Please contact support.');
      }
      setUser(response.user);
      setToken(response.token);
      localStorage.setItem('fieldassist_user_profile', JSON.stringify(response.user));
      localStorage.setItem('fieldassist_auth_token', response.token);
      return response.user;
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please verify your credentials.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (data: ChangePasswordData): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedUser = await api.auth.changePassword(data);
      setUser(updatedUser);
      localStorage.setItem('fieldassist_user_profile', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
      throw err;
    } finally {
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

  // Admin User Management actions
  const adminCreateUser = async (data: CreateUserData): Promise<User> => {
    if (user?.role !== 'System Admin') {
      throw new Error('Unauthorized: Only System Administrators can create new accounts.');
    }
    return await api.adminUsers.createUser(data);
  };

  const adminToggleStatus = async (userId: string, email: string, status: AccountStatus): Promise<void> => {
    if (user?.role !== 'System Admin') {
      throw new Error('Unauthorized: Only System Administrators can activate/deactivate accounts.');
    }
    await api.adminUsers.toggleUserStatus(userId, email, status);
  };

  const adminResetPassword = async (userId: string, email: string): Promise<void> => {
    if (user?.role !== 'System Admin') {
      throw new Error('Unauthorized: Only System Administrators can reset passwords.');
    }
    await api.adminUsers.resetUserPassword(userId, email);
  };

  const adminDeleteUser = async (userId: string, email: string): Promise<void> => {
    if (user?.role !== 'System Admin') {
      throw new Error('Unauthorized: Only System Administrators can delete accounts.');
    }
    await api.adminUsers.deleteUser(userId, email);
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
        changePassword,
        logout,
        hasRole,
        hasPermission,
        clearError,
        setUserSession,
        adminCreateUser,
        adminToggleStatus,
        adminResetPassword,
        adminDeleteUser,
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
