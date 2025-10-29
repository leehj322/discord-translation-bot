// 번역 서비스 계층
// - 입력 언어 코드 검증 및 정규화
// - DeepL 클라이언트 호출(deeplTranslate)
// - 사용량 카운팅(incrApiCalls) 기록
// - 단일 텍스트에 대한 동기/비동기 흐름을 단순화합니다.
//
import { incrApiCalls } from "./usage.js";
import { deeplTranslate } from "./deepl.js";
import { normalizeLangCode } from "./lang.js";

// Google Translate 제거 버전: DeepL만 사용

export interface TranslateParams {
  source: string;
  target: string;
  text: string;
}

export async function translateText({
  source,
  target,
  text,
}: TranslateParams): Promise<string> {
  const src = normalizeLangCode(source);
  const tgt = normalizeLangCode(target);
  if (!src || !tgt)
    throw new Error(`Unsupported language: source=${source}, target=${target}`);

  const translated = await deeplTranslate({ source: src, target: tgt, text });
  const totalApi = incrApiCalls();
  console.log(
    "[DeepL] src=%s tgt=%s text=%s -> translated=%s | api_total=%d",
    src,
    tgt,
    text,
    translated,
    totalApi
  );
  return translated;
}
