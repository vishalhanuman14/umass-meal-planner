export const colors = {
  background: "#FFF7F2",
  backgroundAlt: "#FFF1E8",
  surface: "#FFFFFF",
  surfaceWarm: "#FFF1E8",
  elevated: "#FFFFFF",
  border: "#F0DDD3",
  text: "#191919",
  muted: "#6B625D",
  quiet: "#9A8F87",
  primary: "#EB1700",
  primaryPressed: "#C91400",
  onPrimary: "#FFFFFF",
  success: "#1A7F37",
  warning: "#F59E0B",
  danger: "#D92D20",
  black: "#191919",
  maroon: "#EB1700",
  amber: "#F59E0B",
  green: "#1A7F37",
  blue: "#2563EB"
};

export const commonColors = {
  worcester: "#2563EB",
  franklin: "#16A34A",
  hampshire: "#F59E0B",
  berkshire: "#EB1700"
};

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  soft: {
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  }
};

export const commonLabels = {
  worcester: "Worcester",
  franklin: "Franklin",
  hampshire: "Hampshire",
  berkshire: "Berkshire"
};

export type DiningCommonKey = keyof typeof commonColors;

export function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getDiningCommon(value?: string | null) {
  const normalized = (value ?? "").toLowerCase();
  const key = (Object.keys(commonColors) as DiningCommonKey[]).find((item) => normalized.includes(item));

  if (!key) {
    return {
      key: "worcester" as DiningCommonKey,
      label: value ? titleCase(value) : "Dining commons",
      color: colors.blue
    };
  }

  return {
    key,
    label: commonLabels[key],
    color: commonColors[key]
  };
}

export const periodOrder = ["breakfast", "lunch", "dinner", "late_night", "late night", "grabngo", "grab_go"];

export function sortMealPeriod([left]: [string, unknown], [right]: [string, unknown]) {
  const leftIndex = periodOrder.indexOf(left);
  const rightIndex = periodOrder.indexOf(right);

  if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
  if (leftIndex === -1) return 1;
  if (rightIndex === -1) return -1;
  return leftIndex - rightIndex;
}
