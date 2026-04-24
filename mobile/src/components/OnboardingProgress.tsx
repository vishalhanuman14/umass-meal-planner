import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

type OnboardingProgressProps = {
  step: number;
  total: number;
};

export default function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Step {step} of {total}</Text>
      <View style={styles.row}>
        {Array.from({ length: total }).map((_, index) => (
          <View key={index} style={[styles.segment, index < step ? styles.active : styles.inactive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8
  },
  label: {
    color: colors.quiet,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 4
  },
  active: {
    backgroundColor: colors.maroon
  },
  inactive: {
    backgroundColor: colors.border
  }
});
