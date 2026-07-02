import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

import { secureStoreAdapter } from "./secureStoreAdapter";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[WACRM Mobile] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export const crmBaseUrl =
  process.env.EXPO_PUBLIC_CRM_BASE_URL?.replace(/\/$/, "") ||
  "https://mgteamoficial.site";
