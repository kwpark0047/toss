// A single Redis Lua transaction owns admission, one-use authentication and settlement.
// Reservations are never refunded on missing usage/crash. No process-local production fallback.
const SCRIPT = `
local op=ARGV[1]
local now=tonumber(ARGV[2])
if op=='reserve' then
  local s=cjson.decode(ARGV[3])
  local old=redis.call('GET',KEYS[3])
  if old then return old end
  redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',now)
  local spent=tonumber(redis.call('HGET',KEYS[1],'spent') or '0')
  local reserved=tonumber(redis.call('HGET',KEYS[1],'reserved') or '0')
  local daily=tonumber(redis.call('HGET',KEYS[1],s.day) or '0')
  if spent+reserved+s.reservation>s.monthLimit or daily+s.seconds>s.dayLimit or redis.call('ZCARD',KEYS[2])>=s.concurrency then return redis.error_reply('LIVE_LIMIT') end
  redis.call('HINCRBY',KEYS[1],'reserved',s.reservation)
  redis.call('HINCRBY',KEYS[1],s.day,s.seconds)
  redis.call('EXPIRE',KEYS[1],7776000)
  redis.call('ZADD',KEYS[2],s.deadline,s.id)
  redis.call('EXPIRE',KEYS[2],86400)
  redis.call('SET',KEYS[3],ARGV[3],'EX',7776000)
  return ARGV[3]
end
local raw=redis.call('GET',KEYS[3])
if not raw then return redis.error_reply('LIVE_SESSION_MISSING') end
local s=cjson.decode(raw)
if op=='claim' then
  if s.state~='ready' or s.ticketHash~=ARGV[3] or s.origin~=ARGV[4] or s.ticketExpires<now then return redis.error_reply('LIVE_AUTH') end
  s.state='active'
elseif op=='finish' then
  if s.state=='closed' then return raw end
  local charged=math.max(s.reservation,tonumber(ARGV[3]))
  redis.call('HINCRBY',KEYS[1],'reserved',-s.reservation)
  redis.call('HINCRBY',KEYS[1],'spent',charged)
  redis.call('ZREM',KEYS[2],s.id)
  s.state='closed'; s.chargedMicros=charged; s.estimatedMicros=tonumber(ARGV[3]); s.reason=ARGV[4]
else return redis.error_reply('LIVE_OPERATION') end
local result=cjson.encode(s)
redis.call('SET',KEYS[3],result,'EX',7776000)
return result
`;
class RedisLiveStore {
  constructor(redis, prefix = 'wm:{ai-live}:') {
    this.redis = redis;
    this.prefix = prefix;
  }
  keys(s) {
    return [
      this.prefix + `budget:${s.storeId}:${s.month}`,
      this.prefix + `leases:${s.storeId}`,
      this.prefix + `session:${s.id}`,
    ];
  }
  async run(op, session, ...args) {
    if (!this.redis || this.redis.status !== 'ready')
      throw Error('Live reservation store unavailable');
    return JSON.parse(
      await this.redis.eval(SCRIPT, 3, ...this.keys(session), op, Date.now(), ...args)
    );
  }
  reserve(session) {
    return this.run('reserve', session, JSON.stringify(session));
  }
  async claim(id, hash, origin) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Live authentication failed');
    const raw = await this.redis.get(this.prefix + `session:${id}`);
    if (!raw) throw Error('Live authentication failed');
    const session = JSON.parse(raw);
    return this.run('claim', session, hash, origin);
  }
  finish(session, estimated, reason) {
    return this.run('finish', session, estimated, reason);
  }
  async recordUsage(session, sequence, usage, costMicros) {
    if (!this.redis || this.redis.status !== 'ready') throw Error('Live usage store unavailable');
    const details = (value) =>
      (value || []).map(({ modality, tokenCount }) => ({ modality, tokenCount }));
    const record = {
      at: Date.now(),
      pricingVersion: session.pricingVersion,
      costMicros,
      input: details(usage.promptTokensDetails),
      output: details(usage.responseTokensDetails),
      toolInput: details(usage.toolUsePromptTokensDetails),
      thoughts: usage.thoughtsTokenCount || 0,
      totalTokens: usage.totalTokenCount ?? null,
    };
    const key = this.prefix + `usage:${session.id}`;
    await this.redis.eval(
      "local inserted=redis.call('HSETNX',KEYS[1],ARGV[1],ARGV[2]); redis.call('EXPIRE',KEYS[1],7776000); return inserted",
      1,
      key,
      String(sequence),
      JSON.stringify(record)
    );
  }
  async auditTool(session, call, status) {
    if (!this.redis || this.redis.status !== 'ready') throw Error('Live audit store unavailable');
    const key = this.prefix + `tools:${session.id}`;
    const argsHash = require('node:crypto')
      .createHash('sha256')
      .update(JSON.stringify(call.args || {}))
      .digest('hex');
    await this.redis
      .multi()
      .hset(
        key,
        String(call.id).slice(0, 128),
        JSON.stringify({ name: String(call.name).slice(0, 80), argsHash, status, at: Date.now() })
      )
      .expire(key, 7776000)
      .exec()
      .then((result) => {
        if (result.some((row) => row[0])) throw Error('Live audit unavailable');
      });
  }
}
module.exports = { RedisLiveStore, SCRIPT };
