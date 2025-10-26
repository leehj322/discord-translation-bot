import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const translateCommandDefs = [
  new SlashCommandBuilder()
    .setName("auto")
    .setDescription("채널 자동 번역을 활성화합니다 (ko↔jp 자동 감지)."),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("채널 자동 번역을 해제합니다.")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  new SlashCommandBuilder()
    .setName("usage")
    .setDescription("번역 API 요청 수 요약을 표시합니다 (관리자 전용).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());
