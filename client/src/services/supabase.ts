import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// One client owns the live authentication session and authenticated data requests.
let client: SupabaseClient | undefined;
export function createSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL,
    key =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the development server.",
    );
  }
  client ??= createClient(url, key);
  return client;
}
