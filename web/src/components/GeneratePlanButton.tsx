"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  getSupabaseFunctionUrl,
  getSupabasePublicKey,
  isSupabaseConfigured,
  missingSupabaseEnvMessage,
} from "@/lib/supabase/env";

type GeneratePlanButtonProps = {
  label: string;
  regenerate?: boolean;
  className?: string;
};

function normalizeMessage(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("complete onboarding")) {
    return "Finish onboarding in the mobile app first.";
  }

  if (lower.includes("menu")) {
    return "Menu not available yet.";
  }

  return message;
}

export function GeneratePlanButton({
  label,
  regenerate = false,
  className,
}: GeneratePlanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleGenerate() {
    if (!isSupabaseConfigured) {
      setMessage(missingSupabaseEnvMessage);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session?.access_token) {
        throw error ?? new Error("You need to sign in again.");
      }

      const response = await fetch(getSupabaseFunctionUrl("generate-meal-plan"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: getSupabasePublicKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ regenerate }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Could not generate today's meal plan.",
        );
      }

      if (typeof payload?.error === "string") {
        throw new Error(payload.error);
      }

      router.refresh();
    } catch (error) {
      setMessage(normalizeMessage(error instanceof Error ? error.message : "Could not load today's meal plan."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack-sm" style={{ width: "100%" }}>
      <button
        className={["button", regenerate ? "button-secondary" : "button-primary", className]
          .filter(Boolean)
          .join(" ")}
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? (regenerate ? "Refreshing..." : "Loading...") : label}
      </button>
      {message ? <p className="status-note status-note-error">{message}</p> : null}
    </div>
  );
}
