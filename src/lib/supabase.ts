/**
 * Supabase Client Configuration
 * RAM SUMBER REZEKI
 *
 * NOTE: This file ONLY contains the Supabase connection and client setup.
 * UI and React views are located in src/App.tsx and src/components.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get credentials from Vite environment variables or localStorage overrides if user configured them in settings
const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  let storedUrl = typeof window !== 'undefined' ? localStorage.getItem('ram_supabase_url') : null;
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('ram_supabase_anon_key') : null;

  // Clean URL & Key: extract origin only and trim keys
  if (storedUrl) {
    try {
      const u = new URL(storedUrl.trim());
      storedUrl = u.origin;
    } catch {
      storedUrl = storedUrl.trim().split('/rest/v1')[0].replace(/\/+$/, '');
    }
  }

  const supabaseUrl = storedUrl || envUrl || 'https://mock-ram-sumber-rezeki.supabase.co';
  const supabaseAnonKey = (storedKey || envKey || 'mock-anon-key-sumber-rezeki-2026').trim();

  const isConfigured = Boolean((storedUrl && storedKey) || (envUrl && envKey));

  if (isConfigured && typeof window !== 'undefined') {
    console.log('[Supabase] Initializing with URL:', supabaseUrl);
  }

  return { supabaseUrl, supabaseAnonKey, isConfigured };
};

const config = getSupabaseConfig();

export const isSupabaseConfigured = config.isConfigured;

// Validate URL before creating client to prevent hard crashes
const validUrl = config.supabaseUrl.startsWith('http') ? config.supabaseUrl : `https://${config.supabaseUrl}`;

export const supabase: SupabaseClient = createClient(validUrl, config.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const updateSupabaseCredentials = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ram_supabase_url', url);
    localStorage.setItem('ram_supabase_anon_key', key);
  }
};

export const clearSupabaseCredentials = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ram_supabase_url');
    localStorage.removeItem('ram_supabase_anon_key');
  }
};
