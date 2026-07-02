/// <reference types="expo/types" />

declare module "*.png";

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_CRM_BASE_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
