import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

export const isSupabaseServerConfigured = () => {
  return (
    supabaseUrl &&
    supabaseUrl !== 'https://placeholder-project.supabase.co' &&
    serviceRoleKey &&
    serviceRoleKey !== 'placeholder-service-role-key'
  );
};

export const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
