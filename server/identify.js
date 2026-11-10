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
      1. Evren   (EVREN_API_KEY)      — free, default
      2. Gemini  (GEMINI_API_KEY)     — free fallback
      3. Claude  (ANTHROPIC_API_KEY)  — paid fallback
  If a service fails (out of credit, quota reached, no reply…) the next one is tried.
  To change the order: RECOGNIZER_ORDER=gemini,evren
  With no keys at all, the dev server runs in demo mode.
*/
import { sanitizeResult } from '../src/services/safety.js';
import { IdentifyError, buildPrompt, normalizeLanguage, resultSchema } from './prompt.js';
import { askEvren, DEFAULT_EVREN_MODEL } from './providers/evren.js';
import { askGemini, DEFAULT_GEMINI_MODEL } from './providers/gemini.js';
import { askClaude, CLAUDE_MODEL } from './providers/claude.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (the phone already shrinks photos to ~300 KB)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_ORDER = ['evren', 'gemini', 'claude'];

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
  for (const provider of providers) {
    try {
      const raw = await provider.ask(input);
      if (lastError) console.info(`[identify] Fallback service used: ${provider.label}`);
      return reply(200, sanitizeResult(raw));
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

  // No service succeeded: report the last error
  return reply(lastError.status, { code: lastError.code, error: lastError.message });
}

function reply(status, body) {
  return { status, body };
}
