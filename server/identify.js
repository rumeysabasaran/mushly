/*
  SPECIES RECOGNITION — SERVER SIDE

  This file runs ONLY on the server:
  - During development: inside the Expo dev server (src/app/api/identify+api.js)
  - In production: inside Cloudflare Pages Functions (functions/api/identify.js)

  API keys are used here and are never sent to the phone. The phone posts the photo
  to /api/identify; this code adds the key, forwards the photo to the service, then
  filters the reply and sends it back.

  AUTOMATIC FALLBACK CHAIN
  Services whose key is set in .env are tried in order:
      1. Gemini  (GEMINI_API_KEY)     — free, default (gemini-3.5-flash-lite)
      2. Evren   (EVREN_API_KEY)      — free fallback (qwen3-vl-30b)
      3. Claude  (ANTHROPIC_API_KEY)  — paid fallback
  If a service fails (out of credit, quota reached, no reply…) the next one is tried.
  To change the order: RECOGNIZER_ORDER=evren,gemini
  With no keys at all, the dev server runs in demo mode.
*/
import { lacksTurkishLetters, pageTexts, sanitizeCandidate, sanitizeResult } from '../src/services/safety.js';
import { IdentifyError, buildDescribePrompt, buildPrompt, normalizeLanguage, resultSchema } from './prompt.js';
import { enrichCandidates, searchSpecies } from './inaturalist.js';
import { askEvren, DEFAULT_EVREN_MODEL } from './providers/evren.js';
import { askGemini, DEFAULT_GEMINI_MODEL } from './providers/gemini.js';
import { askClaude, CLAUDE_MODEL } from './providers/claude.js';
import { askWorkersAI, DEFAULT_WORKERS_AI_MODEL } from './providers/workersai.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (the phone already shrinks photos to ~300 KB)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Order chosen by measurement (scripts/benchmark): Gemini Flash-Lite was the most accurate
// and fast; Evren qwen3-vl-30b is the fastest reliable fallback.
const DEFAULT_ORDER = ['gemini', 'evren', 'claude'];

// These errors are caused by the photo itself; switching services won't help.
const NO_FALLBACK = new Set(['too-large']);

/** Each service's key and how to call it */
const PROVIDERS = {
  evren: (env) =>
    env.EVREN_API_KEY && {
      name: 'evren',
      label: `Evren · ${env.EVREN_MODEL || DEFAULT_EVREN_MODEL}`,
      ask: (input) => askEvren({ ...input, apiKey: env.EVREN_API_KEY, model: env.EVREN_MODEL || DEFAULT_EVREN_MODEL }),
    },
  gemini: (env) =>
    env.GEMINI_API_KEY && {
      name: 'gemini',
      label: `Gemini · ${env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL}`,
      ask: (input) => askGemini({ ...input, apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL }),
    },
  // Cloudflare's own GPUs; only inside the Worker, and only when asked for in RECOGNIZER_ORDER
  workersai: (env) =>
    env.AI && {
      name: 'workersai',
      label: `Workers AI · ${env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL}`,
      ask: (input) => askWorkersAI({ ...input, ai: env.AI, model: env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL }),
    },
  claude: (env) =>
    env.ANTHROPIC_API_KEY && {
      name: 'claude',
      label: `Claude · ${CLAUDE_MODEL}`,
      ask: (input) => askClaude({ ...input, apiKey: env.ANTHROPIC_API_KEY }),
    },
};

/** Returns the services that have a key, in the order they should be tried. */
export function pickProviders(env) {
  const order = env.RECOGNIZER_ORDER
    ? env.RECOGNIZER_ORDER.split(',').map((s) => s.trim().toLowerCase())
    : DEFAULT_ORDER;
  return order.map((name) => PROVIDERS[name]?.(env)).filter(Boolean);
}

/**
 * Validates the request, tries the services in order, and returns the filtered result.
 * Always returns { status, body }; the caller turns it into an HTTP response.
 */
