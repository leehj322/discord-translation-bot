import { getSupabase } from "../../core/supabase.js";
import { logger } from "../../core/logger.js";

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

/**
 * 증가 카운터를 영속 저장(RPC)합니다. 구성에 Supabase가 없으면 건너뜁니다.
 * @param params.kind 합산 차원("total" | "guild" | "channel" | "user")
 * @param params.id   차원이 guild/channel/user일 때의 식별자
 */
async function persistIncrement({
  kind,
  id,
}: {
  kind: "total" | "guild" | "channel" | "user";
  id?: string;
}) {
  const supa = getSupabase();
  if (!supa) return; // gracefully skip if not configured
  // Schema suggestion: id (pk text), kind (text), value (int8), updated_at (timestamptz)
  const key = kind === "total" ? "total" : `${kind}:${id}`;
  await supa.rpc("usage_increment", { p_key: key });
}

/**
 * 문자 수 증가를 영속 저장(RPC)합니다. 구성에 Supabase가 없으면 건너뜁니다.
 * @param params.kind 합산 차원("total" | "guild" | "channel" | "user")
 * @param params.id   차원이 guild/channel/user일 때의 식별자
 * @param params.delta 추가할 문자 수(양수만 처리)
 */
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

/**
 * 번역 요청 수 카운터를 메모리 및 DB(RPC)에 증가시킵니다.
 * 각 차원(total/guild/channel/user)에 대해 독립적으로 증가합니다.
 */
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

/**
 * 번역 텍스트 길이(문자 수)를 메모리 및 DB(RPC)에 누적합니다.
 * @param chars 누적할 문자 수(양수여야 함)
 */
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

/**
 * 번역 이벤트 1건을 Supabase 테이블(translate_usage)에 기록합니다.
 */
export async function recordUsageEvent({
  guildId,
  channelId,
  userId,
  userNickname,
  charCount,
}: {
  guildId?: string;
  channelId?: string;
  userId?: string;
  userNickname?: string;
  charCount: number;
}): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  const { error } = await supa.from("translation_usage").insert({
    timeStamp: new Date().toISOString(),
    charCount: charCount,
    guildId: guildId ?? null,
    channelId: channelId ?? null,
    userId: userId ?? null,
    userNickname: userNickname ?? null,
  } as any);
  if (error) {
    logger.error("recordUsageEvent insert failed", {
      feature: "translate",
      error: error.message,
    });
  }
}

/**
 * 현재 프로세스의 인메모리 카운터 스냅샷을 반환합니다.
 * 필요 시 DB 기반 합산으로 확장할 수 있습니다.
 */
export async function getUsageSummary({
  guildId,
  channelId,
  userId,
}: {
  guildId?: string;
  channelId?: string;
  userId?: string;
}): Promise<{
  total: number;
  guild?: number;
  channel?: number;
  user?: number;
  charsTotal: number;
  charsGuild?: number;
  charsChannel?: number;
  charsUser?: number;
}> {
  const supa = getSupabase();
  if (!supa) {
    const result: {
      total: number;
      guild?: number;
      channel?: number;
      user?: number;
      charsTotal: number;
      charsGuild?: number;
      charsChannel?: number;
      charsUser?: number;
    } = {
      total: inMemory.total,
      charsTotal: inMemory.charsTotal,
    };
    if (guildId) {
      result.guild = inMemory.guild.get(guildId) || 0;
      result.charsGuild = inMemory.charsGuild.get(guildId) || 0;
    }
    if (channelId) {
      result.channel = inMemory.channel.get(channelId) || 0;
      result.charsChannel = inMemory.charsChannel.get(channelId) || 0;
    }
    if (userId) {
      result.user = inMemory.user.get(userId) || 0;
      result.charsUser = inMemory.charsUser.get(userId) || 0;
    }
    return result;
  }

  const db = supa!;
  const totalQ = db
    .from("translation_usage")
    .select("charCount", { count: "exact", head: false });
  const { data: totalRows, count: totalCount, error: totalErr } = await totalQ;
  const charsTotal =
    totalRows?.reduce((s: number, r: any) => s + Number(r.charCount || 0), 0) ||
    0;
  if (totalErr)
    logger.warn("getUsageSummary total error", { error: totalErr.message });

  async function countAndSum(where: Record<string, string>) {
    const { data, count, error } = await db
      .from("translation_usage")
      .select("charCount", { count: "exact", head: false })
      .match(where);
    const sum =
      data?.reduce((s: number, r: any) => s + Number(r.charCount || 0), 0) || 0;
    if (error)
      logger.warn("getUsageSummary dim error", { where, error: error.message });
    return { count: count || 0, sum };
  }

  const result: any = { total: totalCount || 0, charsTotal };
  if (guildId) {
    const g = await countAndSum({ guildId: guildId });
    result.guild = g.count;
    result.charsGuild = g.sum;
  }
  if (channelId) {
    const c = await countAndSum({ channelId: channelId });
    result.channel = c.count;
    result.charsChannel = c.sum;
  }
  if (userId) {
    const u = await countAndSum({ userId: userId });
    result.user = u.count;
    result.charsUser = u.sum;
  }
  return result;
}

/**
 * 번역 API 호출 횟수를 증가시키고, 필요 시 total 카운터를 영속 저장합니다.
 * @returns 증가된 누적 API 호출 횟수
 */
export function incrApiCalls(): number {
  apiCallsTotal += 1;
  // optional: persist a separate metric key
  persistIncrement({ kind: "total" }).catch(() => {});
  return apiCallsTotal;
}
