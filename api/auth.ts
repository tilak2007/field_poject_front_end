// FieldAssist Serverless Backend: Authentication API
const PERMANENT_ACCOUNTS: Record<string, any> = {
  'admin@fieldassist.io': {
    id: 'usr-admin-01',
    name: 'Rajesh Sharma',
    email: 'admin@fieldassist.io',
    role: 'System Admin',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    territory: 'National HQ',
    region: 'All India Zones',
    department: 'Executive Management',
    permissions: ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps'],
    password: 'admin123',
  },
  'manager@fieldassist.io': {
    id: 'usr-mgr-01',
    name: 'Priya Sundaram',
    email: 'manager@fieldassist.io',
    role: 'Sales Manager',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    territory: 'North Delhi',
    region: 'North Zone (Delhi-NCR)',
    department: 'Regional Sales Management',
    permissions: ['read:all', 'write:orders', 'write:retailers', 'manage:targets', 'manage:reps', 'view:analytics'],
    password: 'manager123',
  },
  'vikram@fieldassist.io': {
    id: 'usr-rep-01',
    name: 'Vikram Sharma',
    email: 'vikram@fieldassist.io',
    role: 'Sales Representative',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    territory: 'North Delhi',
    region: 'North Zone (Delhi-NCR)',
    department: 'Field Sales Force',
    permissions: ['read:own', 'write:visits', 'write:orders', 'punch:attendance'],
    password: 'rep123',
  },
  'vinaymeghu09@gmail.com': {
    id: 'usr-vinay-01',
    name: 'Vinayaka Tilak',
    email: 'vinaymeghu09@gmail.com',
    role: 'System Admin',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    territory: 'National HQ',
    region: 'All India Zones',
    department: 'Executive Administration',
    permissions: ['all', 'read:all', 'write:all', 'delete:all', 'admin:system', 'manage:targets', 'manage:reps'],
    password: 'vinay123',
  },
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST: Sign In or Sign Up
  if (req.method === 'POST') {
    const { action = 'login', email = '', password = '', fullName, role = 'Sales Representative', territory = 'North Delhi' } = req.body || {};
    const normEmail = String(email).toLowerCase().trim();

    if (action === 'register') {
      const newUser = {
        id: `usr-${Date.now()}`,
        name: fullName || normEmail.split('@')[0],
        email: normEmail,
        role,
        avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
        territory,
        region: 'North Zone (Delhi-NCR)',
        department: role === 'System Admin' ? 'Executive Administration' : role === 'Sales Manager' ? 'Regional Sales Management' : 'Field Sales Force',
        permissions: role === 'System Admin' ? ['all'] : role === 'Sales Manager' ? ['read:all', 'write:orders', 'write:retailers'] : ['read:own', 'write:visits', 'write:orders'],
        password: password || 'default123',
      };

      PERMANENT_ACCOUNTS[normEmail] = newUser;
      const token = `fa_jwt_${newUser.id}_${Date.now()}`;
      return res.status(201).json({
        success: true,
        user: newUser,
        token,
        expiresIn: 604800,
      });
    }

    // Login check
    const account = PERMANENT_ACCOUNTS[normEmail];
    if (account && (!password || account.password === password || password.length >= 6)) {
      const token = `fa_jwt_${account.id}_${Date.now()}`;
      const { password: _, ...userWithoutPassword } = account;
      return res.status(200).json({
        success: true,
        user: userWithoutPassword,
        token,
        expiresIn: 604800,
      });
    }

    // Flexible fallback for any domain login
    if (normEmail && password.length >= 6) {
      const fallbackRole = normEmail.includes('admin') ? 'System Admin' : normEmail.includes('manager') ? 'Sales Manager' : 'Sales Representative';
      const fallbackUser = {
        id: `usr-${Date.now()}`,
        name: normEmail.split('@')[0].toUpperCase(),
        email: normEmail,
        role: fallbackRole,
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
        territory: 'North Delhi',
        region: 'North Zone (Delhi-NCR)',
        department: fallbackRole === 'System Admin' ? 'Executive Management' : 'Field Operations',
        permissions: fallbackRole === 'System Admin' ? ['all'] : ['read:all', 'write:orders'],
      };

      const token = `fa_jwt_${fallbackUser.id}_${Date.now()}`;
      return res.status(200).json({
        success: true,
        user: fallbackUser,
        token,
        expiresIn: 604800,
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid email or password. Minimum 6 characters required.',
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
