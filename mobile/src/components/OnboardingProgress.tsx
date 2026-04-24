import { StyleSheet, View } from "react-native";

type OnboardingProgressProps = {
  step: number;
  total: number;
};

export default function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <View key={index} style={[styles.segment, index < step ? styles.active : styles.inactive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#8bd3ff"
  },
  inactive: {
    backgroundColor: "#243041"
  }
});
