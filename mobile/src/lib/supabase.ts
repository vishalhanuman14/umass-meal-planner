import "react-native-url-polyfill/auto";

import * as ExpoCrypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const SECURE_STORE_CHUNK_SIZE = 1800;

function installCryptoPolyfill() {
  const cryptoWithFallback = globalThis.crypto as
    | (Crypto & { subtle?: SubtleCrypto })
    | undefined;
  const hasDigest = typeof cryptoWithFallback?.subtle?.digest === "function";
  const hasGetRandomValues = typeof cryptoWithFallback?.getRandomValues === "function";

  if (hasDigest && hasGetRandomValues) {
    return;
  }

  const digest =
    cryptoWithFallback?.subtle?.digest?.bind(cryptoWithFallback.subtle) ??
    ((algorithm: AlgorithmIdentifier, data: BufferSource) => {
      const algorithmName = typeof algorithm === "string" ? algorithm : algorithm.name;
      return ExpoCrypto.digest(algorithmName as ExpoCrypto.CryptoDigestAlgorithm, data);
    });

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      ...cryptoWithFallback,
      getRandomValues:
        cryptoWithFallback?.getRandomValues?.bind(cryptoWithFallback) ??
        ExpoCrypto.getRandomValues,
      randomUUID: cryptoWithFallback?.randomUUID?.bind(cryptoWithFallback) ?? ExpoCrypto.randomUUID,
      subtle: {
        ...cryptoWithFallback?.subtle,
        digest
      }
    }
  });
}

installCryptoPolyfill();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const configuredSupabaseUrl = supabaseUrl ?? "https://example.supabase.co";
export const configuredSupabaseAnonKey = supabaseAnonKey ?? "missing-anon-key";

if (!isSupabaseConfigured) {
  console.warn("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

function chunkCountKey(key: string) {
  return `${key}:chunk-count`;
}

function chunkKey(key: string, index: number) {
  return `${key}:chunk:${index}`;
}

async function removeSecureStoreItem(key: string) {
  const chunkCountValue = await SecureStore.getItemAsync(chunkCountKey(key));
  const chunkCount = Number(chunkCountValue);

  await SecureStore.deleteItemAsync(key);

  if (Number.isInteger(chunkCount) && chunkCount > 0) {
    await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index))
      )
    );
  }

  await SecureStore.deleteItemAsync(chunkCountKey(key));
}

async function getSecureStoreItem(key: string) {
  const chunkCountValue = await SecureStore.getItemAsync(chunkCountKey(key));

  if (!chunkCountValue) {
    return SecureStore.getItemAsync(key);
  }

  const chunkCount = Number(chunkCountValue);

  if (!Number.isInteger(chunkCount) || chunkCount < 1) {
    await removeSecureStoreItem(key);
    return null;
  }

  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index)))
  );

  if (chunks.some((chunk) => chunk === null)) {
    await removeSecureStoreItem(key);
    return null;
  }

  return chunks.join("");
}

async function setSecureStoreItem(key: string, value: string) {
  await removeSecureStoreItem(key);

  if (value.length <= SECURE_STORE_CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunks = Array.from(
    { length: Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE) },
    (_, index) =>
      value.slice(index * SECURE_STORE_CHUNK_SIZE, (index + 1) * SECURE_STORE_CHUNK_SIZE)
  );

  await Promise.all(
    chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk))
  );
  await SecureStore.setItemAsync(chunkCountKey(key), String(chunks.length));
}

const secureStoreAdapter = {
  getItem: getSecureStoreItem,
  setItem: setSecureStoreItem,
  removeItem: removeSecureStoreItem
};

const webStorageAdapter = {
  getItem: (key: string) => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
  setItem: (key: string, value: string) => {
    globalThis.localStorage?.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    globalThis.localStorage?.removeItem(key);
    return Promise.resolve();
  }
};

const authStorageAdapter = Platform.OS === "web" ? webStorageAdapter : secureStoreAdapter;

export const supabase = createClient(
  configuredSupabaseUrl,
  configuredSupabaseAnonKey,
  {
    auth: {
      storage: authStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
      flowType: "pkce"
    }
  }
);

AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
