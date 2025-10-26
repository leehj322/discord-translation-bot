import { PermissionFlagsBits, EmbedBuilder, type Client } from "discord.js";
import { publicSessions } from "../features/translate/sessions.js";
import { getUsageSummary } from "../features/usage/usage.js";

export function registerInteractionHandler(client: Client): void {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === "auto") {
      if (!interaction.channel) {
        return interaction.reply({
          content: "채널 컨텍스트가 필요합니다.",
          ephemeral: true,
        });
      }

      const member = await interaction.guild!.members.fetch(
        interaction.user.id
      );
      const canManage =
        member.permissions.has(PermissionFlagsBits.ManageChannels) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild);
      if (!canManage) {
        return interaction.reply({
          content: "자동 번역 활성화는 관리자만 실행할 수 있습니다.",
          ephemeral: true,
        });
      }
      publicSessions.set(interaction.channel!.id, {
        enabledBy: interaction.user.id,
      });
      return interaction.reply({
        content: `자동 번역 활성화: 이 채널의 한국어↔일본어 메시지가 교차 번역됩니다.`,
      });
    }

    if (commandName === "stop") {
      if (!interaction.channel)
        return interaction.reply({
          content: "채널 컨텍스트가 필요합니다.",
          ephemeral: true,
        });
      const member = interaction.guild
        ? await interaction.guild.members.fetch(interaction.user.id)
        : null;
      const canManage =
        !!member &&
        (member.permissions.has(PermissionFlagsBits.ManageChannels) ||
          member.permissions.has(PermissionFlagsBits.ManageGuild));
      let stopped: string[] = [];
      if (canManage && publicSessions.has(interaction.channel!.id)) {
        publicSessions.delete(interaction.channel!.id);
        stopped.push("public");
      }
      if (stopped.length === 0) {
        return interaction.reply({
          content: "중지할 public 세션이 없습니다.",
          ephemeral: true,
        });
      }
      return interaction.reply({
        content: `자동 번역이 해제되었습니다.`,
        ephemeral: true,
      });
    }

    if (commandName === "usage") {
      const member = await interaction.guild!.members.fetch(
        interaction.user.id
      );
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: "권한이 없습니다.",
          ephemeral: true,
        });
      }
      const summaryArgs: {
        guildId?: string;
        channelId?: string;
        userId?: string;
      } = { userId: interaction.user.id };
      if (interaction.guild) summaryArgs.guildId = interaction.guild.id;
      if (interaction.channel) summaryArgs.channelId = interaction.channel.id;
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

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  });
}
