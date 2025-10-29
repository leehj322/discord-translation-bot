// 언어 코드 정규화 유틸리티
// - 다양한 입력 별칭(ko/jp/ja)을 내부 표준 코드(ko/ja)로 매핑합니다.
// - 지원하지 않는 입력에 대해서는 null을 반환합니다.
//
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
