// FieldAssist Serverless Backend: Authentication API
// Enforces Admin-Controlled Authentication & Disables Public Registration
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ibzycpftqmngcrmgpsed.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlienljcGZ0cW1uZ2NybWdwc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODcxMzksImV4cCI6MjEwODU2MzEzOX0.O_FyD60-X_khKoPajDBA1xn_Gu87cmOffoB5wFhfrl8';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-side Supabase client (using service role key if available, else anon key)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// In-memory permanent accounts registry for serverless fallback
export const SYSTEM_ACCOUNTS: Record<string, any> = {
  'vinaymeghu09@gmail.com': {
    id: 'usr-vinay-01',
    name: 'Vinayaka Tilak',
    email: 'vinaymeghu09@gmail.com',
    role: 'System Admin',
    status: 'Active',
    mustChangePassword: false,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    territory: 'National HQ',
    region: 'All India Zones',
    department: 'Executive Administration',
    permissions: ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps'],
    password: 'vinay123',
    createdAt: '2026-01-15T09:00:00Z',
  },
  'admin@fieldassist.io': {
    id: 'usr-admin-01',
    name: 'Rajesh Sharma',
    email: 'admin@fieldassist.io',
    role: 'System Admin',
    status: 'Active',
    mustChangePassword: false,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    territory: 'National HQ',
    region: 'All India Zones',
    department: 'Executive Management',
    permissions: ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps'],
    password: 'admin123',
    createdAt: '2026-01-15T09:00:00Z',
  },
  'manager@fieldassist.io': {
    id: 'usr-mgr-01',
    name: 'Priya Sundaram',
    email: 'manager@fieldassist.io',
    role: 'Sales Manager',
    status: 'Active',
    mustChangePassword: false,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    territory: 'North Delhi',
    region: 'North Zone (Delhi-NCR)',
    department: 'Regional Sales Management',
    permissions: ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics'],
    password: 'manager123',
    createdAt: '2026-02-01T10:00:00Z',
  },
  'tilak2007@gmail.com': {
    id: 'usr-tilak-02',
    name: 'Tilak P.S.',
    email: 'tilak2007@gmail.com',
    role: 'Sales Manager',
    status: 'Active',
    mustChangePassword: false,
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    territory: 'North Delhi',
    region: 'North Zone (Delhi-NCR)',
    department: 'Regional Sales Management',
    permissions: ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics'],
    password: 'tilak123',
    createdAt: '2026-02-10T10:00:00Z',
  },
  'vikram@fieldassist.io': {
    id: 'usr-rep-01',
    name: 'Vikram Sharma',
    email: 'vikram@fieldassist.io',
    role: 'Sales Representative',
    status: 'Active',
    mustChangePassword: false,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    territory: 'North Delhi',
    region: 'North Zone (Delhi-NCR)',
    department: 'Field Sales Force',
    permissions: ['read:own', 'write:visits', 'write:orders', 'punch:attendance'],
    password: 'rep123',
    createdAt: '2026-03-01T11:00:00Z',
  },
};

