import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Helper to determine if we are using a real Supabase configuration.
// Recognizes common placeholder/example values (CI mock env, docs snippets) —
// misclassifying a fake URL as "configured" makes queries fetch a dead host, and
// since the fs-fallback removal (PR #99) that fails builds instead of silently
// using the file mock.
const PLACEHOLDER_RE = /placeholder|example\.supabase\.co|^\s*$/i;
export const isSupabaseConfigured = () => {
  return (
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    !PLACEHOLDER_RE.test(supabaseUrl) &&
    !PLACEHOLDER_RE.test(supabaseAnonKey)
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
