export const LANG_MAP: Record<string, string> = {
  ko: "ko",
  jp: "ja",
  ja: "ja",
};

export function normalizeLangCode(input: unknown): string | null {
  if (input == null) return null;
  const key = String(input).toLowerCase();
  return LANG_MAP[key] || null;
}
