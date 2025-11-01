import {
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from "@discordjs/voice";
import { Guild, VoiceBasedChannel } from "discord.js";
import prism from "prism-media";
import ffmpegPath from "ffmpeg-static";
import { resolveTrack, ResolvedTrack } from "./ytdlp.js";

// ffmpeg-static 경로를 prism FFmpeg가 사용하도록 설정
if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

export type QueueItem = ResolvedTrack;

type GuildMusicState = {
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: QueueItem[];
  now: QueueItem | null;
  startedAt: number | null;
  idleTimer: NodeJS.Timeout | null;
  occupancyInterval: NodeJS.Timeout | null;
  voiceChannelId: string;
  textChannelId?: string;
};

const guildStates = new Map<string, GuildMusicState>();

const IDLE_TIMEOUT_MS = 30_000; // 유휴시 자동 종료(30초)

export async function enqueue(
  guild: Guild,
  voiceChannel: VoiceBasedChannel,
  input: string
): Promise<QueueItem> {
  const item = await resolveTrack(input);
  const state = await getOrCreateState(guild, voiceChannel);
  state.queue.push(item);
  if (state.player.state.status === AudioPlayerStatus.Idle && !state.now) {
    void playNext(guild.id);
  }
  return item;
}

export function getQueue(guildId: string): {
  now?: QueueItem;
  queue: QueueItem[];
  startedAt?: number;
} {
  const s = guildStates.get(guildId);
  if (!s) return { queue: [] };
  const base = { queue: s.queue } as {
    now?: QueueItem;
    queue: QueueItem[];
    startedAt?: number;
  };
  if (s.now) {
    base.now = s.now;
    if (s.startedAt != null) base.startedAt = s.startedAt;
  }
  return base;
}

export function skip(guildId: string): void {
  const s = guildStates.get(guildId);
  if (!s) return;
  s.player.stop(true);
}

export function stop(guildId: string): void {
  const s = guildStates.get(guildId);
  if (!s) return;
  s.queue.length = 0;
  s.player.stop(true);
}

async function getOrCreateState(
  guild: Guild,
  voiceChannel: VoiceBasedChannel
): Promise<GuildMusicState> {
  const existing = guildStates.get(guild.id);
  if (existing) return existing;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  connection.on(
    VoiceConnectionStatus.Disconnected,
    async (oldState, newState) => {
      if (
        newState.reason === VoiceConnectionDisconnectReason.WebSocketClose &&
        newState.closeCode === 4014
      ) {
        try {
          await entersState(
            connection,
            VoiceConnectionStatus.Connecting,
            5_000
          );
        } catch {
          connection.destroy();
          guildStates.delete(guild.id);
        }
      } else if (connection.rejoinAttempts < 5) {
        await wait(5_000);
        connection.rejoin();
      } else {
        connection.destroy();
        guildStates.delete(guild.id);
      }
    }
  );

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
    },
  });

  connection.subscribe(player);

  const state: GuildMusicState = {
    connection,
    player,
    queue: [],
    now: null,
    startedAt: null,
    idleTimer: null,
    occupancyInterval: null,
    voiceChannelId: voiceChannel.id,
  };
  guildStates.set(guild.id, state);

  player.on(AudioPlayerStatus.Idle, () => {
    state.now = null;
    state.startedAt = null;
    if (state.queue.length > 0) {
      void playNext(guild.id);
    } else {
      // 유휴 종료
      if (state.idleTimer) clearTimeout(state.idleTimer);
      state.idleTimer = setTimeout(() => {
        try {
          connection.destroy();
        } finally {
          guildStates.delete(guild.id);
        }
      }, IDLE_TIMEOUT_MS);
    }
  });

  return state;
}

