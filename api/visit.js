const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const ARBITRATION_DISTANCE_KM = 100;
const API_TIMEOUT_MS = 1500;
const HEAT_DAYS = 30;
const CIRCUIT_BREAKER_KEY = 'geo:circuit_breaker';
const CIRCUIT_BREAKER_TTL = 60;
const MIGRATION_KEY = 'kiraa:visit:migrated_v7';

const CARRIER_KEYWORDS = [
  'china mobile', 'china unicom', 'china telecom',
  'mobile', 'unicom', 'telecom', '5g',
  'cmcc', 'cucc', 'ctcc',
];
const CLOUD_KEYWORDS = [
  'amazon', 'aws', 'azure', 'microsoft', 'google cloud', 'gcp',
  'digitalocean', 'hetzner', 'linode', 'akamai', 'ovh',
  'vultr', 'oracle cloud', 'alibaba cloud', 'aliyun', 'tencent cloud',
];
const VERCEL_GATEWAY_PREFIXES = ['35.241.', '34.120.', '34.151.'];

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isPrivateIP(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('fc00:') || ip.startsWith('fe80:')) return true;
  return false;
}

function isVercelGateway(ip) {
  return VERCEL_GATEWAY_PREFIXES.some(p => ip.startsWith(p));
}

function getClientIP(req) {
  const candidates = [
    req.headers['cf-connecting-ip'],
    req.headers['x-real-ip'],
    req.headers['x-forwarded-for']?.split(',')[0],
    req.socket?.remoteAddress,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const ip = raw.trim();
    if (!ip || isPrivateIP(ip) || isVercelGateway(ip)) continue;
    return ip;
  }
  return '127.0.0.1';
}

function generateFingerprint(ip, ua, lang) {
  const raw = `${ip}|${ua || ''}|${lang || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 8);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isCarrierIP(asField) {
  if (!asField) return false;
  const lower = asField.toLowerCase();
  return CARRIER_KEYWORDS.some(kw => lower.includes(kw));
}

function isCloudProvider(asField) {
  if (!asField) return false;
  const lower = asField.toLowerCase();
  return CLOUD_KEYWORDS.some(kw => lower.includes(kw));
}

async function isCircuitBreakerActive(redis) {
  return !!(await redis.get(CIRCUIT_BREAKER_KEY));
}

async function triggerCircuitBreaker(redis) {
  await redis.set(CIRCUIT_BREAKER_KEY, '1', { ex: CIRCUIT_BREAKER_TTL });
  console.log('[visit] Circuit breaker triggered for', CIRCUIT_BREAKER_TTL, 's');
}

async function fetchWithRetry(url, timeoutMs, retries) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await withTimeout(fetch(url), timeoutMs);
      if (res.status === 429) throw new Error('429 Rate Limited');
      if (!res.ok) { if (i === retries) return null; continue; }
      return res;
    } catch (err) {
      if (err.message === '429 Rate Limited') throw err;
      if (i === retries) return null;
    }
  }
  return null;
}

function geoLocateFromCFHeader(req) {
  const cfLat = req.headers['cf-iplatitude'];
  const cfLon = req.headers['cf-iplongitude'];
  if (cfLat && cfLon) {
    const lat = parseFloat(cfLat);
    const lon = parseFloat(cfLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon, as: null, city: null, proxy: false, hosting: false, offset: null };
    }
  }
  return null;
}

function geoLocateFromVercelHeader(req) {
  const vLat = req.headers['x-vercel-ip-latitude'];
  const vLon = req.headers['x-vercel-ip-longitude'];
  if (vLat && vLon) {
    const lat = parseFloat(vLat);
    const lon = parseFloat(vLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon };
    }
  }
  return null;
}

async function geoLocateFromIPAPIFull(ip) {
  try {
    const res = await fetchWithRetry(
      `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,as,proxy,hosting,offset`,
      API_TIMEOUT_MS, 2
    );
    if (!res) return null;
    const data = await res.json();
    if (data.status !== 'success' || data.lat == null || data.lon == null) return null;
    return {
      lat: data.lat, lon: data.lon,
      as: data.as || '', city: data.city || '',
      proxy: !!data.proxy, hosting: !!data.hosting,
      offset: data.offset ?? null,
    };
  } catch (err) {
    if (err.message === '429 Rate Limited') return 'RATE_LIMITED';
    return null;
  }
}

async function geoLocateFromIPAPICo(ip) {
  try {
    const res = await withTimeout(fetch(`https://ipapi.co/${ip}/json/`), API_TIMEOUT_MS);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || data.latitude == null || data.longitude == null) return null;
    return { lat: data.latitude, lon: data.longitude, as: data.org || '', city: data.city || '', proxy: false, hosting: false, offset: null };
  } catch {
    return null;
  }
}

