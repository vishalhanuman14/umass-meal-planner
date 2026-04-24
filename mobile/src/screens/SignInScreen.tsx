import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { signInWithGoogle } from "../lib/auth";
import { useAuth } from "../contexts/AuthContext";
import { colors, commonColors } from "../theme";

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
      <View style={styles.lines} pointerEvents="none">
        {Array.from({ length: 12 }).map((_, index) => (
          <View key={index} style={[styles.line, { top: 68 + index * 38 }]} />
        ))}
      </View>

      <View style={styles.copy}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>UM</Text>
          </View>
          <Text style={styles.eyebrow}>Dining board</Text>
        </View>
        <Text style={styles.title}>UMass Eats</Text>
        <Text style={styles.subtitle}>Today's UMass dining picks, built around you.</Text>
        <View style={styles.commons}>
          <CommonsDot color={commonColors.worcester} label="Worcester" />
          <CommonsDot color={commonColors.franklin} label="Franklin" />
          <CommonsDot color={commonColors.hampshire} label="Hampshire" />
          <CommonsDot color={commonColors.berkshire} label="Berkshire" />
        </View>
      </View>

      <View style={styles.actions}>
        {(error || authError) ? <Text style={styles.error}>{error || authError}</Text> : null}
        <Pressable
          disabled={loading}
          onPress={handleSignIn}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
        >
          {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>Continue with UMass Google</Text>}
        </Pressable>
        <Text style={styles.note}>Only @umass.edu accounts.</Text>
      </View>
    </View>
  );
}

function CommonsDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.commonsItem}>
      <View style={[styles.commonsDot, { backgroundColor: color }]} />
      <Text style={styles.commonsText}>{label}</Text>
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
  lines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4
  },
  line: {
    position: "absolute",
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: colors.border
  },
  copy: {
    gap: 14
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  brandMark: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.maroon
  },
  brandMarkText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13
  },
  eyebrow: {
    color: colors.quiet,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 24
  },
  commons: {
    marginTop: 10,
    gap: 10
  },
  commonsItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  commonsDot: {
    width: 8,
    height: 8,
    borderRadius: 8
  },
  commonsText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600"
  },
  actions: {
    gap: 14
  },
  button: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.maroon
  },
  buttonPressed: {
    opacity: 0.8
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
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
