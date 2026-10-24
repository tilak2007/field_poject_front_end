import { SupabaseClient, Session, AuthChangeEvent } from "@supabase/supabase-js";
import type { Database } from "./types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface CurrentUserSession {
  user: {
    id: string;
    email?: string;
    fullName?: string;
    avatarUrl?: string;
  };
  role: AppRole;
  isStaff: boolean;
  isAdmin: boolean;
}

export interface SignUpParams {
  email: string;
  password: string;
  fullName?: string;
  redirectTo?: string;
}

export interface GoogleAuthParams {
  redirectTo?: string;
}

/**
 * Sign in with email and password
 */
export async function signIn(
  supabase: SupabaseClient<Database>,
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Create a new account with email and password
 */
export async function signUp(
  supabase: SupabaseClient<Database>,
  params: SignUpParams
) {
  const { email, password, fullName, redirectTo } = params;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: redirectTo,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign up or Sign in with Google (OAuth)
 * Opens Google's OAuth consent screen and redirects back with session.
 */
export async function signInWithGoogle(
  supabase: SupabaseClient<Database>,
  params: GoogleAuthParams = {}
) {
  const redirectTo =
    params.redirectTo ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out current session
 */
export async function signOut(supabase: SupabaseClient<Database>) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Send password reset email
 */
export async function resetPassword(
  supabase: SupabaseClient<Database>,
  email: string,
  redirectTo?: string
) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
  return data;
}

/**
 * Update password (used after receiving reset link or inside user profile)
 */
export async function updatePassword(
  supabase: SupabaseClient<Database>,
  newPassword: string
) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

/**
 * Get current authenticated user, their role, and convenience flags
 */
export async function getCurrentUserRole(
  supabase: SupabaseClient<Database>
): Promise<CurrentUserSession | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) throw error;

  // Default to sales_rep if no specific elevated role found
  const role: AppRole = (roles?.[0]?.role as AppRole) ?? "sales_rep";
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "manager";

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0],
      avatarUrl:
        user.user_metadata?.avatar_url || user.user_metadata?.picture,
    },
    role,
    isAdmin,
    isStaff,
  };
}

/**
 * Subscribe to auth state changes (sign in, sign out, token refresh)
 */
export function onAuthStateChange(
  supabase: SupabaseClient<Database>,
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