async function playNext(guildId: string): Promise<void> {
  const s = guildStates.get(guildId);
  if (!s) return;
  const next = s.queue.shift();
  if (!next) return;
  s.now = next;
  s.startedAt = Date.now();
  if (s.idleTimer) {
    clearTimeout(s.idleTimer);
    s.idleTimer = null;
  }

  // FFmpeg(PCM) -> Opus 인코더 파이프라인 구성
  const ffmpeg = new prism.FFmpeg({
    args: [
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
      "-i",
      next.streamUrl,
      "-analyzeduration",
      "0",
      "-loglevel",
      "0",
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
    ],
  });

  const opus = new prism.opus.Encoder({
    rate: 48_000,
    channels: 2,
    frameSize: 960,
  });
  const stream = ffmpeg.pipe(opus);

  const resource = createAudioResource(stream, { inputType: StreamType.Opus });
  s.player.play(resource);

  // 주기적으로 채널 점유 상태 확인(사람이 없으면 종료)
  ensureOccupancyWatcher(s, guildId);
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureOccupancyWatcher(state: GuildMusicState, guildId: string): void {
  if (state.occupancyInterval) return;
  state.occupancyInterval = setInterval(async () => {
    try {
      const guild =
        state.connection.joinConfig.guildId === guildId
          ? (state.connection as any).state?.subscription?.player?.guild
          : null;
      // 위 한 줄은 guild 참조가 없을 수 있으므로, fetch로 대체
    } catch {}
    try {
      // guild 인스턴스는 매개로 전달되지 않으므로, VoiceConnection의 joinConfig만으로 채널 멤버를 조회하기 위해 Guild 객체를 인자로 넘기지 못함.
      // 대신, Discord.js 캐시를 신뢰하지 않고 connection.receiver.voiceConnection.joinConfig.guildId를 사용해 안전히 조회하는 대신,
      // state.connection.joinConfig.guildId를 보유하고 있으므로, 해당 Guild는 외부에서 전달받는 것이 바람직하다.
      // 여기서는 간단히 VoiceChannel 객체를 connection.joinConfig.channelId로 재조회한다.
      const client: any = (state.connection as any).joinConfig?.adapterCreator
        ?.client;
      if (!client) return;
      const guild = client.guilds?.cache?.get(
        (state.connection as any).joinConfig.guildId
      );
      if (!guild) return;
      const channel =
        guild.channels.cache.get(state.voiceChannelId) ||
        (await guild.channels.fetch(state.voiceChannelId).catch(() => null));
      if (!channel || !("members" in channel)) {
        // 채널이 없거나 보이스 채널이 아니면 정리
        try {
          state.connection.destroy();
        } finally {
          clearIntervalSafe(state);
          guildStates.delete(guildId);
        }
        return;
      }
      const members = (channel as VoiceBasedChannel).members;
      const clientUserId = client.user?.id;
      const humanCount = Array.from(members.values()).filter(
        (m) => !m.user.bot && m.id !== clientUserId
      ).length;
      if (humanCount === 0) {
        // 큐 비우고 종료
        state.queue.length = 0;
        try {
          state.connection.destroy();
        } finally {
          clearIntervalSafe(state);
          guildStates.delete(guildId);
        }
      }
    } catch {}
  }, 3_000);
}

function clearIntervalSafe(state: GuildMusicState): void {
  if (state.occupancyInterval) {
    clearInterval(state.occupancyInterval);
    state.occupancyInterval = null;
  }
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
}

export function onChannelDelete(channelId: string): void {
  for (const [guildId, s] of guildStates) {
    if (s.voiceChannelId === channelId) {
      try {
        s.connection.destroy();
      } finally {
        clearIntervalSafe(s);
        guildStates.delete(guildId);
      }
    }
  }
}

export async function maybeLeaveIfChannelEmpty(guild: Guild): Promise<void> {
  const s = guildStates.get(guild.id);
  if (!s) return;
  const ch =
    guild.channels.cache.get(s.voiceChannelId) ||
    (await guild.channels.fetch(s.voiceChannelId).catch(() => null));
  if (!ch || !("members" in ch)) {
    try {
      s.connection.destroy();
    } finally {
      clearIntervalSafe(s);
      guildStates.delete(guild.id);
    }
    return;
  }
  const members = (ch as VoiceBasedChannel).members;
  const clientUserId = guild.client.user?.id;
  const humanCount = Array.from(members.values()).filter(
    (m) => !m.user.bot && m.id !== clientUserId
  ).length;
  if (humanCount === 0) {
    s.queue.length = 0;
    try {
      s.connection.destroy();
    } finally {
      clearIntervalSafe(s);
      guildStates.delete(guild.id);
    }
  }
}
