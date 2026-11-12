import React from 'react';
import { User as UserIcon } from 'lucide-react';

interface UserAvatarProps {
  name?: string;
  email?: string;
  role?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  email,
  role,
  size = 'md',
  className = '',
}) => {
  const getInitials = (n?: string, e?: string): string => {
    if (n && n.trim()) {
      const parts = n.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (e && e.includes('@')) {
      return e.split('@')[0].slice(0, 2).toUpperCase();
    }
    return 'FA';
  };

  const initials = getInitials(name, email);

  // Enterprise Role Colors: System Admin (Purple), Sales Manager (Blue), Sales Rep (Emerald)
  const roleGradients =
    role === 'System Admin'
      ? 'from-purple-600 via-indigo-600 to-indigo-700 text-purple-50 border-purple-400/40 ring-purple-500/20'
      : role === 'Sales Manager'
      ? 'from-blue-600 via-sky-600 to-cyan-700 text-blue-50 border-blue-400/40 ring-blue-500/20'
      : 'from-emerald-600 via-teal-600 to-emerald-700 text-emerald-50 border-emerald-400/40 ring-emerald-500/20';

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-xs font-bold',
    md: 'w-9 h-9 rounded-xl text-xs font-bold',
    lg: 'w-12 h-12 rounded-2xl text-base font-extrabold',
    xl: 'w-24 h-24 rounded-3xl text-3xl font-black tracking-wider',
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none bg-gradient-to-tr border shadow-md ring-2 shrink-0 ${roleGradients} ${sizeClasses} ${className}`}
      title={name || email || 'User Avatar'}
    >
      {initials ? initials : <UserIcon className="w-1/2 h-1/2 text-white/80" />}
    </div>
  );
};

export default UserAvatar;