function computeIsProxy(source) {
  if (!source) return false;
  if (source.proxy || source.hosting) return true;
  if (isCloudProvider(source.as)) return true;
  return false;
}

function computeType(geoResult, clientTzOffset) {
  if (!geoResult) return 0;
  if (geoResult.isProxy) return 1;
  if (clientTzOffset != null && geoResult.offset != null) {
    const timeDiff = Math.abs((geoResult.offset / 60) + clientTzOffset);
    if (timeDiff > 30) return 1;
  }
  return 0;
}

function arbitrate(sources, req) {
  if (sources.length === 0) {
    const hasCFProxy = !!req.headers['cf-connecting-ip'];
    if (!hasCFProxy) {
      const vercelResult = geoLocateFromVercelHeader(req);
      if (vercelResult) {
        console.log('[visit] Arbitrated: Vercel Header (no other source)');
        return { ...vercelResult, isProxy: false, offset: null };
      }
    }
    console.log('[visit] Arbitrated: no result');
    return null;
  }

  if (sources.length === 1) {
    const s = sources[0];
    console.log('[visit] Arbitrated: single source', s.source);
    return { lat: s.lat, lon: s.lon, isProxy: computeIsProxy(s), offset: s.offset || null };
  }

  const cfSource = sources.find(s => s.source === 'CF');
  const apiSource = sources.find(s => s.source === 'ip-api');

  if (cfSource && apiSource) {
    const dist = haversineKm(cfSource.lat, cfSource.lon, apiSource.lat, apiSource.lon);
    const isProxy = computeIsProxy(apiSource);
    if (dist > ARBITRATION_DISTANCE_KM && isCarrierIP(apiSource.as)) {
      console.log('[visit] Arbitrated: ip-api wins (CF drift', dist.toFixed(0), 'km, carrier:', apiSource.as, ')');
      return { lat: apiSource.lat, lon: apiSource.lon, isProxy, offset: apiSource.offset };
    }
    console.log('[visit] Arbitrated: CF wins (dist', dist.toFixed(0), 'km)');
    return { lat: cfSource.lat, lon: cfSource.lon, isProxy, offset: apiSource.offset };
  }

  const best = sources[0];
  console.log('[visit] Arbitrated: fallback to', best.source);
  return { lat: best.lat, lon: best.lon, isProxy: computeIsProxy(best), offset: best.offset || null };
}

async function geoLocate(req, ip) {
  const sources = [];
  let ipApiRateLimited = false;

  const cfResult = geoLocateFromCFHeader(req);
  if (cfResult) sources.push({ source: 'CF', ...cfResult });

  if (!isPrivateIP(ip)) {
    const [bResult, cResult] = await Promise.allSettled([
      geoLocateFromIPAPIFull(ip),
      geoLocateFromIPAPICo(ip),
    ]);

    if (bResult.status === 'fulfilled' && bResult.value === 'RATE_LIMITED') {
      ipApiRateLimited = true;
    } else if (bResult.status === 'fulfilled' && bResult.value) {
      sources.push({ source: 'ip-api', ...bResult.value });
    }
    if (cResult.status === 'fulfilled' && cResult.value) {
      sources.push({ source: 'ipapi.co', ...cResult.value });
    }
  }

  const result = arbitrate(sources, req);
  if (result) result._rateLimited = ipApiRateLimited;
  return result;
}

