import { SlashCommandBuilder } from "discord.js";

export const musicCommandDefs = [
  new SlashCommandBuilder()
    .setName("music")
    .setDescription("음악 재생/관리 명령어")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("노래 링크를 재생목록에 추가하고 재생")
        .addStringOption((opt) =>
          opt
            .setName("url")
            .setDescription("재생할 노래(오디오)의 URL")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("pause").setDescription("현재 재생을 일시정지/재개")
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("모든 노래를 중지하고 대기열 비우기")
    ),
].map((c) => c.toJSON());
