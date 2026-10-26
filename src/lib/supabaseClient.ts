import { createClient } from '@supabase/supabase-js';

// Retrieve permanently configured credentials from LocalStorage or Vite Environment Variables
export const getSupabaseConfig = () => {
  let storedUrl = '';
  let storedKey = '';

  try {
    storedUrl = localStorage.getItem('fieldassist_supabase_url') || '';
    storedKey = localStorage.getItem('fieldassist_supabase_key') || '';
  } catch {
    // Ignore storage restrictions
  }

  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    '';

  const finalUrl = storedUrl || envUrl || 'https://baqelrnhnrsdnubasepq.supabase.co';
  const finalKey =
    storedKey ||
    envKey ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWVscm5obnJzZG51YmFzZXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTg3NjgsImV4cCI6MjEwNzEzNDc2OH0.FoaZMFc1cwkQhkWiEXEGfwYZOHS_Ca7DR28UXsBgJy4';

  const isCustom = Boolean(
    storedUrl ||
      (envUrl && !envUrl.includes('baqelrnhnrsdnubasepq'))
  );

  return {
    url: finalUrl,
    key: finalKey,
    isCustom,
  };
};

const config = getSupabaseConfig();

// Initialize permanent Supabase client with maximum browser session persistence
export const supabase = createClient(config.url, config.key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'fieldassist_supabase_auth_token',
  },
});

/**
 * Save user's own Supabase credentials permanently into browser storage
 */
export const savePermanentSupabaseConnection = (url: string, key: string): boolean => {
  try {
    const cleanUrl = url.trim();
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey) return false;

    localStorage.setItem('fieldassist_supabase_url', cleanUrl);
    localStorage.setItem('fieldassist_supabase_key', cleanKey);
    return true;
  } catch (err) {
    console.error('Failed to save permanent connection:', err);
    return false;
  }
};

/**
 * Clear custom Supabase connection
 */
export const clearPermanentSupabaseConnection = (): void => {
  try {
    localStorage.removeItem('fieldassist_supabase_url');
    localStorage.removeItem('fieldassist_supabase_key');
  } catch {}
};

/**
 * Test live Supabase connection
 */
export const testLiveSupabaseConnection = async (
  testUrl?: string,
  testKey?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = testUrl || getSupabaseConfig().url;
    const key = testKey || getSupabaseConfig().key;

    if (!url.startsWith('https://')) {
      return { success: false, message: 'Supabase URL must start with https://' };
    }

    const testClient = createClient(url, key, {
      auth: { persistSession: false },
    });

    const { error } = await testClient.from('products').select('count', { count: 'exact', head: true });
    
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it's still connected to Supabase
      if (error.message.includes('relation "public.products" does not exist') || error.message.includes('404')) {
        return {
          success: true,
          message: 'Connected to Supabase project! (Run SQL setup script to create tables)',
        };
      }
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Connected to live Supabase database successfully!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection timed out or network error' };
  }
};

export default supabase;
