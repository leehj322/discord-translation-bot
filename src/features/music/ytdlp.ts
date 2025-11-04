import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { logger, serializeError } from "../../core/logger.js";

export type ResolvedTrack = {
  title: string;
  webpageUrl: string;
  streamUrl: string;
  durationSec?: number;
  isLive?: boolean;
};

function isLikelyUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return !!u.protocol && !!u.host;
  } catch {
    return false;
  }
}

function buildInput(input: string): string {
  if (isLikelyUrl(input)) return input;
  // yt-dlp 검색 프리픽스: 첫 결과만
  return `ytsearch1:${input}`;
}

const COOKIE_FILE_PATH = process.env.YTDLP_COOKIES_PATH?.trim();
const COMMON_YOUTUBE_ARGS = ["no_client_sabr=yes"] as const;

type Attempt = {
  client: "web" | "android";
  format: string;
  cookieArgs: string[];
  youtubeArgs: string[];
};

async function prepareCookieArgs(): Promise<{
  args: string[];
  sourcePath?: string;
  tempPath?: string;
  cleanup: () => Promise<void>;
}> {
  if (!COOKIE_FILE_PATH) {
    return { args: [], cleanup: async () => {} };
  }

  const sourcePath = path.resolve(COOKIE_FILE_PATH);
  if (!fs.existsSync(sourcePath)) {
    logger.warn("music.ytdlp.cookie_missing", { sourcePath });
    return { args: [], sourcePath, cleanup: async () => {} };
  }

  const tempPath = path.join(
    os.tmpdir(),
    `ytdlp-cookies-${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.txt`
  );

  try {
    await fs.promises.copyFile(sourcePath, tempPath);
  } catch (error) {
    logger.warn("music.ytdlp.cookie_copy_failed", {
      sourcePath,
      tempPath,
      error: serializeError(error),
    });
    return { args: [], sourcePath, cleanup: async () => {} };
  }

  return {
    args: ["--cookies", tempPath],
    sourcePath,
    tempPath,
    cleanup: async () => {
      try {
        await fs.promises.unlink(tempPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
          logger.warn("music.ytdlp.cookie_cleanup_failed", {
            tempPath,
            error: serializeError(err),
          });
        }
      }
    },
  };
}

