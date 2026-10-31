export function sourceLocation(
  section: string | null | undefined,
  page: number | null | undefined,
): string {
  const parts = [
    section ? section.trim() : "",
    typeof page === "number" ? `Page ${page}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Source location unavailable";
}
