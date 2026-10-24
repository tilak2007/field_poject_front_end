import type { User, AuthResponse, LoginCredentials, SignUpData, UserRole } from '../types/auth';
import { supabase } from '../lib/supabase';
import { setAuthToken, removeAuthToken, simulateNetworkDelay, apiFetch } from './client';

export const PERMANENT_ACCOUNTS: Record<string, { user: User; password: string }> = {
  'vinaymeghu09@gmail.com': {
    user: {
      id: 'usr-vinay-01',
      name: 'Vinayaka Tilak',
      email: 'vinaymeghu09@gmail.com',
      role: 'System Admin',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      territory: 'National HQ',
      region: 'All India Zones',
      phone: '+91 98110 00001',
      department: 'Executive Administration',
      permissions: ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps'],
    },
    password: 'vinay123',
  },
  'tilak2007@gmail.com': {
    user: {
      id: 'usr-tilak-02',
      name: 'Tilak P.S.',
      email: 'tilak2007@gmail.com',
      role: 'Sales Manager',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
      territory: 'North Delhi',
      region: 'North Zone (Delhi-NCR)',
      phone: '+91 98110 00002',
      department: 'Regional Sales Management',
      permissions: ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics'],
    },
    password: 'tilak123',
  },
  'admin@fieldassist.io': {
    user: {
      id: 'usr-admin-01',
      name: 'Rajesh Sharma',
      email: 'admin@fieldassist.io',
      role: 'System Admin',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      territory: 'National HQ',
      region: 'All India Zones',
      phone: '+91 98110 00100',
      department: 'Executive Management',
      permissions: ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps'],
    },
    password: 'admin123',
  },
  'manager@fieldassist.io': {
    user: {
      id: 'usr-mgr-01',
      name: 'Priya Sundaram',
      email: 'manager@fieldassist.io',
      role: 'Sales Manager',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      territory: 'North Delhi',
      region: 'North Zone (Delhi-NCR)',
      phone: '+91 98110 00200',
      department: 'Regional Sales Management',
      permissions: ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics'],
    },
    password: 'manager123',
  },
  'vikram@fieldassist.io': {
    user: {
      id: 'usr-rep-01',
      repId: 'rep-01',
      name: 'Vikram Sharma',
      email: 'vikram@fieldassist.io',
      role: 'Sales Representative',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      territory: 'North Delhi',
      region: 'North Zone (Delhi-NCR)',
      phone: '+91 98220 11223',
      department: 'Field Sales Force',
      permissions: ['read:own', 'write:visits', 'write:orders', 'punch:attendance'],
    },
    password: 'rep123',
  },
};

