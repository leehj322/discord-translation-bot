import { getSupabase } from "../../core/supabase.js";

type Counters = {
  total: number;
  guild: Map<string, number>;
  channel: Map<string, number>;
  user: Map<string, number>;
  charsTotal: number;
  charsGuild: Map<string, number>;
  charsChannel: Map<string, number>;
  charsUser: Map<string, number>;
};

let inMemory: Counters = {
  total: 0,
  guild: new Map(),
  channel: new Map(),
  user: new Map(),
  charsTotal: 0,
  charsGuild: new Map(),
  charsChannel: new Map(),
  charsUser: new Map(),
};

let apiCallsTotal = 0;

async function persistIncrement({
  kind,
  id,
}: {
  kind: "total" | "guild" | "channel" | "user";
  id?: string;
}) {
  const supa = getSupabase();
  if (!supa) return; // gracefully skip if not configured
  const table = "usage_counters";
  // Schema suggestion: id (pk text), kind (text), value (int8), updated_at (timestamptz)
  const key = kind === "total" ? "total" : `${kind}:${id}`;
  await supa.rpc("usage_increment", { p_key: key });
}

async function persistCharsIncrement({
  kind,
  id,
  delta,
}: {
  kind: "total" | "guild" | "channel" | "user";
  id?: string;
  delta: number;
}) {
  const supa = getSupabase();
  if (!supa) return;
  // Suggest an RPC: usage_add_chars(p_key text, p_delta bigint)
  const key = kind === "total" ? "total" : `${kind}:${id}`;
  await supa.rpc("usage_add_chars", { p_key: key, p_delta: delta });
}

export function incrUsage({
  guildId,
  channelId,
  userId,
}: {
  guildId?: string;
  channelId?: string;
  userId?: string;
}) {
  inMemory.total += 1;
  if (guildId)
    inMemory.guild.set(guildId, (inMemory.guild.get(guildId) || 0) + 1);
  if (channelId)
    inMemory.channel.set(channelId, (inMemory.channel.get(channelId) || 0) + 1);
  if (userId) inMemory.user.set(userId, (inMemory.user.get(userId) || 0) + 1);
  // fire-and-forget persistence
  persistIncrement({ kind: "total" }).catch(() => {});
  if (guildId) persistIncrement({ kind: "guild", id: guildId }).catch(() => {});
  if (channelId)
    persistIncrement({ kind: "channel", id: channelId }).catch(() => {});
  if (userId) persistIncrement({ kind: "user", id: userId }).catch(() => {});
}

export function addCharUsage({
  guildId,
  channelId,
  userId,
  chars,
}: {
  guildId?: string;
  channelId?: string;
  userId?: string;
  chars: number;
}) {
  if (!Number.isFinite(chars) || chars <= 0) return;
  inMemory.charsTotal += chars;
  if (guildId)
    inMemory.charsGuild.set(
      guildId,
      (inMemory.charsGuild.get(guildId) || 0) + chars
    );
  if (channelId)
    inMemory.charsChannel.set(
      channelId,
      (inMemory.charsChannel.get(channelId) || 0) + chars
    );
  if (userId)
    inMemory.charsUser.set(
      userId,
      (inMemory.charsUser.get(userId) || 0) + chars
    );
  // persist
  persistCharsIncrement({ kind: "total", delta: chars }).catch(() => {});
  if (guildId)
    persistCharsIncrement({ kind: "guild", id: guildId, delta: chars }).catch(
      () => {}
    );
  if (channelId)
    persistCharsIncrement({
      kind: "channel",
      id: channelId,
      delta: chars,
    }).catch(() => {});
  if (userId)
    persistCharsIncrement({ kind: "user", id: userId, delta: chars }).catch(
      () => {}
    );
}

async function fetchCounter(key: string): Promise<number> {
  const supa = getSupabase();
  if (!supa) return 0;
  const { data, error } = await supa
    .from("usage_counters")
    .select("value")
    .eq("id", key)
    .maybeSingle();
  if (error || !data) return 0;
  return Number(data.value) || 0;
}

export function getUsageSummary({
  guildId,
  channelId,
  userId,
}: {
  guildId?: string;
  channelId?: string;
  userId?: string;
}) {
  return {
    total: inMemory.total,
    guild: guildId ? inMemory.guild.get(guildId) || 0 : undefined,
    channel: channelId ? inMemory.channel.get(channelId) || 0 : undefined,
    user: userId ? inMemory.user.get(userId) || 0 : undefined,
    charsTotal: inMemory.charsTotal,
    charsGuild: guildId ? inMemory.charsGuild.get(guildId) || 0 : undefined,
    charsChannel: channelId
      ? inMemory.charsChannel.get(channelId) || 0
      : undefined,
    charsUser: userId ? inMemory.charsUser.get(userId) || 0 : undefined,
  };
}

export function incrApiCalls(): number {
  apiCallsTotal += 1;
  // optional: persist a separate metric key
  persistIncrement({ kind: "total" }).catch(() => {});
  return apiCallsTotal;
}
