import { createServer } from "node:http";
import { port } from "../config/index.js";
import { logger } from "./logger.js";

export function startHealthServer(): void {
  createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("ok\n");
  }).listen(port, () => {
    logger.info("health server listening", { port });
  });
}
