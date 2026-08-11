import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://yamzfnayjrdyjnwtxpoy.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhbXpmbmF5anJkeWpud3R4cG95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MTIxMDAsImV4cCI6MjA5OTQ4ODEwMH0.2xX4KidqN8pr82PuH6vM493QvawC4TqaS8nqNMEWVkQ";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
