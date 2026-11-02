import { createClient } from "@supabase/supabase-js";
// Integration boundary. Demo records never leave this browser.
// Enable a real repository with authenticated queries before using production data.
export function createSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL,
    key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase integration is not configured.");
  return createClient(url, key);
}
