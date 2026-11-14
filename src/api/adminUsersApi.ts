import type { User, CreateUserData, AccountStatus } from '../types/auth';
import { supabase } from '../lib/supabase';
import { apiFetch, simulateNetworkDelay } from './client';
import { getAccountsRegistry, saveAccountToRegistry } from './authApi';

export const adminUsersApi = {
  /**
   * Retrieve all registered users in FieldAssist
   */
  async listUsers(): Promise<User[]> {
    // 1. Try serverless backend
    try {
      const res = await apiFetch<{ success: boolean; users: User[] }>('/admin-users', {
        method: 'GET',
      });
      if (res && res.success && Array.isArray(res.users)) {
        return res.users;
      }
    } catch (err) {
      console.warn('Backend /api/admin-users notice:', err);
    }

    // 2. Try Supabase user_profiles table
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((p) => ({
          id: p.id,
          name: p.full_name,
          email: p.email,
          role: p.role,
          status: p.status || 'Active',
          mustChangePassword: p.must_change_password ?? false,
          avatar: p.avatar_url || '',
          territory: p.territory || 'Bengaluru South',
          region: p.region || 'South Zone (Bengaluru)',
          department: p.department || 'Field Sales Force',
          permissions: p.role === 'System Admin' ? ['all'] : p.role === 'Sales Manager' ? ['read:all', 'write:orders', 'write:retailers'] : ['read:own', 'write:visits', 'write:orders'],
          createdAt: p.created_at,
        }));
      }
    } catch (supaErr) {
      console.warn('Supabase user_profiles list notice:', supaErr);
    }

    // 3. Fallback to local accounts registry
    await simulateNetworkDelay(50);
    const registry = getAccountsRegistry();
    return Object.values(registry).map((acc) => acc.user);
  },

  /**
   * Create a new user account with temporary password "role@123"
   */
  async createUser(data: CreateUserData): Promise<User> {
    const email = data.email.toLowerCase().trim();
    const fullName = data.fullName.trim();
    const role = data.role;
    const territory = data.territory || 'Bengaluru South';

    if (!email || !fullName) {
      throw { message: 'Full name and Gmail address are required.', status: 400 };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw { message: 'Please enter a valid email address (e.g. user@gmail.com).', status: 400 };
    }

    // Ensure role is strictly one of the 3 existing roles
    const validRoles = ['System Admin', 'Sales Manager', 'Sales Representative'];
    if (!validRoles.includes(role)) {
      throw { message: 'Invalid role. Must be System Admin, Sales Manager, or Sales Representative.', status: 400 };
    }

    // 1. Try serverless backend
    try {
      const res = await apiFetch<{ success: boolean; user: User; message: string }>('/admin-users', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, role, territory }),
      });
      if (res && res.success && res.user) {
        saveAccountToRegistry(email, res.user, 'role@123');
        return res.user;
      }
    } catch (backendErr: any) {
      if (backendErr?.status === 400 || backendErr?.status === 403) {
        throw backendErr;
      }
      console.warn('Backend admin create user notice:', backendErr);
    }

    // 2. Check if already exists in registry
    const registry = getAccountsRegistry();
    if (registry[email]) {
      throw { message: `An account with ${email} already exists.`, status: 409 };
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: fullName,
      email,
      role,
      status: 'Active',
      mustChangePassword: true,
      avatar: '',
      territory,
      region: 'South Zone (Bengaluru)',
      department:
        role === 'System Admin'
          ? 'Executive Administration'
          : role === 'Sales Manager'
          ? 'Regional Sales Management'
          : 'Field Sales Force',
      permissions:
        role === 'System Admin'
          ? ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps']
          : role === 'Sales Manager'
          ? ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics']
          : ['read:own', 'write:visits', 'write:orders', 'punch:attendance'],
      createdAt: new Date().toISOString(),
    };

    // Attempt Supabase insert if available
    try {
      await supabase.from('user_profiles').upsert({
        full_name: fullName,
        email,
        role,
        avatar_url: newUser.avatar,
        territory,
        status: 'Active',
        must_change_password: true,
      });
    } catch (err) {
      console.warn('Direct Supabase profile upsert note:', err);
    }

    // Save into permanent registry with temporary password "role@123"
    saveAccountToRegistry(email, newUser, 'role@123');
    return newUser;
  },

  /**
   * Activate or Deactivate an account
   */
  async toggleUserStatus(userId: string, email: string, newStatus: AccountStatus): Promise<void> {
    const normEmail = email.toLowerCase().trim();

    // 1. Try serverless backend
    try {
      await apiFetch('/admin-users', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'toggle_status', userId, email: normEmail, status: newStatus }),
      });
    } catch (backendErr: any) {
      if (backendErr?.status === 400 || backendErr?.status === 403) {
        throw backendErr;
      }
      console.warn('Backend toggle status note:', backendErr);
    }

    // 2. Try Supabase
    try {
      await supabase
        .from('user_profiles')
        .update({ status: newStatus })
        .eq('email', normEmail);
    } catch {}

    // 3. Update local registry
    const registry = getAccountsRegistry();
    if (registry[normEmail]) {
      registry[normEmail].user.status = newStatus;
      localStorage.setItem('fieldassist_accounts_registry', JSON.stringify(registry));
    }
  },

  /**
   * Reset user password back to temporary password "role@123"
   */
  async resetUserPassword(userId: string, email: string): Promise<void> {
    const normEmail = email.toLowerCase().trim();

    // 1. Try serverless backend
    try {
      await apiFetch('/admin-users', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reset_password', userId, email: normEmail }),
      });
    } catch (backendErr: any) {
      if (backendErr?.status === 400 || backendErr?.status === 403) {
        throw backendErr;
      }
      console.warn('Backend reset password note:', backendErr);
    }

    // 2. Try Supabase
    try {
      await supabase
        .from('user_profiles')
        .update({ must_change_password: true })
        .eq('email', normEmail);
    } catch {}

    // 3. Update local registry
    const registry = getAccountsRegistry();
    if (registry[normEmail]) {
      registry[normEmail].password = 'role@123';
      registry[normEmail].user.mustChangePassword = true;
      localStorage.setItem('fieldassist_accounts_registry', JSON.stringify(registry));
    }
  },

  /**
   * Delete a user account
   */
  async deleteUser(userId: string, email: string): Promise<void> {
    const normEmail = email.toLowerCase().trim();

    // 1. Try serverless backend
    try {
      await apiFetch('/admin-users', {
        method: 'DELETE',
        body: JSON.stringify({ userId, email: normEmail }),
      });
    } catch (backendErr: any) {
      if (backendErr?.status === 400 || backendErr?.status === 403) {
        throw backendErr;
      }
      console.warn('Backend delete user note:', backendErr);
    }

    // 2. Try Supabase
    try {
      await supabase
        .from('user_profiles')
        .delete()
        .eq('email', normEmail);
    } catch {}

    // 3. Remove from local registry
    const registry = getAccountsRegistry();
    if (registry[normEmail]) {
      delete registry[normEmail];
      localStorage.setItem('fieldassist_accounts_registry', JSON.stringify(registry));
    }
  },
};
