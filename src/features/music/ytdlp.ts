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

export async function resolveTrack(input: string): Promise<ResolvedTrack> {
  const finalInput = buildInput(input);
  const cmd = getYtDlpCommand();
  const cookiesPath = process.env.YTDLP_COOKIES_PATH || "";
  const DEFAULT_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

  function buildArgs(
    playerClient: string,
    format: string,
    useCookies: boolean
  ): string[] {
    return [
      "-f",
      format,
      "--no-playlist",
      "--extractor-args",
      `youtube:player_client=${playerClient}`,
      ...(useCookies && cookiesPath ? ["--cookies", cookiesPath] : []),
      "--user-agent",
      DEFAULT_UA,
      "--referer",
      "https://www.youtube.com/",
      "--geo-bypass",
      "--sleep-requests",
      "1",
      "--force-ipv4",
      "--dump-json",
      finalInput,
    ];
  }

  // 1) web+cookies (가능하면)
  const attempts: Array<{
    client: string;
    format: string;
    withCookies: boolean;
  }> = [];
  if (cookiesPath)
    attempts.push({
      client: "web",
      format: "bestaudio/best",
      withCookies: true,
    });
  // 2) tv+cookies (web 실패 시)
  if (cookiesPath)
    attempts.push({
      client: "tv",
      format: "bestaudio/best",
      withCookies: true,
    });
  // 3) android+cookies 포맷 18 (봇확인 회피)
  if (cookiesPath)
    attempts.push({ client: "android", format: "18", withCookies: true });
  // 4) android(무쿠키) + 포맷 18 (최후 수단)
  attempts.push({ client: "android", format: "18", withCookies: false });

  let json: any;
  let lastErr: unknown;
  for (const a of attempts) {
    const args = buildArgs(a.client, a.format, a.withCookies);
    logger.debug("music.ytdlp.exec", {
      cmd,
      client: a.client,
      format: a.format,
      with_cookies: a.withCookies || undefined,
      args_preview: args.slice(0, 6),
      input,
    });
    try {
      json = await runAndCollectJson(cmd, args);
      break;
    } catch (e) {
      lastErr = e;
      continue;
    }
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