// Password complexity validator
export function validatePasswordStrength(pwd: string): { valid: boolean; reason?: string } {
  if (!pwd) {
    return { valid: false, reason: 'Password cannot be empty.' };
  }
  if (pwd.trim() === 'role@123') {
    return { valid: false, reason: 'You cannot reuse the temporary initial password "role@123".' };
  }
  if (pwd.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(pwd)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(pwd)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(pwd)) {
    return { valid: false, reason: 'Password must contain at least one number (0-9).' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
    return { valid: false, reason: 'Password must contain at least one special character (!@#$%^&*).' };
  }
  return { valid: true };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { action = 'login', email = '', password = '', currentPassword = '', newPassword = '', confirmPassword = '' } = req.body || {};
  const normEmail = String(email).toLowerCase().trim();

  // 1. PUBLIC SELF-REGISTRATION IS DISABLED BY POLICY
  if (action === 'register') {
    return res.status(403).json({
      success: false,
      message: 'Self-registration is disabled. Only authorized administrators can create new user accounts in FieldAssist.',
    });
  }

  // 2. CHANGE PASSWORD ACTION (MANDATORY FIRST LOGIN OR PROFILE MANAGEMENT)
  if (action === 'change_password') {
    if (!normEmail || !currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, current password, new password, and password confirmation.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.',
      });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return res.status(400).json({
        success: false,
        message: strength.reason,
      });
    }

    // Check against system registry
    const account = SYSTEM_ACCOUNTS[normEmail];
    if (account) {
      if (account.password !== currentPassword && currentPassword !== 'role@123') {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }

      account.password = newPassword;
      account.mustChangePassword = false;

      // Update Supabase user profile if connected
      try {
        await supabase
          .from('user_profiles')
          .update({ must_change_password: false })
          .eq('email', normEmail);
      } catch (err) {
        console.warn('Supabase must_change_password update note:', err);
      }

      const { password: _, ...userWithoutPassword } = account;
      const token = `fa_jwt_${account.id}_${Date.now()}`;

      return res.status(200).json({
        success: true,
        message: 'Password successfully updated.',
        user: userWithoutPassword,
        token,
      });
    }

    // Supabase Auth update if user authenticated with Supabase
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normEmail,
        password: currentPassword,
      });

      if (signInError || !signInData.user) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }

      // Update Supabase password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return res.status(400).json({
          success: false,
          message: updateError.message || 'Failed to update password in Supabase Auth.',
        });
      }

      // Update profile in user_profiles
      await supabase
        .from('user_profiles')
        .update({ must_change_password: false })
        .eq('id', signInData.user.id);

      return res.status(200).json({
        success: true,
        message: 'Password successfully updated.',
        mustChangePassword: false,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Error processing password change request.',
      });
    }
  }

  // 3. LOGIN ACTION
  if (action === 'login') {
    if (!normEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    // Check system registry first
    const account = SYSTEM_ACCOUNTS[normEmail];
    if (account) {
      // Check Deactivated status
      if (account.status === 'Deactivated') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated by the System Administrator. Please contact your administrator for assistance.',
        });
      }

      if (account.password !== password) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Please verify your email and password.',
        });
      }

      const token = `fa_jwt_${account.id}_${Date.now()}`;
      const { password: _, ...userWithoutPassword } = account;

      return res.status(200).json({
        success: true,
        user: userWithoutPassword,
        token,
        expiresIn: 604800,
      });
    }

    // Check Supabase Auth
    try {
      const { data: supaAuth, error: supaErr } = await supabase.auth.signInWithPassword({
        email: normEmail,
        password,
      });

      if (!supaErr && supaAuth.user) {
        const supaUser = supaAuth.user;

        // Fetch user profile from database to verify status and must_change_password
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', supaUser.id)
          .maybeSingle();

        if (profile?.status === 'Deactivated') {
          await supabase.auth.signOut();
          return res.status(403).json({
            success: false,
            message: 'Your account has been deactivated by the System Administrator. Please contact your administrator for assistance.',
          });
        }

        const role = profile?.role || supaUser.user_metadata?.role || 'Sales Representative';
        const mustChangePassword =
          profile?.must_change_password !== undefined
            ? profile.must_change_password
            : password === 'role@123';

        const userObj = {
          id: supaUser.id,
          name: profile?.full_name || supaUser.user_metadata?.full_name || normEmail.split('@')[0],
          email: supaUser.email || normEmail,
          role,
          status: (profile?.status as any) || 'Active',
          mustChangePassword,
          avatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
          territory: profile?.territory || 'North Delhi',
          region: profile?.region || 'North Zone (Delhi-NCR)',
          department: profile?.department || (role === 'System Admin' ? 'Executive Administration' : role === 'Sales Manager' ? 'Regional Sales Management' : 'Field Sales Force'),
          permissions: role === 'System Admin' ? ['all'] : role === 'Sales Manager' ? ['read:all', 'write:orders', 'write:retailers'] : ['read:own', 'write:visits', 'write:orders'],
        };

        return res.status(200).json({
          success: true,
          user: userObj,
          token: supaAuth.session?.access_token || `fa_jwt_${supaUser.id}_${Date.now()}`,
          expiresIn: supaAuth.session?.expires_in || 604800,
        });
      }
    } catch (err) {
      console.warn('Supabase sign-in note:', err);
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid email or password. Unregistered users must be created by a System Administrator.',
    });
  }

  return res.status(400).json({ message: 'Invalid action.' });
}
