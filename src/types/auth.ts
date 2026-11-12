export type UserRole = 'System Admin' | 'Sales Manager' | 'Sales Representative';

export type AccountStatus = 'Active' | 'Deactivated';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  status: AccountStatus;
  mustChangePassword?: boolean;
  territory?: string;
  region?: string;
  repId?: string; // Associated SalesRep ID if role is Sales Representative
  phone?: string;
  department: string;
  permissions: string[];
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: number; // seconds
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface CreateUserData {
  fullName: string;
  email: string;
  role: UserRole;
  territory?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