// Retrieve permanent accounts database from persistent local storage
function getAccountsRegistry(): Record<string, { user: User; password: string }> {
  try {
    const stored = localStorage.getItem('fieldassist_accounts_registry');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...PERMANENT_ACCOUNTS, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return { ...PERMANENT_ACCOUNTS };
}

// Save account into permanent registry
function saveAccountToRegistry(email: string, user: User, password: string): void {
  try {
    const current = getAccountsRegistry();
    current[email.toLowerCase().trim()] = { user, password };
    localStorage.setItem('fieldassist_accounts_registry', JSON.stringify(current));
  } catch (err) {
    console.warn('Error saving to accounts registry:', err);
  }
}

export const authApi = {
  /**
   * Authenticate permanent credentials against registry and Serverless backend
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const email = credentials.email.toLowerCase().trim();
    const password = credentials.password || '';

    if (!email || !password) {
      throw { message: 'Please enter both your email and password.', status: 400 };
    }

    // 1. Try Serverless Backend (/api/auth)
    try {
      const res = await apiFetch<{ success: boolean; user: User; token: string; expiresIn: number }>('/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, password }),
      });
      if (res && res.success && res.user && res.token) {
        setAuthToken(res.token);
        localStorage.setItem('fieldassist_user_profile', JSON.stringify(res.user));
        localStorage.setItem('fieldassist_auth_token', res.token);
        saveAccountToRegistry(email, res.user, password);
        return { user: res.user, token: res.token, expiresIn: res.expiresIn || 604800 };
      }
    } catch (err: any) {
      // If server returned 401 or invalid password, honor the message
      if (err?.status === 401) {
        throw { message: err.message || 'Invalid password. Please enter the correct password for this account.', status: 401 };
      }
      console.warn('Backend /api/auth notice, trying fallback auth:', err);
    }

    // 2. Try Supabase Auth if online
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.session && data.user) {
        const supaUser = data.user;
        const token = data.session.access_token;
        setAuthToken(token);

        let profile: any = null;
        try {
          const { data: profData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', supaUser.id)
            .maybeSingle();
          profile = profData;
        } catch {
          // Ignore
        }

        const role: UserRole =
          (profile?.role as UserRole) || supaUser.user_metadata?.role || (email.includes('admin') ? 'System Admin' : 'Sales Manager');

        const userObj: User = {
          id: supaUser.id,
          name: profile?.full_name || supaUser.user_metadata?.full_name || email.split('@')[0],
          email: supaUser.email || email,
          role,
          avatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
          territory: profile?.territory || 'North Delhi',
          region: profile?.region || 'North Zone (Delhi-NCR)',
          department: profile?.department || 'Field Force Operations',
          permissions: role === 'System Admin' ? ['all'] : ['read:all', 'write:orders'],
        };

        localStorage.setItem('fieldassist_user_profile', JSON.stringify(userObj));
        localStorage.setItem('fieldassist_auth_token', token);
        saveAccountToRegistry(email, userObj, password);
        return { user: userObj, token, expiresIn: data.session.expires_in };
      }
    } catch {
      // Continue to local permanent registry check
    }

    // 3. Validate against permanent accounts registry
    await simulateNetworkDelay(100);
    const registry = getAccountsRegistry();
    const account = registry[email];

    if (!account) {
      throw {
        message: `No account registered with ${email}. Please check your email or click "Sign up" to create a permanent account.`,
        status: 404,
      };
    }

    if (password !== account.password) {
      throw {
        message: 'Invalid password. Please enter the correct password for this account.',
        status: 401,
      };
    }

    // Permanent session token
    const token = `fieldassist_perm_token_${account.user.id}_${Date.now()}`;
    setAuthToken(token);
    localStorage.setItem('fieldassist_user_profile', JSON.stringify(account.user));
    localStorage.setItem('fieldassist_auth_token', token);

    return { user: account.user, token, expiresIn: 31536000 };
  },

  /**
   * Register a new permanent user account
   */
  async signUp(data: SignUpData): Promise<AuthResponse> {
    const email = data.email.toLowerCase().trim();
    const password = data.password;

    if (!email || !password || !data.fullName) {
      throw { message: 'Please fill in your name, work email, and password.', status: 400 };
    }

    if (password.length < 6) {
      throw { message: 'Password must be at least 6 characters long.', status: 400 };
    }

    // 1. Try Serverless Backend (/api/auth)
    try {
      const res = await apiFetch<{ success: boolean; user: User; token: string; expiresIn: number }>('/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'register',
          email,
          password,
          fullName: data.fullName,
          role: data.role,
          territory: data.territory,
        }),
      });
      if (res && res.success && res.user && res.token) {
        setAuthToken(res.token);
        localStorage.setItem('fieldassist_user_profile', JSON.stringify(res.user));
        localStorage.setItem('fieldassist_auth_token', res.token);
        saveAccountToRegistry(email, res.user, password);
        return { user: res.user, token: res.token, expiresIn: res.expiresIn || 604800 };
      }
    } catch (err) {
      console.warn('Backend /api/auth register notice, falling back:', err);
    }

    // Check if account already exists in registry
    const registry = getAccountsRegistry();
    if (registry[email]) {
      throw {
        message: `An account with ${email} is already registered. Please log in with your password.`,
        status: 409,
      };
    }

    // Create user object
    const newUser: User = {
      id: `usr-perm-${Date.now()}`,
      name: data.fullName.trim(),
      email,
      role: data.role,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName)}&background=0284c7&color=fff`,
      territory: data.territory || 'North Delhi',
      region: 'North Zone (Delhi-NCR)',
      department: data.role === 'Sales Representative' ? 'Field Sales Force' : 'Field Sales Operations',
      permissions: data.role === 'System Admin' ? ['all'] : ['read:all', 'write:orders'],
    };

    // Attempt Supabase sign up in background if online
    try {
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: data.fullName,
            role: data.role,
            territory: data.territory || 'North Delhi',
          },
        },
      });
    } catch {
      // Continue with permanent local registration
    }

    // Save into permanent registry
    saveAccountToRegistry(email, newUser, password);

    // Save permanent active session
    const token = `fieldassist_perm_token_${newUser.id}_${Date.now()}`;
    setAuthToken(token);
    localStorage.setItem('fieldassist_user_profile', JSON.stringify(newUser));
    localStorage.setItem('fieldassist_auth_token', token);

    return { user: newUser, token, expiresIn: 31536000 };
  },

  /**
   * Fetch current authenticated user from permanent session
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const stored = localStorage.getItem('fieldassist_user_profile');
      if (stored) {
        return JSON.parse(stored) as User;
      }
    } catch {
      // Ignore
    }
    return null;
  },

  /**
   * Log out and terminate permanent session
   */
  async logout(): Promise<void> {
    removeAuthToken();
    localStorage.removeItem('fieldassist_user_profile');
    localStorage.removeItem('fieldassist_auth_token');
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
  },
};
