const { Redis } = require('@upstash/redis');

const GEO_API = 'http://ip-api.com/json';
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
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

async function geoLocate(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    return null;
  }
  try {
    const res = await fetch(`${GEO_API}/${ip}?fields=status,lat,lon`);
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
    return res.status(503).json({
      error: 'Redis not configured',
      coords: [],
    });
  }

  try {
    const ip = getClientIP(req);
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
