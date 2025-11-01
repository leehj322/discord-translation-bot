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
