import "dotenv/config";
import { REST, Routes } from "discord.js";

const clientId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.env.DISCORD_GUILD_ID;
const token = process.env.DISCORD_TOKEN;

if (!clientId || !token) {
  console.error("Missing DISCORD_CLIENT_ID or DISCORD_TOKEN");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  try {
    // 1) 길드 명령 제거 (guildId가 설정된 경우)
    if (guildId) {
      console.log(
        `Clearing application (guild) commands for guild=${guildId}...`
      );
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: [],
      });
      console.log("Successfully cleared application (guild) commands.");
    } else {
      console.log(
        "DISCORD_GUILD_ID not set; skipping guild command clear (global will still be cleared)."
      );
    }

    // 2) 전역 명령 제거 (항상 수행)
    console.log("Clearing application (global) commands...");
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log("Successfully cleared application (global) commands.");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
