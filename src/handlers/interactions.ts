import {
  PermissionFlagsBits,
  EmbedBuilder,
  type Client,
  type ChatInputCommandInteraction,
} from "discord.js";
import { publicSessions } from "../features/translate/sessions.js";
import { getUsageSummary } from "../features/translate/usage.js";
import {
  enqueueTrack,
  pauseGuild,
  resumeGuild,
  clearGuild,
  setMusicClient,
} from "../features/music/player.js";
import { logger } from "../core/logger.js";

const registeredClients = new WeakSet<Client>();
const processedInteractionIds = new Set<string>();

/**
 * 안전한 응답 유틸리티.
 * - 이미 응답/지연된 상호작용이면 followUp로 전송
 * - 특정 Discord API 오류(Unknown interaction, Already acknowledged)는 무시
 */
async function safeReply(
  i: ChatInputCommandInteraction,
  options: any
): Promise<any> {
  try {
    if (i.replied || i.deferred) {
      return await i.followUp(options);
    }
    return await i.reply(options);
  } catch (e: any) {
    const code = e?.code ?? e?.rawError?.code;
    if (code === 10062 || code === 40060) {
      // Unknown interaction or already acknowledged: ignore
      return;
    }
    throw e;
  }
}

/**
 * /auto 명령 처리: 채널 자동 번역 활성화
 */
async function handleAutoCommand(
  cmd: ChatInputCommandInteraction
): Promise<void> {
  if (!cmd.channel) {
    await safeReply(cmd, {
      content: "채널 컨텍스트가 필요합니다.",
      ephemeral: true,
    });
    return;
  }
  const member = await cmd.guild!.members.fetch(cmd.user.id);
  const canManage =
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild);
  if (!canManage) {
    await safeReply(cmd, {
      content: "자동 번역 활성화는 관리자만 실행할 수 있습니다.",
      ephemeral: true,
    });
    return;
  }
  publicSessions.set(cmd.channel!.id, { enabledBy: cmd.user.id });
  await safeReply(cmd, { content: `자동 번역 활성화 (ko ↔ jp)` });
}

/**
 * /stop 명령 처리: 채널 자동 번역 비활성화
 */
async function handleStopCommand(
  cmd: ChatInputCommandInteraction
): Promise<void> {
  if (!cmd.channel) {
    await safeReply(cmd, {
      content: "채널 컨텍스트가 필요합니다.",
      ephemeral: true,
    });
    return;
  }
  const member = cmd.guild ? await cmd.guild.members.fetch(cmd.user.id) : null;
  const canManage =
    !!member &&
    (member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild));
  let stopped: string[] = [];
  if (canManage && publicSessions.has(cmd.channel!.id)) {
    publicSessions.delete(cmd.channel!.id);
    stopped.push("public");
  }
  if (stopped.length === 0) {
    await safeReply(cmd, {
      content: "중지할 번역 세션이 없습니다.",
      ephemeral: true,
    });
    return;
  }
  await safeReply(cmd, {
    content: `자동 번역이 해제되었습니다.`,
    ephemeral: true,
  });
}

/**
 * /usage 명령 처리: 번역 사용량 요약 표시(관리자 전용)
 */
async function handleUsageCommand(
  cmd: ChatInputCommandInteraction
): Promise<void> {
  const member = await cmd.guild!.members.fetch(cmd.user.id);
  if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await safeReply(cmd, { content: "권한이 없습니다.", ephemeral: true });
    return;
  }
  const summaryArgs: { guildId?: string; channelId?: string; userId?: string } =
    {
      userId: cmd.user.id,
    };
  if (cmd.guild) summaryArgs.guildId = cmd.guild.id;
  if (cmd.channel) summaryArgs.channelId = cmd.channel.id;
  const s = getUsageSummary(summaryArgs);

  const embed = new EmbedBuilder()
    .setTitle("번역 사용량 요약")
    .setColor(0x5865f2)
    .addFields(
      { name: "총 요청 수", value: String(s.total), inline: true },
      {
        name: "이 채널 요청 수",
        value: s.channel != null ? String(s.channel) : "-",
        inline: true,
      },
      { name: "총 문자 수", value: String(s.charsTotal), inline: true },
      {
        name: "이 채널 문자 수",
        value: s.charsChannel != null ? String(s.charsChannel) : "-",
        inline: true,
      }
    )
    .setFooter({ text: "관리자 전용" })
    .setTimestamp(new Date());

  await safeReply(cmd, { embeds: [embed], ephemeral: true });
}

