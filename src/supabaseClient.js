import { createClient } from "@supabase/supabase-js";

// Replace these with your actual Supabase project credentials
// Get them from: https://supabase.com → Your Project → Settings → API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://YOUR_PROJECT_ID.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,       // Save session to localStorage (auto-login on revisit)
    autoRefreshToken: true,     // Auto-refresh expired tokens
    detectSessionInUrl: true,   // Handle OAuth/magic-link redirects
    storageKey: 'adss-auth',    // Custom key to avoid conflicts
    storage: window.localStorage,
  },
});