export async function resolveTrack(input: string): Promise<ResolvedTrack> {
  const finalInput = buildInput(input);
  const cmd = getYtDlpCommand();
  const DEFAULT_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

  const cookieSpec = await prepareCookieArgs();
  const cookieArgs = cookieSpec.args;

  logger.debug("music.ytdlp.config", {
    cmd,
    cookie_path: cookieSpec.sourcePath || COOKIE_FILE_PATH || undefined,
    cookie_temp_path: cookieSpec.tempPath,
    cookie_file_exists:
      cookieSpec.sourcePath && fs.existsSync(cookieSpec.sourcePath)
        ? true
        : undefined,
    common_youtube_args: COMMON_YOUTUBE_ARGS,
  });

  function buildArgs(attempt: Attempt): string[] {
    const args = [
      "-f",
      attempt.format,
      "--no-playlist",
      "--user-agent",
      DEFAULT_UA,
      "--referer",
      "https://www.youtube.com/",
      "--geo-bypass",
      "--sleep-requests",
      "1",
      "--force-ipv4",
    ];

    const youtubeArgs = [...COMMON_YOUTUBE_ARGS, ...attempt.youtubeArgs];
    if (youtubeArgs.length > 0) {
      args.push("--extractor-args", `youtube:${youtubeArgs.join("&")}`);
    }

    if (attempt.cookieArgs.length > 0) {
      args.push(...attempt.cookieArgs);
    }

    args.push("--dump-json", finalInput);
    return args;
  }

  const attempts: Attempt[] = [];

  if (cookieArgs.length > 0) {
    attempts.push(
      {
        client: "web",
        format: "bestaudio/best",
        cookieArgs: [...cookieArgs],
        youtubeArgs: [],
      },
      {
        client: "android",
        format: "18",
        cookieArgs: [...cookieArgs],
        youtubeArgs: ["player_client=android"],
      }
    );
  }

  attempts.push(
    {
      client: "web",
      format: "bestaudio/best",
      cookieArgs: [],
      youtubeArgs: [],
    },
    {
      client: "android",
      format: "18",
      cookieArgs: [],
      youtubeArgs: ["player_client=android"],
    }
  );

  let json: any;
  let lastErr: unknown;
  try {
    for (const [attemptIndex, a] of attempts.entries()) {
      const args = buildArgs(a);
      const extractorArgsCombined = (() => {
        const idx = args.indexOf("--extractor-args");
        return idx >= 0 ? args[idx + 1] : undefined;
      })();
      logger.debug("music.ytdlp.exec", {
        cmd,
        client: a.client,
        format: a.format,
        cookie_file: a.cookieArgs.length > 0 ? cookieSpec.tempPath : undefined,
        cookie_source_path:
          a.cookieArgs.length > 0 ? cookieSpec.sourcePath : undefined,
        youtube_args: a.youtubeArgs,
        extractor_args_combined: extractorArgsCombined,
        args_preview: args.slice(0, 6),
        input,
      });
      try {
        json = await runAndCollectJson(cmd, args);
        logger.info("music.ytdlp.attempt.success", {
          attempt_index: attemptIndex,
          client: a.client,
          format: a.format,
          used_cookies: a.cookieArgs.length > 0 ? true : undefined,
          cookie_source_path:
            a.cookieArgs.length > 0 ? cookieSpec.sourcePath : undefined,
          extractor_args: extractorArgsCombined,
        });
        break;
      } catch (e) {
        logger.warn("music.ytdlp.attempt.failed", {
          attempt_index: attemptIndex,
          client: a.client,
          format: a.format,
          used_cookies: a.cookieArgs.length > 0 ? true : undefined,
          cookie_source_path:
            a.cookieArgs.length > 0 ? cookieSpec.sourcePath : undefined,
          extractor_args: extractorArgsCombined,
          error: serializeError(e),
        });
        lastErr = e;
        continue;
      }
    }
  } finally {
    await cookieSpec.cleanup();
  }
  if (!json)
    throw lastErr instanceof Error ? lastErr : new Error("yt-dlp failed");

  const streamUrl: string = json.url;
  const title: string = json.title ?? json.fulltitle ?? "unknown";
  const webpageUrl: string =
    json.webpage_url ?? json.original_url ?? finalInput;
  const isLive: boolean | undefined = json.is_live ?? undefined;
  const durationSec: number | undefined =
    typeof json.duration === "number" ? json.duration : undefined;
  const track: ResolvedTrack = { title, webpageUrl, streamUrl };
  if (durationSec !== undefined) track.durationSec = durationSec;
  if (isLive !== undefined) track.isLive = isLive;
  logger.info("music.ytdlp.resolved", {
    title,
    webpageUrl,
    isLive: isLive === true ? true : undefined,
    durationSec: typeof durationSec === "number" ? durationSec : undefined,
  });
  return track;
}

function getYtDlpCommand(): string {
  const cwd = process.cwd();
  const bin = path.join(cwd, "bin");
  const candidates =
    process.platform === "win32"
      ? [
          path.join(bin, "yt-dlp.exe"),
          path.join(bin, "yt-dlp"),
          "yt-dlp.exe",
          "yt-dlp",
        ]
      : [path.join(bin, "yt-dlp"), "yt-dlp"];
  for (const c of candidates) {
    try {
      if (!c.includes(path.sep)) return c; // PATH 후보는 바로 반환
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return "yt-dlp";
}

async function runAndCollectJson(cmd: string, args: string[]): Promise<any> {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (d) => (stdout += String(d)));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (d) => (stderr += String(d)));
  const code: number = await new Promise((resolve) => {
    child.on("close", (c) => resolve(c ?? 0));
  });
  if (code !== 0) {
    const stderrSample = (stderr || stdout || "").slice(0, 800);
    logger.error("music.ytdlp.exit_nonzero", {
      code,
      stderr_sample: stderrSample,
    });
    const err = new Error(`yt-dlp failed (${code})`);
    (err as any).code = code;
    throw err;
  }
  try {
    return JSON.parse(stdout.trim());
  } catch (e) {
    logger.error("music.ytdlp.json_parse_failed", {
      error: serializeError(e),
      stdout_sample: stdout.slice(0, 800),
    });
    throw new Error(
      `Failed to parse yt-dlp JSON: ${String((e as any)?.message || e)}`
    );
  }
}
