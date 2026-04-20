const { Redis } = require('@upstash/redis');

const REDIS_KEY = 'kiraa:visit:coords';
const MAX_COORDS = 5000;
const ARBITRATION_DISTANCE_KM = 100;
const API_TIMEOUT_MS = 1500;
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
  if (!url || !token) {
    return null;
  }
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

function geoLocateFromCFHeader(req) {
  const cfLat = req.headers['cf-iplatitude'];
  const cfLon = req.headers['cf-iplongitude'];
  if (cfLat && cfLon) {
    const lat = parseFloat(cfLat);
    const lon = parseFloat(cfLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon, as: null, city: null, proxy: false, hosting: false };
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
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon,city,as,proxy,hosting`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'success' || data.lat == null || data.lon == null) return null;
    return {
      lat: data.lat, lon: data.lon,
      as: data.as || '', city: data.city || '',
      proxy: !!data.proxy, hosting: !!data.hosting,
    };
  } catch {
    return null;
  }
}

async function geoLocateFromIPAPICo(ip) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || data.latitude == null || data.longitude == null) return null;
    return { lat: data.latitude, lon: data.longitude, as: data.org || '', city: data.city || '', proxy: false, hosting: false };
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

function arbitrate(sources, req) {
  if (sources.length === 0) {
    const hasCFProxy = !!req.headers['cf-connecting-ip'];
    if (!hasCFProxy) {
      const vercelResult = geoLocateFromVercelHeader(req);
      if (vercelResult) {
        console.log('[visit] Arbitrated: Vercel Header (no other source)');
        return { ...vercelResult, isProxy: false };
      }
    }
    console.log('[visit] Arbitrated: no result');
    return null;
  }

  if (sources.length === 1) {
    const s = sources[0];
    console.log('[visit] Arbitrated: single source', s.source);
    return { lat: s.lat, lon: s.lon, isProxy: computeIsProxy(s) };
  }

  const cfSource = sources.find(s => s.source === 'CF');
  const apiSource = sources.find(s => s.source === 'ip-api');

  if (cfSource && apiSource) {
    const dist = haversineKm(cfSource.lat, cfSource.lon, apiSource.lat, apiSource.lon);
    const isProxy = computeIsProxy(apiSource);
    if (dist > ARBITRATION_DISTANCE_KM && isCarrierIP(apiSource.as)) {
      console.log('[visit] Arbitrated: ip-api wins (CF drift', dist.toFixed(0), 'km, carrier:', apiSource.as, ', isProxy:', isProxy, ')');
      return { lat: apiSource.lat, lon: apiSource.lon, isProxy };
    }
    console.log('[visit] Arbitrated: CF wins (dist', dist.toFixed(0), 'km, isProxy:', isProxy, ')');
    return { lat: cfSource.lat, lon: cfSource.lon, isProxy };
  }

  const best = sources[0];
  console.log('[visit] Arbitrated: fallback to', best.source);
  return { lat: best.lat, lon: best.lon, isProxy: computeIsProxy(best) };
}

async function geoLocate(req, ip) {
  const sources = [];

  const cfResult = geoLocateFromCFHeader(req);
  if (cfResult) {
    sources.push({ source: 'CF', ...cfResult });
  }

  if (!isPrivateIP(ip)) {
    const [bResult, cResult] = await Promise.allSettled([
      withTimeout(geoLocateFromIPAPIFull(ip), API_TIMEOUT_MS),
      withTimeout(geoLocateFromIPAPICo(ip), API_TIMEOUT_MS),
    ]);

    if (bResult.status === 'fulfilled' && bResult.value) {
      sources.push({ source: 'ip-api', ...bResult.value });
    }
    if (cResult.status === 'fulfilled' && cResult.value) {
      sources.push({ source: 'ipapi.co', ...cResult.value });
    }
  }

  return arbitrate(sources, req);
}

const MIGRATION_KEY = 'kiraa:visit:migrated_v4';

async function migrateOldFormat(redis) {
  try {
    const migrated = await redis.get(MIGRATION_KEY);
    if (migrated) return;
    const exists = await redis.exists(REDIS_KEY);
    if (exists) {
      console.log('[visit] One-time force clearing old data for v4 migration...');
      await redis.del(REDIS_KEY);
    }
    await redis.set(MIGRATION_KEY, '1');
    console.log('[visit] Migration v4 flag set, will not clear again.');
  } catch (err) {
    console.error('[visit] Migration error:', err.message);
  }
}

async function storeCoord(redis, lon, lat, isProxy) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const coord = `${lon.toFixed(3)},${lat.toFixed(3)},${day},${isProxy ? 1 : 0}`;
    const pipeline = redis.pipeline();
    pipeline.sadd(REDIS_KEY, coord);
    pipeline.scard(REDIS_KEY);
    const results = await pipeline.exec();
    const count = results[1];
    if (count > MAX_COORDS) {
      const all = await redis.smembers(REDIS_KEY);
      const excess = all.slice(0, all.length - MAX_COORDS);
      if (excess.length > 0) {
        await redis.srem(REDIS_KEY, ...excess);
      }
    }
  } catch (err) {
    console.error('[visit] Redis store error:', err.message);
  }
}

async function getAllCoords(redis) {
  try {
    const members = await redis.smembers(REDIS_KEY);
    return members
      .map((m) => {
        const parts = String(m).split(',');
        if (parts.length < 2) return null;
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        const day = parts[2] || '';
        const isProxy = parts.length >= 4 ? (parseInt(parts[3], 10) === 1 ? 1 : 0) : 0;
        if (isNaN(lon) || isNaN(lat)) return null;
        if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
        return [lon, lat, day, isProxy];
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[visit] Redis read error:', err.message);
    return [];
  }
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
    return res.status(503).json({
      error: 'Redis not configured',
      coords: [],
    });
  }

  try {
    await migrateOldFormat(redis);

    const ip = getClientIP(req);
    console.log('[visit] Request IP:', ip, 'Headers:', {
      'cf-connecting-ip': req.headers['cf-connecting-ip'] || '(none)',
      'cf-iplatitude': req.headers['cf-iplatitude'] || '(none)',
      'cf-iplongitude': req.headers['cf-iplongitude'] || '(none)',
      'x-vercel-ip-latitude': req.headers['x-vercel-ip-latitude'] || '(none)',
      'x-vercel-ip-longitude': req.headers['x-vercel-ip-longitude'] || '(none)',
      'x-forwarded-for': req.headers['x-forwarded-for'] || '(none)',
    });

    const geo = await geoLocate(req, ip);

    if (geo) {
      await storeCoord(redis, geo.lon, geo.lat, geo.isProxy || false);
    }

    const coords = await getAllCoords(redis);

    return res.status(200).json({
      count: coords.length,
      coords,
    });
  } catch (err) {
    console.error('[visit] Handler error:', err.message);
    return res.status(500).json({
      error: 'Internal server error',
      coords: [],
    });
  }
};
