export function isUmassEmail(email?: string | null) {
  return Boolean(email?.toLowerCase().endsWith("@umass.edu"));
}

export function firstName(name?: string | null, email?: string | null) {
  const cleaned = name?.trim();

  if (cleaned) {
    return cleaned.split(/\s+/)[0];
  }

  return email?.split("@")[0] ?? "there";
}
