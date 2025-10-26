type Counters = {
  total: number;
  guild: Map<string, number>;
  channel: Map<string, number>;
  user: Map<string, number>;
};

let inMemory: Counters = {
  total: 0,
  guild: new Map(),
  channel: new Map(),
  user: new Map(),
};

let apiCallsTotal = 0;

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
  };
}

export function incrApiCalls(): number {
  apiCallsTotal += 1;
  return apiCallsTotal;
}
