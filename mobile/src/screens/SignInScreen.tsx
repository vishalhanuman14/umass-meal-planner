import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { signInWithGoogle } from "../lib/auth";
import { useAuth } from "../contexts/AuthContext";
import { colors, shadows } from "../theme";

export default function SignInScreen() {
  const { authError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.copy}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>UM</Text>
        </View>
        <Text style={styles.title}>UMass Eats</Text>
        <Text style={styles.subtitle}>Find the best dining hall meal for today.</Text>
      </View>

      <View style={styles.actions}>
        {(error || authError) ? <Text style={styles.error}>{error || authError}</Text> : null}
        <Pressable
          disabled={loading}
          onPress={handleSignIn}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
        >
          {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>Continue with Google</Text>}
        </Pressable>
        <Text style={styles.note}>Only @umass.edu accounts.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
    paddingTop: 96,
    paddingBottom: 44,
    backgroundColor: colors.background
  },
  copy: {
    gap: 16
  },
  brandMark: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.primary,
    ...shadows.soft
  },
  brandMarkText: {
    color: colors.onPrimary,
    fontWeight: "900",
    fontSize: 17
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 24
  },
  actions: {
    gap: 14
  },
  button: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    ...shadows.soft
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: "900"
  },
  note: {
    color: colors.quiet,
    fontSize: 13,
    textAlign: "center"
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20
  }
});
