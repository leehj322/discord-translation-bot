import {
  PermissionFlagsBits,
  EmbedBuilder,
  type Client,
  type ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { publicSessions } from "../features/translate/sessions.js";
import { getUsageSummary } from "../features/translate/usage.js";
// 음악 기능 제거됨
import { logger, serializeError } from "../core/logger.js";
import {
  enqueue as musicEnqueue,
  getQueue as musicGetQueue,
  skip as musicSkip,
  onChannelDelete as musicOnChannelDelete,
  maybeLeaveIfChannelEmpty,
  stop as musicStop,
} from "../features/music/player.js";

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
      flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await safeReply(cmd, {
    content: `자동 번역이 해제되었습니다.`,
    flags: MessageFlags.Ephemeral,
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
    await safeReply(cmd, {
      content: "권한이 없습니다.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const summaryArgs: { guildId?: string; channelId?: string; userId?: string } =
    {
      userId: cmd.user.id,
    };
  if (cmd.guild) summaryArgs.guildId = cmd.guild.id;
  if (cmd.channel) summaryArgs.channelId = cmd.channel.id;
  const s = await getUsageSummary(summaryArgs);

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

  await safeReply(cmd, { embeds: [embed], flags: MessageFlags.Ephemeral });
}

/**
 * Discord 상호작용(슬래시 커맨드) 핸들러 등록
 * - 명령어별 전용 함수로 위임하여 유지보수 용이성 향상
 * - 중복 처리 방지를 위해 interaction ID 단위 디듀플리케이션 적용
 */
export function registerInteractionHandler(client: Client): void {
  if (registeredClients.has(client)) return;
  registeredClients.add(client);
  client.on("interactionCreate", async (interaction) => {
    // 음악 관련 명령 핸들링

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
      if (sub === "play") return handleMusicPlay(cmd);
      if (sub === "skip") return handleMusicSkip(cmd);
      if (sub === "clear") return handleMusicClear(cmd);
      if (sub === "list") return handleMusicList(cmd);
      return;
    }
  });

  // 채널 삭제 시 음악 큐 정리
  client.on("channelDelete", (channel) => {
    try {
      musicOnChannelDelete(channel.id);
    } catch (e) {
      logger.error("music channelDelete handler failed", serializeError(e));
    }
  });

  // 보이스 상태 변경 시 즉시 점검하여 빈 채널이면 종료
  client.on("voiceStateUpdate", async (_old, now) => {
    try {
      await maybeLeaveIfChannelEmpty(now.guild);
    } catch (e) {
      logger.error("music voiceStateUpdate handler failed", serializeError(e));
    }
  });
}

async function handleMusicPlay(
  cmd: ChatInputCommandInteraction
): Promise<void> {
  const query = cmd.options.getString("query", true);
  const member = await cmd.guild!.members.fetch(cmd.user.id);
  const voice = member.voice?.channel;
  if (!voice) {
    await safeReply(cmd, {
      content: "먼저 음성 채널에 접속해주세요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // 1) 즉시 defer(에페메럴)로 타임아웃 방지
  if (!cmd.deferred && !cmd.replied) {
    try {
      await cmd.deferReply({ ephemeral: true });
    } catch {}
  }
  try {
    const item = await musicEnqueue(cmd.guild!, voice, query);
    // 2) 성공 시 채널에 공개 메시지로 안내(서식화)
    const addedLines: string[] = [];
    addedLines.push(":notes: **Queue Added**");
    addedLines.push(`> [${item.title}](${item.webpageUrl})`);
    const addedMsg = addedLines.join("\n");
    if (cmd.channel && (cmd.channel as any).send) {
      await (cmd.channel as any).send({ content: addedMsg });
    }
    // 초기 에페메럴 응답 제거(있으면)
    try {
      await cmd.deleteReply();
    } catch {}
  } catch (e) {
    // 실패 시에는 에페메럴로 오류 안내
    try {
      if (cmd.deferred || cmd.replied) {
        await cmd.editReply({
          content: "에러가 발생하였습니다. 관리자에게 문의해주세요.",
        });
      } else {
        await safeReply(cmd, {
          content: "에러가 발생하였습니다. 관리자에게 문의해주세요.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch {}
  }
}

async function handleMusicSkip(
  cmd: ChatInputCommandInteraction
): Promise<void> {
  musicSkip(cmd.guild!.id);
  await safeReply(cmd, { content: "현재 재생 중인 음악을 건너뜁니다." });
}
async function handleMusicClear(
  cmd: ChatInputCommandInteraction
): Promise<void> {
  musicStop(cmd.guild!.id);
  await safeReply(cmd, { content: "모든 대기열을 제거했습니다." });
}

async function handleMusicList(
  cmd: ChatInputCommandInteraction
): Promise<void> {
  const { now, queue, startedAt } = musicGetQueue(cmd.guild!.id);
  if (!now && queue.length === 0) {
    await safeReply(cmd, {
      content: "대기열이 비었습니다.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const lines: string[] = [];
  lines.push(":notes: **Now Playing**");
  lines.push(`> ▶ ${now ? `[${now.title}](${now.webpageUrl})` : "-"}`);
  if (now && typeof now.durationSec === "number") {
    const elapsed =
      startedAt != null
        ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
        : 0;
    const clamped = Math.min(elapsed, now.durationSec);
    lines.push(
      `> :clock10: ${formatDuration(clamped)} / ${formatDuration(
        now.durationSec
      )}`
    );
  }
  lines.push("━━━━━━━━━━━━━━━");
  if (queue.length > 0) {
    lines.push(":scroll: **Queue**");
    for (const q of queue.slice(0, 50)) {
      lines.push(`${queue.indexOf(q) + 1}. [${q.title}](${q.webpageUrl})`);
    }
  }
  const body = lines.join("\n");
  await safeReply(cmd, {
    content: body,
    flags: (MessageFlags.Ephemeral | MessageFlags.SuppressEmbeds) as number,
  });
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
