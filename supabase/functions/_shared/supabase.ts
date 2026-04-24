import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export class HttpError extends Error {
  status: number;
  expose: boolean;

  constructor(status: number, message: string, expose = true) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.expose = expose;
  }
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function handleCors(req: Request): Response | null {
  if (req.method !== "OPTIONS") {
    return null;
  }

  return new Response("ok", { headers: corsHeaders });
}

export function requirePost(req: Request): void {
  if (req.method !== "POST") {
    throw new HttpError(405, "Method not allowed");
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      { error: error.expose ? error.message : "Internal server error" },
      error.status,
    );
  }

  console.error(error);
  return jsonResponse({ error: "Internal server error" }, 500);
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(500, `Missing required environment variable: ${name}`, false);
  }

  return value;
}

export function createServiceClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function authenticateRequest(req: Request): Promise<{
  supabase: SupabaseClient;
  user: User;
  token: string;
}> {
  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    throw new HttpError(401, "Missing Authorization header");
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new HttpError(401, "Authorization header must be a Bearer token");
  }

  const token = match[1].trim();
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new HttpError(401, "Invalid or expired session");
  }

  const email = data.user.email?.toLowerCase() ?? "";
  if (!email.endsWith("@umass.edu")) {
    throw new HttpError(403, "Only @umass.edu accounts are allowed");
  }

  return { supabase, user: data.user, token };
}

export async function readJsonBody<T extends object>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}
