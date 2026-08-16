import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) throw new Error("Supabase não configurado. Defina as variáveis de ambiente.");
  return createBrowserClient(url, key);
}
