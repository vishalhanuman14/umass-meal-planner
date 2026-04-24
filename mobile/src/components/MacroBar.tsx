import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

type MacroBarProps = {
  label: string;
  value: number;
  target?: number | null;
  unit: string;
};

export default function MacroBar({ label, value, target, unit }: MacroBarProps) {
  const ratio = target ? Math.min(value / target, 1) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {Math.round(value)}
          {target ? ` / ${Math.round(target)}` : ""} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16
  },
  label: {
    color: colors.muted,
    fontSize: 13
  },
  value: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  track: {
    height: 7,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: colors.border
  },
  fill: {
    height: "100%",
    borderRadius: 7,
    backgroundColor: colors.amber
  }
});
