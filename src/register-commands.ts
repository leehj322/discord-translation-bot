// 슬래시 커맨드 등록 스크립트(글로벌 등록) - TypeScript
import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commandDefs } from "./commands.js";

const clientId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.env.DISCORD_GUILD_ID; // 지정 시 길드 등록(즉시 반영)
const token = process.env.DISCORD_TOKEN;

if (!clientId || !token) {
  console.error("Missing DISCORD_CLIENT_ID or DISCORD_TOKEN");
  process.exit(1);
}

const commands = commandDefs;

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  try {
    if (guildId) {
      console.log(
        `Started refreshing application (guild) commands for guild=${guildId}.`
      );
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log("Successfully reloaded application (guild) commands.");
      // 중복 방지: 이전에 전역 등록했던 명령이 남아 있으면 길드 내에서 중복으로 보일 수 있음
      // 길드 등록 시 전역 명령을 비워 중복을 방지한다.
      try {
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log(
          "Cleared application (global) commands to avoid duplicates."
        );
      } catch (clearErr) {
        console.warn("Failed to clear global commands (non-fatal)", clearErr);
      }
    } else {
      console.log("Started refreshing application (global) commands.");
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("Successfully reloaded application (global) commands.");
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
