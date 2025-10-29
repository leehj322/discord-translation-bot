import { assertConfig, token } from "./config/index.js";
import { createDiscordClient, onceClientReadyEvent } from "./core/client.js";
import { registerInteractionHandler } from "./handlers/interactions.js";
import { registerMessageHandler } from "./handlers/messages.js";
import { startHealthServer } from "./core/http.js";
import { logger, serializeError, getLogLevel } from "./core/logger.js";

assertConfig();

// 글로벌 에러 핸들러
process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", serializeError(err));
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", {
    reason:
      reason instanceof Error ? serializeError(reason) : { value: reason },
  });
});

const client = createDiscordClient();

// 부팅 환경 로깅
logger.info("boot", {
  node_env: process.env.NODE_ENV || "",
  log_level: getLogLevel(),
});


client.once(onceClientReadyEvent, () => {
  logger.info("discord client ready", { user: client.user?.tag });
});

registerInteractionHandler(client);
registerMessageHandler(client);

client.login(token).catch((err) => {
  logger.error("client.login failed", serializeError(err));
});

startHealthServer();