export async function handleIdentify(body, env) {
  const providers = pickProviders(env);
  if (providers.length === 0) {
    return reply(500, { code: 'no-key', error: 'No API key is configured on the server.' });
  }

  const image = body?.image;
  const mediaType = body?.mediaType;
  if (typeof image !== 'string' || !image || !ALLOWED_TYPES.includes(mediaType)) {
    return reply(400, { code: 'bad-request', error: 'The photo could not be read.' });
  }
  if (image.length * 0.75 > MAX_IMAGE_BYTES) {
    return reply(413, { code: 'too-large', error: 'The photo is too large.' });
  }

  const language = normalizeLanguage(body?.language);
  const input = { image, mediaType, prompt: buildPrompt(language), schema: resultSchema(language) };

  let lastError = null;
  let withoutLetters = null; // a reply in Turkish without Turkish letters, used only if nothing better comes
  for (const provider of providers) {
    try {
      const raw = await provider.ask(input);
      if (lastError) console.info(`[identify] Fallback service used: ${provider.label}`);
      if (badTurkish(raw?.candidates?.[0], language)) {
        console.warn(`[identify] ${provider.label} wrote Turkish without Turkish letters; trying the next service`);
        withoutLetters ??= raw;
        continue;
      }
      return reply(200, await groundResult(raw, language));
    } catch (err) {
      if (!(err instanceof IdentifyError)) {
        console.error(`[identify] ${provider.label} unexpected error:`, err);
        lastError = new IdentifyError('unknown', 'An unexpected error occurred.', 500);
      } else {
        console.warn(`[identify] ${provider.label} failed: ${err.code}`);
        lastError = err;
        if (NO_FALLBACK.has(err.code)) break;
      }
    }
  }

  if (withoutLetters) return reply(200, await groundResult(withoutLetters, language));
  // No service succeeded: report the last error
  return reply(lastError.status, { code: lastError.code, error: lastError.message });
}

/**
 * Filters a raw reply, grounds its candidates in iNaturalist (names, photos) and
 * filters again, so iNaturalist data passes the same safety rules as the AI's.
 */
export async function groundResult(raw, language) {
  const clean = sanitizeResult(raw);
  const { candidates, grounded } = await enrichCandidates(clean.candidates, language);
  // grounded: false tells the phone to look the names up in iNaturalist itself
  return { ...sanitizeResult({ ...clean, candidates }), grounded };
}

/** Same rule as the safety filter's Latin names: letters, spaces, dots and hyphens only */
const LATIN_NAME = /^[A-Z][a-z-]+( [a-z.-]+){0,3}$/;

/**
 * Writes the book page for a species the user chose themselves (via search), using the
 * photo for context. Returns { status, body: candidate }.
 */
export async function handleDescribe(body, env) {
  const providers = pickProviders(env);
  const latinName = String(body?.latinName ?? '').trim();
  const image = body?.image;
  if (!LATIN_NAME.test(latinName) || typeof image !== 'string' || !image || !ALLOWED_TYPES.includes(body?.mediaType)) {
    return reply(400, { code: 'bad-request', error: 'Missing species name or photo.' });
  }
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return reply(413, { code: 'too-large', error: 'The photo is too large.' });
  if (providers.length === 0) return reply(500, { code: 'no-key', error: 'No API key is configured on the server.' });

  const language = normalizeLanguage(body?.language);
  const input = { image, mediaType: body.mediaType, prompt: buildDescribePrompt(language, latinName), schema: resultSchema(language) };

  let lastError = null;
  for (const [i, provider] of providers.entries()) {
    try {
      const raw = await provider.ask(input);
      const isLast = i === providers.length - 1;
      if (!isLast && badTurkish(raw?.candidates?.[0], language)) {
        console.warn(`[describe] ${provider.label} wrote Turkish without Turkish letters; trying the next service`);
        continue;
      }
      // Keep the user's choice whatever the model says; only take its descriptions
      const written = { ...(raw?.candidates?.[0] ?? {}), latinName, confidence: 100 };
      const grounded = await groundResult({ isMushroom: true, candidates: [written] }, language);
      const candidate = grounded.candidates[0] ?? { latinName };
      return reply(200, { ...candidate, source: 'user' });
    } catch (err) {
      lastError = err instanceof IdentifyError ? err : new IdentifyError('unknown', 'An unexpected error occurred.', 500);
      console.warn(`[describe] ${provider.label} failed: ${lastError.code}`);
    }
  }
  return reply(lastError.status, { code: lastError.code, error: lastError.message });
}

/** True when a Turkish reply was written without Turkish letters (ş, ı, ğ…). */
function badTurkish(candidate, language) {
  return language === 'tr' && !!candidate && lacksTurkishLetters(pageTexts(candidate));
}

/** Species search for the "none of these" option. Returns { status, body: { results } }. */
export async function handleSearch(query, language) {
  try {
    const found = await searchSpecies(query, normalizeLanguage(language));
    // Names from iNaturalist pass the same safety filter as the AI's
    const results = found.map((r) => ({ ...sanitizeCandidate(r), rank: r.rank }));
    return reply(200, { results });
  } catch (err) {
    console.warn('[search] failed:', err.message);
    return reply(503, { code: 'unreachable', error: 'Species search is unavailable.' });
  }
}

function reply(status, body) {
  return { status, body };
}
