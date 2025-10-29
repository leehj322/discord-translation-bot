// DeepL API 클라이언트 모듈
// - 언어 코드를 정규화한 뒤 DeepL v2 /translate 엔드포인트를 호출해 단문 번역을 수행합니다.
// - 환경변수: DEEPL_AUTH_KEY(필수), DEEPL_API_BASE(선택: free/pro 엔드포인트 선택)
// - 오류 시 HTTP 응답 본문을 포함하여 예외를 발생시킵니다.
//
import { normalizeLangCode } from "./lang.js";

export interface DeepLParams {
  source: string;
  target: string;
  text: string;
}

function getDeepLEndpoint(): string {
  // DeepL: free는 api-free.deepl.com, pro는 api.deepl.com
  const base = process.env.DEEPL_API_BASE || "https://api-free.deepl.com";
  return `${base}/v2/translate`;
}

export async function deeplTranslate({
  source,
  target,
  text,
}: DeepLParams): Promise<string> {
  const authKey = process.env.DEEPL_AUTH_KEY;
  if (!authKey) throw new Error("Missing DEEPL_AUTH_KEY");

  const src = normalizeLangCode(source);
  const tgt = normalizeLangCode(target);
  if (!src || !tgt)
    throw new Error(`Unsupported language: source=${source}, target=${target}`);

  // DeepL는 일본어 코드 'JA', 한국어 'KO'를 사용. 대문자 변환
  const deeplSource = src.toUpperCase();
  const deeplTarget = tgt.toUpperCase();

  const endpoint = getDeepLEndpoint();
  const form = new URLSearchParams();
  form.set("text", text);
  form.set("source_lang", deeplSource);
  form.set("target_lang", deeplTarget);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${authKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `DeepL API error: ${res.status} ${res.statusText} - ${errText}`
    );
  }
  const data: any = await res.json();
  const translated: string | undefined = data?.translations?.[0]?.text;
  if (!translated) throw new Error("DeepL returned no translation");
  return translated;
}
