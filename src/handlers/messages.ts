import type { Client } from "discord.js";
import { publicSessions } from "../features/translate/sessions.js";
import { translateText } from "../features/translate/service.js";
import { incrUsage } from "../features/usage/usage.js";

export function registerMessageHandler(client: Client): void {
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

      for (const t of targets) {
        try {
          const translated = await getTranslatedOnce(detected, target);
          console.log(
            "[TranslateReq] guild=%s channel=%s user=%s %s->%s text=%s",
            guildId,
            channelId,
            message.author.id,
            detected,
            target,
            content
          );
          incrUsage({ guildId, channelId, userId: message.author.id });
          await message.reply({
            content: translated,
            allowedMentions: { parse: [] },
          });
        } catch (err) {
          console.error("translate/post failed", err);
        }
      }
    } catch (e) {
      console.error("messageCreate error", e);
    }
  });

  // 채널 삭제 시 세션 정리
  client.on("channelDelete", async (channel: any) => {
    try {
      const channelId: string | undefined = channel?.id;
      if (!channelId) return;
      // public
      if (publicSessions.has(channelId)) publicSessions.delete(channelId);
    } catch (e) {
      console.error("channelDelete cleanup failed", e);
    }
  });
}
