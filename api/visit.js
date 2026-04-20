const { Redis } = require('@upstash/redis');

const GEO_APIS = [
  { url: 'https://ipapi.co', format: 'ipapi' },
  { url: 'http://ip-api.com/json', format: 'ip-api' },
];
const REDIS_KEY = 'kiraa:visit:coords';
const MAX_COORDS = 5000;

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

function getClientIP(req) {
  const cfIP = req.headers['cf-connecting-ip'];
  if (cfIP) {
    return cfIP.trim();
  }
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
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

async function geoLocateFromIPAPI(ip) {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'success' || data.lat == null || data.lon == null) {
      return null;
    }
    return { lat: data.lat, lon: data.lon };
  } catch {
    return null;
  }
}

async function geoLocateFromIPAPICo(ip) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || data.latitude == null || data.longitude == null) {
      return null;
    }
    return { lat: data.latitude, lon: data.longitude };
  } catch {
    return null;
  }
}

async function geoLocate(ip) {
  if (isPrivateIP(ip)) {
    console.log('[visit] Private IP skipped:', ip);
    return null;
  }
  const result = await geoLocateFromIPAPICo(ip);
  if (result) {
    console.log('[visit] Geolocated via ipapi.co:', ip, '→', result.lat, result.lon);
    return result;
  }
  const fallback = await geoLocateFromIPAPI(ip);
  if (fallback) {
    console.log('[visit] Geolocated via ip-api.com:', ip, '→', fallback.lat, fallback.lon);
    return fallback;
  }
  console.log('[visit] Geolocation failed for IP:', ip);
  return null;
}

async function storeCoord(redis, lon, lat) {
  try {
    const coord = `${lon.toFixed(2)},${lat.toFixed(2)}`;
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
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (isNaN(lon) || isNaN(lat)) return null;
        return [lon, lat];
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
    const ip = getClientIP(req);
    console.log('[visit] Request IP:', ip, 'Headers:', {
      'cf-connecting-ip': req.headers['cf-connecting-ip'] || '(none)',
      'x-real-ip': req.headers['x-real-ip'] || '(none)',
      'x-forwarded-for': req.headers['x-forwarded-for'] || '(none)',
    });

    const geo = await geoLocate(ip);

    if (geo) {
      await storeCoord(redis, geo.lon, geo.lat);
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
