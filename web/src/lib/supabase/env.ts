const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);
export const missingSupabaseEnvMessage =
  "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in web/.env.local.";

function readPublicEnv(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`${missingSupabaseEnvMessage} Missing ${label}.`);
  }

  return value;
}

export function getSupabaseUrl() {
  return readPublicEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublicKey() {
  return readPublicEnv(
    supabasePublicKey,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export function getSupabaseFunctionUrl(name: string) {
  return `${getSupabaseUrl().replace(/\/$/, "")}/functions/v1/${name}`;
}
