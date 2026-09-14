export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function withTimestampSuffix(slug: string) {
  const suffix = Date.now().toString(36);
  const base = slug.slice(0, Math.max(1, 80 - suffix.length - 1));

  return `${base}-${suffix}`;
}
