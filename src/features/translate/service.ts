import { incrApiCalls } from "../usage/usage.js";
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
