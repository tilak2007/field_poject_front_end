import type { User, AuthResponse, LoginCredentials, ChangePasswordData } from '../types/auth';
import { supabase } from '../lib/supabase';
import { setAuthToken, removeAuthToken, simulateNetworkDelay, apiFetch } from './client';

export const PERMANENT_ACCOUNTS: Record<string, { user: User; password: string }> = {
  'vinaymeghu09@gmail.com': {
    user: {
      id: 'usr-vinay-01',
      name: 'Vinayaka Tilak',
      email: 'vinaymeghu09@gmail.com',
      role: 'System Admin',
      status: 'Active',
      mustChangePassword: false,
      avatar: '',
      territory: 'National HQ',
      region: 'All India Zones',
      phone: '+91 98110 00001',
      department: 'Executive Administration',
      permissions: ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps'],
      createdAt: '2026-01-15T09:00:00Z',
    },
    password: 'vinay123',
  },
  'tilak2007@gmail.com': {
    user: {
      id: 'usr-tilak-02',
      name: 'Tilak P.S.',
      email: 'tilak2007@gmail.com',
      role: 'Sales Manager',
      status: 'Active',
      mustChangePassword: false,
      avatar: '',
      territory: 'Bengaluru South',
      region: 'South Zone (Bengaluru)',
      phone: '+91 98110 00002',
      department: 'Regional Sales Management',
      permissions: ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics'],
      createdAt: '2026-02-10T10:00:00Z',
    },
    password: 'tilak123',
  },
  'admin@fieldassist.io': {
    user: {
      id: 'usr-admin-01',
      name: 'Rajesh Sharma',
      email: 'admin@fieldassist.io',
      role: 'System Admin',
      status: 'Active',
      mustChangePassword: false,
      avatar: '',
      territory: 'National HQ',
      region: 'All India Zones',
      phone: '+91 98110 00100',
      department: 'Executive Management',
      permissions: ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps'],
      createdAt: '2026-01-15T09:00:00Z',
    },
    password: 'admin123',
  },
  'manager@fieldassist.io': {
    user: {
      id: 'usr-mgr-01',
      name: 'Priya Sundaram',
      email: 'manager@fieldassist.io',
      role: 'Sales Manager',
      status: 'Active',
      mustChangePassword: false,
      avatar: '',
      territory: 'Bengaluru South',
      region: 'South Zone (Bengaluru)',
      phone: '+91 98110 00200',
      department: 'Regional Sales Management',
      permissions: ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics'],
      createdAt: '2026-02-01T10:00:00Z',
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
      status: 'Active',
      mustChangePassword: false,
      avatar: '',
      territory: 'Bengaluru South',
      region: 'South Zone (Bengaluru)',
      phone: '+91 98220 11223',
      department: 'Field Sales Force',
      permissions: ['read:own', 'write:visits', 'write:orders', 'punch:attendance'],
      createdAt: '2026-03-01T11:00:00Z',
    },
    password: 'rep123',
  },
};

// Password complexity validator
export function checkPasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number (0-9).' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&*).' };
  }
  if (password === 'role@123') {
    return { isValid: false, message: 'Cannot reuse temporary initial password "role@123".' };
  }
  return { isValid: true };
}

