// 번역 관련 슬래시 커맨드 정의
// - /auto: 자동 번역 활성화
// - /stop: 자동 번역 해제
// - /usage: 번역 API 요청/문자 수 요약 표시(관리자 권한 필요)
//
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const translateCommandDefs = [
  new SlashCommandBuilder()
    .setName("translate")
    .setDescription("번역 관련 명령어")
    .addSubcommand((sub) =>
      sub
        .setName("auto")
        .setDescription("현재 채널의 자동 번역을 활성화 합니다. (ko + jp)")
    )
    .addSubcommand((sub) =>
      sub.setName("stop").setDescription("채널 자동 번역을 해제합니다.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("usage")
        .setDescription("번역 API 요청 수 요약을 표시합니다 (관리자 전용).")
    ),
].map((c) => c.toJSON());
