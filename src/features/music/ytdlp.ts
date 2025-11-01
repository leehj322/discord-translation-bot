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
  // yt-dlp JSON 출력으로 메타+스트림 URL 확보(옵션1: 비계정 우선)
  const baseArgs = [
    "-f",
    "bestaudio/best",
    "--no-playlist",
    "--extractor-args",
    "youtube:player_client=android",
    "--geo-bypass",
    "--sleep-requests",
    "1",
    "--force-ipv4",
    "--dump-json",
    finalInput,
  ];
  const cmd = getYtDlpCommand();
  logger.debug("music.ytdlp.exec", { cmd, args_preview: baseArgs.slice(0, 6), input });

  let json: any;
  try {
    json = await runAndCollectJson(cmd, baseArgs);
  } catch (e) {
    // 옵션2: 쿠키가 제공된 경우 자동 재시도
    const cookiesPath = process.env.YTDLP_COOKIES_PATH;
    const cookiesBase64 = process.env.YTDLP_COOKIES_BASE64;
    if (!cookiesPath && !cookiesBase64) throw e;

    let tmpFile: string | null = null;
    let cookieFileToUse: string = cookiesPath || "";
    if (!cookieFileToUse && cookiesBase64) {
      try {
        const buf = Buffer.from(cookiesBase64, "base64");
        tmpFile = path.join(
          os.tmpdir(),
          `yt_cookies_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`
        );
        fs.writeFileSync(tmpFile, buf);
        cookieFileToUse = tmpFile;
      } catch (wErr) {
        logger.error("music.ytdlp.cookies_write_failed", serializeError(wErr));
      }
    }
    if (cookieFileToUse) {
      const cookieArgs = insertCookiesArg(baseArgs, cookieFileToUse);
      logger.info("music.ytdlp.retry_with_cookies", {
        use_env_path: cookiesPath ? true : undefined,
        used_tmpfile: tmpFile ? true : undefined,
      });
      try {
        json = await runAndCollectJson(cmd, cookieArgs);
      } catch (e2) {
        logger.error("music.ytdlp.retry_failed", serializeError(e2));
        throw e2;
      } finally {
        if (tmpFile) {
          try { fs.unlinkSync(tmpFile); } catch {}
        }
      }
    } else {
      // 쿠키 정보가 있었지만 파일 생성 실패 등으로 사용 불가
      throw e;
    }
  }
  // 포맷 선택에 따라 url 필드가 direct stream url
  const streamUrl: string = json.url;
  const title: string = json.title ?? json.fulltitle ?? "unknown";
  const webpageUrl: string = json.webpage_url ?? json.original_url ?? finalInput;
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
  const candidates = process.platform === "win32"
    ? [path.join(bin, "yt-dlp.exe"), path.join(bin, "yt-dlp"), "yt-dlp.exe", "yt-dlp"]
    : [path.join(bin, "yt-dlp"), "yt-dlp"];
  for (const c of candidates) {
    try {
      if (!c.includes(path.sep)) return c; // PATH 후보는 바로 반환
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return "yt-dlp";
}

function insertCookiesArg(args: string[], cookieFile: string): string[] {
  const out = [...args];
  // '--dump-json' 앞에 넣을 필요는 없지만, 가독성을 위해 앞쪽에 배치
  const insertAt = Math.max(0, out.indexOf("--dump-json"));
  out.splice(insertAt, 0, "--cookies", cookieFile);
  return out;
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
    throw new Error(`Failed to parse yt-dlp JSON: ${String((e as any)?.message || e)}`);
  }
}