// Retrieve permanent accounts database from persistent local storage
export function getAccountsRegistry(): Record<string, { user: User; password: string }> {
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
export function saveAccountToRegistry(email: string, user: User, password: string): void {
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
   * Authenticate credentials against Serverless backend and Supabase Auth
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const email = credentials.email.toLowerCase().trim();
    const password = credentials.password || '';

    if (!email || !password) {
      throw { message: 'Please enter both your Gmail address and password.', status: 400 };
    }

    // 1. Try Serverless Backend (/api/auth)
    try {
      const res = await apiFetch<{ success: boolean; user: User; token: string; expiresIn: number }>('/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, password }),
      });
      if (res && res.success && res.user && res.token) {
        if (res.user.status === 'Deactivated') {
          throw {
            message: 'Your account has been deactivated by the System Administrator. Please contact your administrator for assistance.',
            status: 403,
          };
        }
        setAuthToken(res.token);
        localStorage.setItem('fieldassist_user_profile', JSON.stringify(res.user));
        localStorage.setItem('fieldassist_auth_token', res.token);
        saveAccountToRegistry(email, res.user, password);
        return { user: res.user, token: res.token, expiresIn: res.expiresIn || 604800 };
      }
    } catch (err: any) {
      if (err?.status === 403 || err?.status === 401) {
        throw err;
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

        if (profile?.status === 'Deactivated') {
          await supabase.auth.signOut();
          throw {
            message: 'Your account has been deactivated by the System Administrator. Please contact your administrator for assistance.',
            status: 403,
          };
        }

        const role = profile?.role || supaUser.user_metadata?.role || (email.includes('admin') ? 'System Admin' : 'Sales Representative');
        const mustChangePassword =
          profile?.must_change_password !== undefined
            ? profile.must_change_password
            : password === 'role@123';

        const userObj: User = {
          id: supaUser.id,
          name: profile?.full_name || supaUser.user_metadata?.full_name || email.split('@')[0],
          email: supaUser.email || email,
          role,
          status: profile?.status || 'Active',
          mustChangePassword,
          avatar: profile?.avatar_url || '',
          territory: profile?.territory || 'Bengaluru South',
          region: profile?.region || 'South Zone (Bengaluru)',
          department: profile?.department || (role === 'System Admin' ? 'Executive Administration' : role === 'Sales Manager' ? 'Regional Sales Management' : 'Field Sales Force'),
          permissions: role === 'System Admin' ? ['all'] : role === 'Sales Manager' ? ['read:all', 'write:orders', 'write:retailers'] : ['read:own', 'write:visits', 'write:orders'],
          createdAt: profile?.created_at || new Date().toISOString(),
        };

        setAuthToken(token);
        localStorage.setItem('fieldassist_user_profile', JSON.stringify(userObj));
        localStorage.setItem('fieldassist_auth_token', token);
        saveAccountToRegistry(email, userObj, password);
        return { user: userObj, token, expiresIn: data.session.expires_in };
      }
    } catch (supaErr: any) {
      if (supaErr?.status === 403) throw supaErr;
    }

    // 3. Validate against permanent accounts registry
    await simulateNetworkDelay(100);
    const registry = getAccountsRegistry();
    const account = registry[email];

    if (!account) {
      throw {
        message: `No account registered with ${email}. Accounts must be created by a System Administrator.`,
        status: 404,
      };
    }

    if (account.user.status === 'Deactivated') {
      throw {
        message: 'Your account has been deactivated by the System Administrator. Please contact your administrator for assistance.',
        status: 403,
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
   * Mandatory First Login or Self-Service Password Change
   */
  async changePassword(data: ChangePasswordData): Promise<User> {
    const { currentPassword, newPassword, confirmPassword } = data;

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw { message: 'All password fields are required.', status: 400 };
    }

    if (newPassword !== confirmPassword) {
      throw { message: 'New password and confirmation do not match.', status: 400 };
    }

    const strength = checkPasswordStrength(newPassword);
    if (!strength.isValid) {
      throw { message: strength.message || 'Password does not meet complexity requirements.', status: 400 };
    }

    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      throw { message: 'You must be logged in to change your password.', status: 401 };
    }

    const email = currentUser.email.toLowerCase().trim();

    // 1. Try Serverless Backend
    try {
      const res = await apiFetch<{ success: boolean; user?: User; message?: string }>('/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'change_password',
          email,
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      if (res && res.success) {
        const updatedUser: User = {
          ...currentUser,
          mustChangePassword: false,
        };
        localStorage.setItem('fieldassist_user_profile', JSON.stringify(updatedUser));
        saveAccountToRegistry(email, updatedUser, newPassword);
        return updatedUser;
      }
    } catch (backendErr: any) {
      if (backendErr?.status === 400 || backendErr?.status === 401) {
        throw backendErr;
      }
      console.warn('Backend password change notice:', backendErr);
    }

    // 2. Try Supabase Auth password update
    try {
      const { error: supaErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (!supaErr) {
        try {
          await supabase
            .from('user_profiles')
            .update({ must_change_password: false })
            .eq('id', currentUser.id);
        } catch {}
      }
    } catch {}

    // 3. Update local accounts registry
    const registry = getAccountsRegistry();
    const account = registry[email];
    if (account) {
      if (account.password !== currentPassword && currentPassword !== 'role@123') {
        throw { message: 'Current password is incorrect.', status: 401 };
      }
    }

    const updatedUser: User = {
      ...currentUser,
      mustChangePassword: false,
    };

    saveAccountToRegistry(email, updatedUser, newPassword);
    localStorage.setItem('fieldassist_user_profile', JSON.stringify(updatedUser));

    return updatedUser;
  },

  /**
   * Public Sign-up is disabled. Throws error.
   */
  async signUp(_data: any): Promise<AuthResponse> {
    throw {
      message: 'Public self-registration is disabled. Only authorized administrators can create new user accounts in FieldAssist.',
      status: 403,
    };
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
