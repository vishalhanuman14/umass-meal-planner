"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, missingSupabaseEnvMessage } from "@/lib/supabase/env";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn() {
    if (!isSupabaseConfigured) {
      setMessage(missingSupabaseEnvMessage);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/home`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sign-in could not start.");
      setLoading(false);
    }
  }

  return (
    <div className="stack-sm" style={{ width: "100%" }}>
      <button className="button button-primary" onClick={handleSignIn} disabled={loading}>
        {loading ? "Opening Google..." : "Sign in with UMass Google"}
      </button>
      {message ? <p className="status-note status-note-error">{message}</p> : null}
    </div>
  );
}
