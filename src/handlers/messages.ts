import type { Client } from "discord.js";
import { logger } from "../core/logger.js";
import { publicSessions } from "../features/translate/sessions.js";
import { translateText } from "../features/translate/service.js";
import {
  incrUsage,
  addCharUsage,
  recordUsageEvent,
} from "../features/translate/usage.js";

const registeredClients = new WeakSet<Client>();
const processedMessageIds = new Set<string>();

/**
 * Guild 텍스트 메시지를 대상으로 자동 번역을 수행하는 메시지 핸들러를 등록합니다.
 * - 채널 단위 세션(publicSessions)에 의해 활성화 여부를 판단합니다.
 * - 동일 메시지에 대한 중복 번역/응답을 방지합니다.
 */
export function registerMessageHandler(client: Client): void {
  if (registeredClients.has(client)) return;
  registeredClients.add(client);
  client.on("messageCreate", async (message) => {
    try {
      if ((message.author as any).bot || !message.guild || message.system)
        return;
      const channelId = message.channel.id;
      const guildId = message.guild.id;

      const publicCfg = publicSessions.get(channelId);
      if (!publicCfg) return;

      const content = (message.content || "").trim();
      if (!content) return;
      if (/^```[\s\S]*```$/m.test(content)) return;

      const targets: Array<any> = [];
      if (publicCfg) targets.push({ type: "public", cfg: publicCfg });

      // 중복 번역 방지: 동일 메시지에 대해 src/tgt 조합별 1회만 호출
      const requestedPairs = new Map<string, Promise<string>>();
      /**
       * 동일 메시지 컨텍스트에서 동일한 src/tgt 요청은 1회만 DeepL 호출하도록 보장합니다.
       */
      async function getTranslatedOnce(
        src: string,
        tgt: string
      ): Promise<string> {
        const key = `${src}|${tgt}|${content}`;
        const existing = requestedPairs.get(key);
        if (existing) return existing;
        const p = translateText({ source: src, target: tgt, text: content });
        requestedPairs.set(key, p);
        return p.finally(() => {
          // keep cache for this message lifecycle only
        });
      }

      // ko↔ja 외 언어는 번역하지 않음: 간단 감지(한글/가나/한자 유무)
      /**
       * 간단한 문자 집합 검사를 통해 한국어/일본어를 감지합니다.
       * - 한국어: 한글 범위
       * - 일본어: 히라가나/가타카나/한자 범위
       */
      function detectLangKoJa(text: string): "ko" | "ja" | null {
        // 한글: 자모(1100-11FF), 호환 자모(3130-318F), 완성형(AC00-D7A3)
        const hasHangul = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/u.test(
          text
        );
        // 일본어: 히라가나, 가타카나(전각), 가타카나 확장, 한자(CJK 통합·확장A), 호환 한자, 반각 가타카나
        const hasKanaOrKanji =
          /[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff65-\uff9f]/u.test(
            text
          );
        if (hasHangul && !hasKanaOrKanji) return "ko";
        if (hasKanaOrKanji && !hasHangul) return "ja";
        return null;
      }

      const detected = detectLangKoJa(content);
      if (!detected) return; // 영어 등은 번역하지 않음
      const target = detected === "ko" ? "ja" : "ko";

      // 동일 메시지 ID에 대한 중복 응답 방지 (같은 프로세스 내)
      if (processedMessageIds.has(message.id)) return;
      processedMessageIds.add(message.id);
      setTimeout(() => processedMessageIds.delete(message.id), 60_000);

      for (const t of targets) {
        try {
          const translated = await getTranslatedOnce(detected, target);
          logger.info("translate request", {
            feature: "translate",
            guildId,
            channelId,
            userId: message.author.id,
            src: detected,
            tgt: target,
            text: content,
          });
          incrUsage({ guildId, channelId, userId: message.author.id });
          addCharUsage({
            guildId,
            channelId,
            userId: message.author.id,
            chars: content.length,
          });
          // 새 테이블에 이벤트 기록 (translation_usage)
          recordUsageEvent({
            guildId,
            channelId,
            userId: message.author.id,
            userNickname:
              (message.member && (message.member as any).nickname) ||
              (message.author as any).globalName ||
              message.author.username,
            charCount: content.length,
          }).catch(() => {});
          await message.reply({
            content: translated,
            allowedMentions: { parse: [] },
          });
        } catch (err) {
          logger.error("translate/post failed", {
            feature: "translate",
            guildId,
            channelId,
            userId: message.author.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (e) {
      logger.error("messageCreate error", {
        feature: "translate",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  // 채널 삭제 시 세션 정리
  /**
   * 채널 또는 스레드가 삭제될 때, 해당 채널에 설정된 자동 번역 세션을 정리합니다.
   */
  client.on("channelDelete", async (channel: any) => {
    try {
      const channelId: string | undefined = channel?.id;
      if (!channelId) return;
      // public
      if (publicSessions.has(channelId)) publicSessions.delete(channelId);
    } catch (e) {
      logger.error("channelDelete cleanup failed", {
        feature: "translate",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}
