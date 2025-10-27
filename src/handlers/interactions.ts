import {
  PermissionFlagsBits,
  EmbedBuilder,
  type Client,
  type ChatInputCommandInteraction,
} from "discord.js";
import { publicSessions } from "../features/translate/sessions.js";
import { getUsageSummary } from "../features/usage/usage.js";

const registeredClients = new WeakSet<Client>();
const processedInteractionIds = new Set<string>();

export function registerInteractionHandler(client: Client): void {
  if (registeredClients.has(client)) return;
  registeredClients.add(client);
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (processedInteractionIds.has(interaction.id)) return;
    processedInteractionIds.add(interaction.id);
    setTimeout(() => processedInteractionIds.delete(interaction.id), 60_000);
    const cmd: ChatInputCommandInteraction = interaction;
    const { commandName } = cmd;

    async function safeReply(i: ChatInputCommandInteraction, options: any) {
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

    if (commandName === "auto") {
      if (!cmd.channel) {
        return safeReply(cmd, {
          content: "채널 컨텍스트가 필요합니다.",
          ephemeral: true,
        });
      }

      const member = await cmd.guild!.members.fetch(cmd.user.id);
      const canManage =
        member.permissions.has(PermissionFlagsBits.ManageChannels) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild);
      if (!canManage) {
        return safeReply(cmd, {
          content: "자동 번역 활성화는 관리자만 실행할 수 있습니다.",
          ephemeral: true,
        });
      }
      publicSessions.set(cmd.channel!.id, {
        enabledBy: cmd.user.id,
      });
      return safeReply(cmd, {
        content: `자동 번역 활성화: 이 채널의 한국어↔일본어 메시지가 교차 번역됩니다.`,
      });
    }

    if (commandName === "stop") {
      if (!cmd.channel)
        return safeReply(cmd, {
          content: "채널 컨텍스트가 필요합니다.",
          ephemeral: true,
        });
      const member = cmd.guild
        ? await cmd.guild.members.fetch(cmd.user.id)
        : null;
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
        return safeReply(cmd, {
          content: "중지할 public 세션이 없습니다.",
          ephemeral: true,
        });
      }
      return safeReply(cmd, {
        content: `자동 번역이 해제되었습니다.`,
        ephemeral: true,
      });
    }

    if (commandName === "usage") {
      const member = await cmd.guild!.members.fetch(cmd.user.id);
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return safeReply(cmd, {
          content: "권한이 없습니다.",
          ephemeral: true,
        });
      }
      const summaryArgs: {
        guildId?: string;
        channelId?: string;
        userId?: string;
      } = { userId: interaction.user.id };
      if (cmd.guild) summaryArgs.guildId = cmd.guild.id;
      if (cmd.channel) summaryArgs.channelId = cmd.channel.id;
      const s = getUsageSummary(summaryArgs);

      const embed = new EmbedBuilder()
        .setTitle("번역 사용량 요약")
        .setColor(0x5865f2)
        .addFields(
          { name: "총 요청 수", value: String(s.total), inline: true },
          {
            name: "이 채널",
            value: s.channel != null ? String(s.channel) : "-",
            inline: true,
          }
        )
        .setFooter({ text: "관리자 전용" })
        .setTimestamp(new Date());

      return safeReply(cmd, { embeds: [embed], ephemeral: true });
    }
  });
}
