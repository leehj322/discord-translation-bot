import { v3 } from "@google-cloud/translate";
import { incrApiCalls } from "../usage/usage.js";

const translationClient = new v3.TranslationServiceClient();
let cachedProjectId: string | null = null;

async function getProjectId(): Promise<string> {
  if (!cachedProjectId) {
    cachedProjectId = await translationClient.getProjectId();
  }
  return cachedProjectId;
}

const LANG_MAP: Record<string, string> = { ko: "ko", jp: "ja", ja: "ja" };

export function normalizeLangCode(input: unknown): string | null {
  if (input == null) return null;
  const key = String(input).toLowerCase();
  return LANG_MAP[key] || null;
}

export interface TranslateParams {
  source: string;
  target: string;
  text: string;
  location?: string; // default: global
}

export async function translateText({
  source,
  target,
  text,
  location = "global",
}: TranslateParams): Promise<string> {
  const src = normalizeLangCode(source);
  const tgt = normalizeLangCode(target);
  if (!src || !tgt)
    throw new Error(`Unsupported language: source=${source}, target=${target}`);

  const projectId = await getProjectId();
  const parent = `projects/${projectId}/locations/${location}`;

  const [response] = await translationClient.translateText({
    parent,
    contents: [text],
    mimeType: "text/plain",
    sourceLanguageCode: src,
    targetLanguageCode: tgt,
  });
  const translated = response.translations?.[0]?.translatedText;
  if (!translated) throw new Error("Translate API returned no translation");
  const totalApi = incrApiCalls();
  console.log(
    "[TranslateAPI] src=%s tgt=%s text=%s -> translated=%s | api_total=%d",
    src,
    tgt,
    text,
    translated,
    totalApi
  );
  return translated;
}
