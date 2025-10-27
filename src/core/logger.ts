import { env } from "node:process";

type LogLevel = "debug" | "info" | "warn" | "error";

function nowIso(): string {
  return new Date().toISOString();
}

function base(meta?: Record<string, unknown>) {
  return meta ? { ...meta } : undefined;
}

function write(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): void {
  const payload: Record<string, unknown> = {
    level,
    time: nowIso(),
    msg: message,
    ...base(meta),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const NODE_ENV = env.NODE_ENV || "development";
const isDev = NODE_ENV !== "production";

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (isDev) write("debug", message, meta);
  },
  info(message: string, meta?: Record<string, unknown>): void {
    write("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    write("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown> | Error): void {
    if (meta instanceof Error) {
      write("error", message, {
        name: meta.name,
        message: meta.message,
        stack: meta.stack,
      });
      return;
    }
    write("error", message, meta);
  },
};

export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { value: err };
}