/**
 * Discord 상호작용(슬래시 커맨드) 핸들러 등록
 * - 명령어별 전용 함수로 위임하여 유지보수 용이성 향상
 * - 중복 처리 방지를 위해 interaction ID 단위 디듀플리케이션 적용
 */
export function registerInteractionHandler(client: Client): void {
  if (registeredClients.has(client)) return;
  registeredClients.add(client);
  setMusicClient(client);
  client.on("interactionCreate", async (interaction) => {
    // 버튼 상호작용 처리 (음악 패널용)
    if (interaction.isButton()) {
      const { customId } = interaction;
      const guildId = interaction.guildId!;
      if (customId === "music:pause") {
        const toggled =
          (await pauseGuild(guildId)) || (await resumeGuild(guildId));
        try {
          await interaction.deferUpdate();
        } catch (e) {
          logger.warn("button deferUpdate failed", {
            feature: "music",
            guildId,
            button: customId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }
      if (customId === "music:clear") {
        await clearGuild(guildId);
        try {
          await interaction.deferUpdate();
        } catch (e) {
          logger.warn("button deferUpdate failed", {
            feature: "music",
            guildId,
            button: customId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    if (processedInteractionIds.has(interaction.id)) return;
    processedInteractionIds.add(interaction.id);
    setTimeout(() => processedInteractionIds.delete(interaction.id), 60_000);
    const cmd: ChatInputCommandInteraction = interaction;
    const { commandName } = cmd;

    // translate 그룹
    if (commandName === "translate") {
      const sub = cmd.options.getSubcommand();
      if (sub === "auto") return handleAutoCommand(cmd);
      if (sub === "stop") return handleStopCommand(cmd);
      if (sub === "usage") return handleUsageCommand(cmd);
      return;
    }

    // music 그룹
    if (commandName === "music") {
      const sub = cmd.options.getSubcommand();
      if (sub === "play") {
        const vc = (cmd.member as any)?.voice?.channel;
        if (!vc) {
          return safeReply(cmd, {
            content: "먼저 음성 채널에 접속해 주세요.",
            ephemeral: true,
          });
        }
        const url = cmd.options.getString("url", true);
        logger.info("music play requested", {
          feature: "music",
          guildId: cmd.guildId!,
          channelId: cmd.channelId!,
          userId: cmd.user.id,
          voiceChannelId: vc.id,
          url,
        });
        try {
          await enqueueTrack({
            client,
            guildId: cmd.guildId!,
            voiceChannelId: vc.id,
            adapterCreator: vc.guild.voiceAdapterCreator,
            textChannelId: cmd.channelId!,
            track: { url, requestedBy: cmd.user.id },
          });
        } catch (e) {
          logger.error("enqueueTrack failed", {
            feature: "music",
            guildId: cmd.guildId!,
            channelId: cmd.channelId!,
            userId: cmd.user.id,
            url,
            error: e instanceof Error ? e.message : String(e),
          });
          return safeReply(cmd, {
            content: "재생에 실패했습니다. URL 또는 권한/연결 상태를 확인해 주세요.",
            ephemeral: true,
          });
        }
        return safeReply(cmd, {
          content: `재생목록에 추가: ${url}`,
          ephemeral: true,
        });
      }
      if (sub === "pause") {
        const ok =
          (await pauseGuild(cmd.guildId!)) || (await resumeGuild(cmd.guildId!));
        return safeReply(cmd, {
          content: ok ? "토글됨" : "변경 없음",
          ephemeral: true,
        });
      }
      if (sub === "clear") {
        await clearGuild(cmd.guildId!);
        return safeReply(cmd, {
          content: "모든 노래를 중지했습니다.",
          ephemeral: true,
        });
      }
      return;
    }
  });
}
