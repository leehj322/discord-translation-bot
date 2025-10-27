import { assertConfig, token } from "./config/index.js";
import { createDiscordClient, onceClientReadyEvent } from "./core/client.js";
import { registerInteractionHandler } from "./handlers/interactions.js";
import { registerMessageHandler } from "./handlers/messages.js";
import { startHealthServer } from "./core/http.js";

assertConfig();

const client = createDiscordClient();

client.once(onceClientReadyEvent, () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

registerInteractionHandler(client);
registerMessageHandler(client);

client.login(token);

startHealthServer();
