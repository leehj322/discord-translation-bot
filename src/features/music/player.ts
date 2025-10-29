import type { Client, TextChannel } from "discord.js";
import { logger } from "../../core/logger.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  demuxProbe,
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnection,
  entersState,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { Readable } from "node:stream";

type Track = {
  url: string;
  title?: string;
  thumbnailUrl?: string;
  requestedBy?: string;
};

type GuildMusicState = {
  queue: Track[];
  player: AudioPlayer;
  connection: VoiceConnection | null;
  textChannelId: string | null;
  panelMessageId: string | null;
  isPaused: boolean;
};

const guildIdToState = new Map<string, GuildMusicState>();

function getOrCreateState(guildId: string): GuildMusicState {
  const existing = guildIdToState.get(guildId);
  if (existing) return existing;
  const player = createAudioPlayer();
  const state: GuildMusicState = {
    queue: [],
    player,
    connection: null,
    textChannelId: null,
    panelMessageId: null,
    isPaused: false,
  };
  guildIdToState.set(guildId, state);
  // 자동 재생 다음 트랙
  player.on(AudioPlayerStatus.Idle, () => {
    logger.debug("audio player idle, try next", { feature: "music", guildId });
    playNext(guildId).catch((e) => {
      logger.error("playNext failed after idle", {
        feature: "music",
        guildId,
        error: e instanceof Error ? e.message : String(e),
      });
    });
  });
  return state;
}

