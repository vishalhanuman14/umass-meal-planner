export const colors = {
  background: "#0E1111",
  backgroundAlt: "#101312",
  surface: "#171B1A",
  elevated: "#202624",
  border: "#2D3431",
  text: "#F4F1EA",
  muted: "#A8B0AA",
  quiet: "#77817B",
  maroon: "#881C1C",
  amber: "#F2C14E",
  green: "#6FBF73",
  blue: "#6CA6C1",
  danger: "#FF9B9B",
  black: "#070908"
};

export const commonColors = {
  worcester: colors.blue,
  franklin: colors.green,
  hampshire: colors.amber,
  berkshire: colors.maroon
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
