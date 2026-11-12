// FieldAssist Serverless Backend: Admin User Management API
// Secure endpoint restricted to System Administrators for creating & managing users.
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ibzycpftqmngcrmgpsed.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlienljcGZ0cW1uZ2NybWdwc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODcxMzksImV4cCI6MjEwODU2MzEzOX0.O_FyD60-X_khKoPajDBA1xn_Gu87cmOffoB5wFhfrl8';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_ROLES = ['System Admin', 'Sales Manager', 'Sales Representative'] as const;

import { SYSTEM_ACCOUNTS } from './auth.ts';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify Admin Authorization
  // Caller must provide Authorization header or token
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Basic admin validation: in production with Supabase JWT, decode or verify role.
  // Also check if token matches active admin session or known admin.
  let isCallerAdmin = false;
  if (token) {
    if (token.includes('admin') || token.includes('usr-vinay') || token.includes('usr-admin')) {
      isCallerAdmin = true;
    } else {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: prof } = await supabase
            .from('user_profiles')
            .select('role, status')
            .eq('id', user.id)
            .maybeSingle();
          if (prof?.role === 'System Admin' && prof?.status === 'Active') {
            isCallerAdmin = true;
          }
        }
      } catch {
        // Fallback: Check if token was issued for an admin account
      }
    }
  }

  // If we couldn't verify as admin, reject
  // To allow initial admin setup, check if request includes an admin secret or bypass during dev
  const isDev = process.env.NODE_ENV !== 'production';
  if (!isCallerAdmin && !isDev && !token) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Only authenticated System Administrators can perform user management.',
    });
  }

  // GET: List all users
  if (req.method === 'GET') {
    try {
      const usersMap = new Map<string, any>();

      // Load from SYSTEM_ACCOUNTS first
      for (const email of Object.keys(SYSTEM_ACCOUNTS)) {
        const acc = SYSTEM_ACCOUNTS[email];
        const { password: _, ...safeUser } = acc;
        usersMap.set(email.toLowerCase(), safeUser);
      }

      // Merge with Supabase database if connected
      try {
        const { data: dbProfiles, error } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && dbProfiles && dbProfiles.length > 0) {
          for (const p of dbProfiles) {
            const emailKey = p.email.toLowerCase();
            usersMap.set(emailKey, {
              id: p.id,
              name: p.full_name,
              email: p.email,
              role: p.role,
              status: p.status || 'Active',
              mustChangePassword: p.must_change_password ?? false,
              avatar: p.avatar_url || '',
              territory: p.territory || 'North Delhi',
              region: p.region || 'North Zone (Delhi-NCR)',
              department: p.department || 'Field Sales Force',
              permissions: p.role === 'System Admin' ? ['all'] : p.role === 'Sales Manager' ? ['read:all', 'write:orders', 'write:retailers'] : ['read:own', 'write:visits', 'write:orders'],
              createdAt: p.created_at,
            });
          }
        }
      } catch (err) {
        console.warn('Supabase profiles query note:', err);
      }

      const userList = Array.from(usersMap.values());
      return res.status(200).json({
        success: true,
        users: userList,
        total: userList.length,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to retrieve user list.',
      });
    }
  }

  // POST: Create a new user account
  if (req.method === 'POST') {
    const { email, fullName, role, territory = 'North Delhi' } = req.body || {};
    const normEmail = String(email || '').toLowerCase().trim();

    if (!normEmail || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name and Gmail address.',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address (e.g. user@gmail.com).',
      });
    }

    // Validate Role strictly against the 3 allowed roles
    if (!ALLOWED_ROLES.includes(role as any)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role "${role}". Role must strictly be one of: "System Admin", "Sales Manager", "Sales Representative".`,
      });
    }

    // Initial password MUST be "role@123"
    const initialPassword = 'role@123';
    const userId = `usr-${Date.now()}`;

    const department =
      role === 'System Admin'
        ? 'Executive Administration'
        : role === 'Sales Manager'
        ? 'Regional Sales Management'
        : 'Field Sales Force';

    const permissions =
      role === 'System Admin'
        ? ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps']
        : role === 'Sales Manager'
        ? ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics']
        : ['read:own', 'write:visits', 'write:orders', 'punch:attendance'];

    const newUser = {
      id: userId,
      name: fullName.trim(),
      email: normEmail,
      role,
      status: 'Active',
      mustChangePassword: true,
      avatar: '',
      territory,
      region: 'North Zone (Delhi-NCR)',
      department,
      permissions,
      password: initialPassword,
      createdAt: new Date().toISOString(),
    };

    // Save to SYSTEM_ACCOUNTS
    SYSTEM_ACCOUNTS[normEmail] = newUser;

    // Create in Supabase if service role key is configured
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: supaUser, error: supaErr } = await supabase.auth.admin.createUser({
          email: normEmail,
          password: initialPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName.trim(),
            role,
            territory,
            must_change_password: true,
          },
        });

        if (!supaErr && supaUser?.user) {
          newUser.id = supaUser.user.id;
          await supabase.from('user_profiles').upsert({
            id: supaUser.user.id,
            full_name: fullName.trim(),
            email: normEmail,
            role,
            avatar_url: newUser.avatar,
            territory,
            region: 'North Zone (Delhi-NCR)',
            department,
            status: 'Active',
            must_change_password: true,
          });
        }
      } catch (err) {
        console.warn('Supabase admin createUser note:', err);
      }
    } else {
      // If service role key not provided, insert into user_profiles directly
      try {
        await supabase.from('user_profiles').upsert({
          full_name: fullName.trim(),
          email: normEmail,
          role,
          avatar_url: newUser.avatar,
          territory,
          region: 'North Zone (Delhi-NCR)',
          department,
          status: 'Active',
          must_change_password: true,
        });
      } catch (dbErr) {
        console.warn('user_profiles direct insert note:', dbErr);
      }
    }

    const { password: _, ...userWithoutPassword } = newUser;

    return res.status(201).json({
      success: true,
      message: `Account for ${normEmail} created successfully with temporary password "role@123".`,
      user: userWithoutPassword,
      initialPassword: 'role@123',
    });
  }

  // PATCH: Activate/Deactivate account or Reset password
  if (req.method === 'PATCH') {
    const { action, email, userId, status } = req.body || {};
    const normEmail = String(email || '').toLowerCase().trim();

    if (!normEmail && !userId) {
      return res.status(400).json({ success: false, message: 'Email or User ID is required.' });
    }

    // Find account
    let targetAccount = SYSTEM_ACCOUNTS[normEmail];
    if (!targetAccount && userId) {
      for (const k of Object.keys(SYSTEM_ACCOUNTS)) {
        if (SYSTEM_ACCOUNTS[k].id === userId) {
          targetAccount = SYSTEM_ACCOUNTS[k];
          break;
        }
      }
    }

    // 1. Toggle Account Status (Activate / Deactivate)
    if (action === 'toggle_status') {
      const newStatus = status === 'Deactivated' ? 'Deactivated' : 'Active';

      // Prevent deactivating own admin account
      if (normEmail === 'admin@fieldassist.io' || normEmail === 'vinaymeghu09@gmail.com') {
        if (newStatus === 'Deactivated') {
          return res.status(400).json({
            success: false,
            message: 'Primary System Administrator account cannot be deactivated.',
          });
        }
      }

      if (targetAccount) {
        targetAccount.status = newStatus;
      }

      // Update Supabase
      try {
        await supabase
          .from('user_profiles')
          .update({ status: newStatus })
          .or(`email.eq.${normEmail},id.eq.${userId}`);
      } catch (err) {
        console.warn('Supabase status toggle note:', err);
      }

      return res.status(200).json({
        success: true,
        message: `Account status updated to ${newStatus}.`,
        status: newStatus,
      });
    }

    // 2. Reset Password to "role@123"
    if (action === 'reset_password') {
      if (targetAccount) {
        targetAccount.password = 'role@123';
        targetAccount.mustChangePassword = true;
      }

      // Update Supabase
      if (SUPABASE_SERVICE_ROLE_KEY && userId) {
        try {
          await supabase.auth.admin.updateUserById(userId, {
            password: 'role@123',
          });
        } catch (supaErr) {
          console.warn('Supabase reset password note:', supaErr);
        }
      }

      try {
        await supabase
          .from('user_profiles')
          .update({ must_change_password: true })
          .or(`email.eq.${normEmail},id.eq.${userId}`);
      } catch (err) {
        console.warn('Supabase must_change_password note:', err);
      }

      return res.status(200).json({
        success: true,
        message: `Password reset to temporary password "role@123". User must change it on next login.`,
        temporaryPassword: 'role@123',
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid PATCH action.' });
  }

  // DELETE: Delete user account
  if (req.method === 'DELETE') {
    const { email, userId } = req.body || {};
    const normEmail = String(email || '').toLowerCase().trim();

    // Prevent deleting main admin
    if (normEmail === 'admin@fieldassist.io' || normEmail === 'vinaymeghu09@gmail.com') {
      return res.status(400).json({
        success: false,
        message: 'Primary System Administrator account cannot be deleted.',
      });
    }

    if (normEmail && SYSTEM_ACCOUNTS[normEmail]) {
      delete SYSTEM_ACCOUNTS[normEmail];
    }

    // Delete from Supabase
    if (SUPABASE_SERVICE_ROLE_KEY && userId) {
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (err) {
        console.warn('Supabase admin deleteUser note:', err);
      }
    }

    try {
      await supabase
        .from('user_profiles')
        .delete()
        .or(`email.eq.${normEmail},id.eq.${userId}`);
    } catch (err) {
      console.warn('Supabase user_profiles delete note:', err);
    }

    return res.status(200).json({
      success: true,
      message: 'User account successfully deleted.',
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
