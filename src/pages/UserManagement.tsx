import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import type { User, UserRole, AccountStatus } from '../types/auth';
import {
  Users,
  UserPlus,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
  X,
  Mail,
  Briefcase,
  MapPin,
  ShieldAlert,
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { user: currentAdmin, adminCreateUser, adminToggleStatus, adminResetPassword, adminDeleteUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Create User Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('Sales Representative');
  const [newTerritory, setNewTerritory] = useState<string>('North Delhi');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Confirmation Modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const list = await api.adminUsers.listUsers();
      setUsers(list);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch user list.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const cleanEmail = newEmail.toLowerCase().trim();
    if (!cleanEmail.includes('@')) {
      setCreateError('Please enter a valid Gmail address.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await adminCreateUser({
        fullName: newFullName.trim(),
        email: cleanEmail,
        role: newRole,
        territory: newTerritory,
      });

      setShowCreateModal(false);
      setNewFullName('');
      setNewEmail('');
      setNewRole('Sales Representative');
      setNewTerritory('North Delhi');

      showToast(`User ${created.name} created successfully with temporary password "role@123"!`);
      loadUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user account.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = (targetUser: User) => {
    const nextStatus: AccountStatus = targetUser.status === 'Active' ? 'Deactivated' : 'Active';
    const actionLabel = nextStatus === 'Deactivated' ? 'Deactivate' : 'Activate';

    setConfirmDialog({
      isOpen: true,
      title: `${actionLabel} Account: ${targetUser.name}`,
      message:
        nextStatus === 'Deactivated'
          ? `Are you sure you want to deactivate ${targetUser.email}? The user will be immediately blocked from signing in or performing any actions.`
          : `Activate ${targetUser.email}? The user will regain access to FieldAssist.`,
      action: async () => {
        try {
          await adminToggleStatus(targetUser.id, targetUser.email, nextStatus);
          showToast(`Account for ${targetUser.email} has been ${nextStatus.toLowerCase()}.`);
          loadUsers();
        } catch (err: any) {
          showToast(err.message || 'Action failed.', 'error');
        }
      },
    });
  };

  const handleResetPassword = (targetUser: User) => {
    setConfirmDialog({
      isOpen: true,
      title: `Reset Password: ${targetUser.name}`,
      message: `Reset password for ${targetUser.email} to temporary password "role@123"? The user will be required to choose a new password upon their next login.`,
      action: async () => {
        try {
          await adminResetPassword(targetUser.id, targetUser.email);
          showToast(`Password for ${targetUser.email} reset to "role@123" with mandatory change on login.`);
          loadUsers();
        } catch (err: any) {
          showToast(err.message || 'Password reset failed.', 'error');
        }
      },
    });
  };

  const handleDeleteUser = (targetUser: User) => {
    if (targetUser.email === currentAdmin?.email) {
      showToast('You cannot delete your own active administrator account.', 'error');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: `Permanently Delete Account: ${targetUser.name}`,
      message: `Are you sure you want to permanently delete ${targetUser.email}? This action removes all authentication credentials and profile records and cannot be undone.`,
      action: async () => {
        try {
          await adminDeleteUser(targetUser.id, targetUser.email);
          showToast(`Account for ${targetUser.email} permanently deleted.`);
          loadUsers();
        } catch (err: any) {
          showToast(err.message || 'Failed to delete user.', 'error');
        }
      },
    });
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.territory && u.territory.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeCount = users.filter((u) => u.status === 'Active').length;
  const deactivatedCount = users.filter((u) => u.status === 'Deactivated').length;
  const pendingPasswordCount = users.filter((u) => u.mustChangePassword).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold border backdrop-blur-md animate-in slide-in-from-top-4 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                User Management
              </h1>
              <p className="text-xs text-slate-400">
                Admin-Controlled Account Creation, Role-Based Access Control, and Security Management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadUsers}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh user list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Users
          </div>
          <div className="text-2xl font-bold text-white">{users.length}</div>
          <div className="text-[10px] text-slate-500">Registered Enterprise Accounts</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            Active Accounts
          </div>
          <div className="text-2xl font-bold text-emerald-400">{activeCount}</div>
          <div className="text-[10px] text-slate-500">Authorized & Operational</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
            Deactivated
          </div>
          <div className="text-2xl font-bold text-rose-400">{deactivatedCount}</div>
          <div className="text-[10px] text-slate-500">Access Blocked by Admin</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
            Temp Passwords
          </div>
          <div className="text-2xl font-bold text-amber-400">{pendingPasswordCount}</div>
          <div className="text-[10px] text-slate-500">Pending First Login Change</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, territory..."
            className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="All">All Roles</option>
            <option value="System Admin">System Admin</option>
            <option value="Sales Manager">Sales Manager</option>
            <option value="Sales Representative">Sales Representative</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-2">
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Deactivated">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider bg-slate-950/60">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Password Status</th>
                <th className="py-3 px-4">Territory</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading registered users...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No users found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentAdmin = u.email === currentAdmin?.email;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-white flex items-center gap-1.5 truncate">
                              <span>{u.name}</span>
                              {isCurrentAdmin && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300 font-semibold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            u.role === 'System Admin'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                              : u.role === 'Sales Manager'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>{u.role}</span>
                        </span>
                      </td>

                      {/* Account Status Badge */}
                      <td className="py-3.5 px-4">
                        {u.status === 'Active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <Lock className="w-3 h-3" />
                            <span>Deactivated</span>
                          </span>
                        )}
                      </td>

                      {/* Password Status */}
                      <td className="py-3.5 px-4">
                        {u.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            <KeyRound className="w-3 h-3 text-amber-400" />
                            <span>Temp (role@123)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Permanent</span>
                          </span>
                        )}
                      </td>

                      {/* Territory */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{u.territory || 'National HQ'}</span>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        }) : 'Pre-configured'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Active / Deactivate */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isCurrentAdmin}
                            title={
                              isCurrentAdmin
                                ? 'Cannot deactivate yourself'
                                : u.status === 'Active'
                                ? 'Deactivate user'
                                : 'Activate user'
                            }
                            className={`p-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                              u.status === 'Active'
                                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                            }`}
                          >
                            {u.status === 'Active' ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => handleResetPassword(u)}
                            title="Reset password to 'role@123'"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-brand-500/10 transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Delete User */}
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            disabled={isCurrentAdmin}
                            title={isCurrentAdmin ? 'Cannot delete yourself' : 'Delete user'}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL DIALOG */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Create Enterprise Account</h2>
                  <p className="text-[11px] text-slate-400">
                    Provision new user with initial password "role@123"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error in modal */}
            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Nagarjun B.G."
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Gmail Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>User Gmail Address *</span>
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@gmail.com"
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
                <span className="text-[10px] text-slate-400">
                  This Gmail address will become the user's permanent login identity.
                </span>
              </div>

              {/* Strict Role Selection (Only the 3 existing roles) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Assign Role (Strict 3-Role Access) *</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="System Admin">System Admin (Full system configuration & user management)</option>
                  <option value="Sales Manager">Sales Manager (Area operations, targets, catalog & reports)</option>
                  <option value="Sales Representative">Sales Representative (Field beat, check-in, orders)</option>
                </select>
              </div>

              {/* Territory */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Operating Territory / Beat Area</span>
                </label>
                <select
                  value={newTerritory}
                  onChange={(e) => setNewTerritory(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="National HQ">National HQ</option>
                  <option value="North Delhi">North Delhi</option>
                  <option value="West Delhi">West Delhi</option>
                  <option value="South Delhi">South Delhi</option>
                  <option value="South Mumbai">South Mumbai</option>
                  <option value="Bengaluru Central">Bengaluru Central</option>
                  <option value="Kolkata East">Kolkata East</option>
                </select>
              </div>

              {/* Informative Notice Box */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Temporary Password Policy</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Initial password will be automatically configured as <code className="bg-slate-900 px-1.5 py-0.5 rounded font-bold text-amber-300 font-mono">role@123</code>. The user is strictly required to change this password on their first login before accessing their role dashboard.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-brand-600/30 flex items-center gap-2"
                >
                  {isCreating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Create User Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL DIALOG */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const act = confirmDialog.action;
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                  await act();
                }}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
