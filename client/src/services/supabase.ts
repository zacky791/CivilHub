import { createClient } from "@supabase/supabase-js";
// Integration boundary. Demo records never leave this browser.
// Enable a real repository with authenticated queries before using production data.
let client: ReturnType<typeof createClient> | undefined;
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
