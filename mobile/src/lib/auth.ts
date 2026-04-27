import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export function isUmassEmail(email?: string | null) {
  return Boolean(email?.toLowerCase().endsWith("@umass.edu"));
}

function authParamsFromCallback(callbackUrl: string) {
  const url = new URL(callbackUrl);
  const params = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");

  url.searchParams.forEach((value, key) => {
    params.set(key, value);
  });

  return params;
}

function getRedirectTo() {
  if (Platform.OS === "web") {
    return `${globalThis.location.origin}/auth/callback`;
  }

  return AuthSession.makeRedirectUri({
    scheme: "umassnutrition",
    path: "auth/callback"
  });
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) {
    throw new Error("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env.");
  }

  const redirectTo = getRedirectTo();

  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
    });

    if (error) {
      throw error;
    }
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    }
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error("Google sign-in did not return an OAuth URL.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success") {
    return;
  }

  const params = authParamsFromCallback(result.url);
  const code = params.get("code");
  const errorDescription = params.get("error_description") ?? params.get("error");

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  if (code) {
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      throw exchangeError;
    }

    const email = sessionData.user?.email;
    if (!isUmassEmail(email)) {
      await supabase.auth.signOut();
      throw new Error("Use your @umass.edu Google account.");
    }
    return;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    throw new Error("Google sign-in completed without an auth code.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (sessionError) {
    throw sessionError;
  }

  const email = sessionData.session?.user.email ?? sessionData.user?.email;
  if (!isUmassEmail(email)) {
    await supabase.auth.signOut();
    throw new Error("Use your @umass.edu Google account.");
  }
}
