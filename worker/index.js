/*
  PRODUCTION SERVER — a Cloudflare Worker at https://api.mushly.workers.dev
  The installed phone app sends its requests here (EXPO_PUBLIC_API_URL). The same handlers
  run in development inside the Expo dev server (src/app/api/*+api.js).

    POST /api/identify   photo → 3 candidate species
    GET  /api/species    ?q=&language=  species search ("none of these")
    POST /api/describe   photo + species → its book page

  API keys are Worker secrets (npx wrangler secret put GEMINI_API_KEY), never in the code.
  Each visitor address may send 10 photos and 60 searches a minute (LIMITS below); beyond
  that the app shows "too many requests, try again shortly" (code: rate-limit).
  Why a Worker and not Cloudflare Pages: *.pages.dev is blocked by several internet
  providers in Türkiye, *.workers.dev is not.
*/
import { DurableObject } from 'cloudflare:workers';
import { handleDescribe, handleIdentify, handleSearch } from '../server/identify.js';

// The phone app doesn't need these; they let the app's web preview call the server too.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body, status = 200) => Response.json(body, { status, headers: CORS });

// How many requests one visitor address may send per minute
const LIMITS = { photo: 10, search: 60 };
const WINDOW_MS = 60_000;

/*
  One tiny counter per visitor address and kind ("photo:1.2.3.4"). It remembers when the
  last requests came in and says no once there were too many in the past minute.
  (Cloudflare's built-in rate limiter was tried first; it's too approximate at this scale.)
*/
export class RateLimiter extends DurableObject {
  times = [];

  hit(limit) {
    const now = Date.now();
    this.times = this.times.filter((t) => now - t < WINDOW_MS);
    if (this.times.length >= limit) return false;
    this.times.push(now);
    return true;
  }
}

/** True when this visitor has used up their requests for the minute. */
async function overLimit(env, kind, request) {
  if (!env.LIMITER || env.RATE_LIMIT === 'off') return false; // e.g. running locally or benchmarking
  const visitor = request.headers.get('cf-connecting-ip') || 'unknown';
  try {
    const counter = env.LIMITER.get(env.LIMITER.idFromName(`${kind}:${visitor}`));
    return !(await counter.hit(LIMITS[kind]));
  } catch (err) {
    console.warn('[rate-limit] counter failed, allowing the request:', err?.message);
    return false; // never block people because the counter itself had a hiccup
  }
}

const TOO_MANY = { code: 'rate-limit', error: 'Too many requests. Please try again in a minute.' };

async function readJson(request) {
  return request.json().catch(() => null);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    switch (route) {
      case 'POST /api/identify': {
        if (await overLimit(env, 'photo', request)) return json(TOO_MANY, 429);
        const { status, body } = await handleIdentify(await readJson(request), env);
        return json(body, status);
      }
      case 'POST /api/describe': {
        if (await overLimit(env, 'photo', request)) return json(TOO_MANY, 429);
        const { status, body } = await handleDescribe(await readJson(request), env);
        return json(body, status);
      }
      case 'GET /api/species': {
        if (await overLimit(env, 'search', request)) return json(TOO_MANY, 429);
        const { status, body } = await handleSearch(url.searchParams.get('q'), url.searchParams.get('language'));
        return json(body, status);
      }
      case 'GET ':
      case 'GET /api/health':
        return json({ ok: true, app: 'mushly' });
      default:
        return json({ code: 'not-found', error: 'Not found.' }, 404);
    }
  },
};
