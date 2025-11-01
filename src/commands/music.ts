import { SlashCommandBuilder } from "discord.js";

export const musicCommandDefs = [
  new SlashCommandBuilder()
    .setName("music")
    .setDescription("음악 재생 명령어")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("URL 또는 검색어로 음악을 재생합니다.")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("URL 또는 검색어")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("skip").setDescription("현재 재생 중인 음악을 스킵합니다.")
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("모든 대기열을 제거합니다.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("현재 재생중인 음악과 대기열을 표시합니다.")
    ),
].map((c) => c.toJSON());
