import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
  // yt-dlp JSON 출력으로 메타+스트림 URL 확보
  const args = [
    "-f",
    "bestaudio/best",
    "--no-playlist",
    "--dump-json",
    finalInput,
  ];
  const json = await runAndCollectJson(getYtDlpCommand(), args);
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
    const err = new Error(`yt-dlp failed (${code}): ${stderr || stdout}`);
    (err as any).code = code;
    throw err;
  }
  try {
    return JSON.parse(stdout.trim());
  } catch (e) {
    throw new Error(`Failed to parse yt-dlp JSON: ${e}`);
  }
}