async function createResourceFromUrl(url: string) {
  const isYouTube =
    /(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)/i.test(url);
  if (isYouTube) {
    const ytdl = (await import("ytdl-core")).default as any;
    const ytStream = ytdl(url, {
      filter: "audioonly",
      quality: "highestaudio",
      highWaterMark: 1 << 25,
      dlChunkSize: 0,
    });
    const { stream, type } = await demuxProbe(ytStream as any);
    return createAudioResource(stream, { inputType: type });
  }

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    logger.error("audio fetch failed", {
      feature: "music",
      url,
      status: res.status,
      statusText: res.statusText,
    });
    throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`);
  }
  const nodeStream = Readable.fromWeb(res.body as any);
  const { stream, type } = await demuxProbe(nodeStream as any);
  return createAudioResource(stream, { inputType: type });
}

async function ensureConnection(
  guildId: string,
  voiceChannelId: string,
  adapterCreator: any
): Promise<VoiceConnection> {
  const state = getOrCreateState(guildId);
  if (state.connection) return state.connection;
  const conn = joinVoiceChannel({
    channelId: voiceChannelId,
    guildId,
    adapterCreator,
    selfDeaf: false,
  });
  await entersState(conn, VoiceConnectionStatus.Ready, 30_000).catch((e) => {
    logger.error("voice connection not ready", {
      feature: "music",
      guildId,
      voiceChannelId,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  });
  conn.subscribe(state.player);
  state.connection = conn;
  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
        entersState(conn, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      logger.warn("voice disconnected, cleaning up", {
        feature: "music",
        guildId,
      });
      cleanupGuild(guildId);
    }
  });
  return conn;
}

function cleanupGuild(guildId: string) {
  const state = guildIdToState.get(guildId);
  if (!state) return;
  try {
    state.player.stop(true);
  } catch {}
  try {
    state.connection?.destroy();
  } catch {}
  guildIdToState.delete(guildId);
}

async function playNext(guildId: string): Promise<void> {
  const state = guildIdToState.get(guildId);
  if (!state) return;
  const next = state.queue.shift();
  if (!next) {
    // 큐가 비었으면 정리까진 하지 않고 대기
    state.isPaused = false;
    await updatePanel(guildId).catch((e) => {
      logger.warn("update panel failed (idle)", {
        feature: "music",
        guildId,
        error: e instanceof Error ? e.message : String(e),
      });
    });
    return;
  }
  const resource = await createResourceFromUrl(next.url);
  state.player.play(resource);
  state.isPaused = false;
  await updatePanel(guildId, next).catch((e) => {
    logger.warn("update panel failed (now playing)", {
      feature: "music",
      guildId,
      url: next.url,
      error: e instanceof Error ? e.message : String(e),
    });
  });
}

export async function enqueueTrack({
  client,
  guildId,
  voiceChannelId,
  adapterCreator,
  textChannelId,
  track,
}: {
  client: Client;
  guildId: string;
  voiceChannelId: string;
  adapterCreator: any;
  textChannelId: string;
  track: Track;
}): Promise<void> {
  const state = getOrCreateState(guildId);
  state.textChannelId = textChannelId;
  state.queue.push(track);
  await ensureConnection(guildId, voiceChannelId, adapterCreator);
  if (state.player.state.status === AudioPlayerStatus.Idle) {
    await playNext(guildId).catch((e) => {
      logger.error("playNext failed (enqueue)", {
        feature: "music",
        guildId,
        url: track.url,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    });
  } else {
    await updatePanel(guildId).catch((e) => {
      logger.warn("update panel failed (enqueue)", {
        feature: "music",
        guildId,
        error: e instanceof Error ? e.message : String(e),
      });
    });
  }
}

export async function pauseGuild(guildId: string): Promise<boolean> {
  const state = guildIdToState.get(guildId);
  if (!state) return false;
  if (state.isPaused) return true;
  state.isPaused = state.player.pause();
  await updatePanel(guildId).catch((e) => {
    logger.warn("update panel failed (pause)", {
      feature: "music",
      guildId,
      error: e instanceof Error ? e.message : String(e),
    });
  });
  return state.isPaused;
}

export async function resumeGuild(guildId: string): Promise<boolean> {
  const state = guildIdToState.get(guildId);
  if (!state) return false;
  const ok = state.player.unpause();
  if (ok) state.isPaused = false;
  await updatePanel(guildId).catch((e) => {
    logger.warn("update panel failed (resume)", {
      feature: "music",
      guildId,
      error: e instanceof Error ? e.message : String(e),
    });
  });
  return ok;
}

export async function clearGuild(guildId: string): Promise<void> {
  const state = guildIdToState.get(guildId);
  if (!state) return;
  state.queue = [];
  state.player.stop(true);
  try {
    state.connection?.destroy();
  } catch {}
  state.connection = null;
  await updatePanel(guildId).catch((e) => {
    logger.warn("update panel failed (clear)", {
      feature: "music",
      guildId,
      error: e instanceof Error ? e.message : String(e),
    });
  });
}

async function updatePanel(guildId: string, now?: Track): Promise<void> {
  const state = guildIdToState.get(guildId);
  if (!state || !state.textChannelId) return;
  const client = globalThisClient;
  if (!client) return;
  const channel = (await client.channels.fetch(
    state.textChannelId
  )) as TextChannel | null;
  if (!channel) return;
  const embed = {
    title: now ? "지금 재생 중" : state.isPaused ? "일시정지됨" : "대기 중",
    description: now
      ? `[링크 열기](${now.url})` + (now.title ? `\n${now.title}` : "")
      : state.queue.length > 0
      ? `대기열: ${state.queue.length}곡`
      : "대기열이 비어 있습니다",
    color: 0x2ecc71,
    image: now?.thumbnailUrl ? { url: now.thumbnailUrl } : undefined,
    timestamp: new Date().toISOString(),
  } as any;
  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          custom_id: "music:pause",
          label: "⏯ 일시정지/재개",
        },
        { type: 2, style: 4, custom_id: "music:clear", label: "🗑 전체정지" },
      ],
    },
  ];
  if (state.panelMessageId) {
    try {
      const msg = await channel.messages.fetch(state.panelMessageId);
      await msg.edit({ embeds: [embed], components });
      return;
    } catch (e) {
      logger.warn("panel edit failed, will resend", {
        feature: "music",
        guildId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  const sent = await channel.send({ embeds: [embed], components });
  state.panelMessageId = sent.id;
}

// 간단한 전역 Client 참조(패널 갱신용)
let globalThisClient: Client | null = null;
export function setMusicClient(client: Client) {
  globalThisClient = client;
}
