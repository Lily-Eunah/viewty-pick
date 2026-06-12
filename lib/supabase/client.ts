import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Helper to determine if we are using a real Supabase configuration
export const isSupabaseConfigured = () => {
  return (
    supabaseUrl &&
    supabaseUrl !== 'https://placeholder-project.supabase.co' &&
    supabaseAnonKey &&
    supabaseAnonKey !== 'placeholder-anon-key'
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
