import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { signInWithGoogle } from "../lib/auth";
import { useAuth } from "../contexts/AuthContext";

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
        <Text style={styles.title}>UMass Nutrition</Text>
        <Text style={styles.subtitle}>Personalized meal plans from UMass dining halls.</Text>
      </View>

      <View style={styles.actions}>
        {(error || authError) ? <Text style={styles.error}>{error || authError}</Text> : null}
        <Pressable
          disabled={loading}
          onPress={handleSignIn}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
        >
          {loading ? <ActivityIndicator color="#071018" /> : <Text style={styles.buttonText}>Sign in with Google</Text>}
        </Pressable>
        <Text style={styles.note}>Use your @umass.edu account.</Text>
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
    backgroundColor: "#0b0f14"
  },
  copy: {
    gap: 12
  },
  title: {
    color: "#f4f7fb",
    fontSize: 38,
    fontWeight: "800"
  },
  subtitle: {
    color: "#aeb8c6",
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
    borderRadius: 8,
    backgroundColor: "#8bd3ff"
  },
  buttonPressed: {
    opacity: 0.8
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: "#071018",
    fontSize: 16,
    fontWeight: "800"
  },
  note: {
    color: "#748092",
    fontSize: 13,
    textAlign: "center"
  },
  error: {
    color: "#ff9b9b",
    fontSize: 14,
    lineHeight: 20
  }
});