async function migrateOldFormat(redis) {
  try {
    const migrated = await redis.get(MIGRATION_KEY);
    if (migrated) return;
    const oldKeys = ['kiraa:visit:coords', 'kiraa:visit:migrated_v3', 'kiraa:visit:migrated_v4'];
    await redis.del(...oldKeys);
    console.log('[visit] Cleared old architecture keys');
    await redis.set(MIGRATION_KEY, '1');
    console.log('[visit] Migration v7 flag set');
  } catch (err) {
    console.error('[visit] Migration error:', err.message);
  }
}

async function getHeatmapData(redis) {
  const now = new Date();
  const keys = [];
  for (let i = 0; i < HEAT_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(`geo:heat:${d.toISOString().split('T')[0]}`);
  }

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.hgetall(key);
  }
  const results = await pipeline.exec();

  const merged = {};
  for (const result of results) {
    if (!result || typeof result !== 'object') continue;
    for (const [field, weight] of Object.entries(result)) {
      const w = parseInt(weight, 10);
      if (isNaN(w) || w <= 0) continue;
      merged[field] = (merged[field] || 0) + w;
    }
  }

  const coords = [];
  for (const [field, weight] of Object.entries(merged)) {
    const colonIdx = field.lastIndexOf(':');
    if (colonIdx === -1) continue;
    const lonLat = field.substring(0, colonIdx);
    const typeStr = field.substring(colonIdx + 1);
    const [lonStr, latStr] = lonLat.split(',');
    const lon = parseFloat(lonStr);
    const lat = parseFloat(latStr);
    const type = parseInt(typeStr, 10);
    if (isNaN(lon) || isNaN(lat) || isNaN(type)) continue;
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) continue;
    coords.push([lon, lat, type, weight]);
  }
  return coords;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const redis = getRedis();
  if (!redis) {
    console.warn('[visit] Redis not configured');
    return res.status(503).json({ error: 'Redis not configured', coords: [] });
  }

  try {
    await migrateOldFormat(redis);

    const ip = getClientIP(req);
    const ua = req.headers['user-agent'] || '';
    const lang = req.headers['accept-language'] || '';
    const fp = generateFingerprint(ip, ua, lang);
    const today = new Date().toISOString().split('T')[0];
    const uvKey = `geo:uv:${today}`;
    const heatKey = `geo:heat:${today}`;

    const breakerActive = await isCircuitBreakerActive(redis);

    let isNewDevice = false;
    if (!breakerActive) {
      const added = await redis.sadd(uvKey, fp);
      if (added === 1) {
        isNewDevice = true;
        await redis.expire(uvKey, 7 * 86400);
      }
    }

    if (isNewDevice) {
      const clientTzOffset = req.query.tzOffset ? parseInt(req.query.tzOffset, 10) : null;
      const geo = await geoLocate(req, ip);

      if (geo && geo._rateLimited) {
        await triggerCircuitBreaker(redis);
      }

      if (geo) {
        const type = computeType(geo, clientTzOffset);
        const field = `${geo.lon.toFixed(3)},${geo.lat.toFixed(3)}:${type}`;
        await redis.hincrby(heatKey, field, 1);
        await redis.expire(heatKey, 31 * 86400);
        console.log('[visit] New device:', fp, '→', field, 'type:', type);
      }
    } else {
      console.log('[visit] Returning device or breaker active:', fp);
    }

    const coords = await getHeatmapData(redis);
    return res.status(200).json({ count: coords.length, coords });
  } catch (err) {
    console.error('[visit] Handler error:', err.message);
    return res.status(500).json({ error: 'Internal server error', coords: [] });
  }
};
