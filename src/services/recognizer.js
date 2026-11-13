/*
  RECOGNIZER ADAPTER — the rest of the app only identifies species through this file.
  To switch services (e.g. Kindwise mushroom.id), only the server code changes;
  the shape this file returns stays the same.

  Endpoint: /api/identify
  - During development the phone sends this request to the Expo dev server on the
    computer (src/app/api/identify+api.js). The API key stays there, on the computer.
  - In production (stage 6) it goes to the "origin" set in app.json.

  The phone's language is sent along, so descriptions come back in Turkish or English.

  Result shape:
  {
    isMushroom: true,
    photoTip: '...',
    mock: false,                // true in demo mode
    candidates: [ { latinName, commonName, confidence, rarity,
                    capShape, color, stem, habitat, season, funFact } ]
  }

  Errors carry a `code` (e.g. 'timeout', 'no-key'); screens turn it into a
  translated message with t(`errors.${code}`).
*/
import NetInfo from '@react-native-community/netinfo';
import { sanitizeCandidate, sanitizeResult } from './safety.js';
import { enrichCandidates, searchSpecies as searchINaturalist } from '../../server/inaturalist.js';
import { photoBase64 } from './photos';
import { language } from '../i18n';

/** No internet, or the server can't be reached → the photo should go to pending */
export class OfflineError extends Error {
  constructor() {
    super('No internet connection.');
    this.name = 'OfflineError';
    this.code = 'offline';
  }
}

/** The server returned an error (no key, service refused, …) */
export class RecognitionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RecognitionError';
    this.code = code || 'generic';
  }
}

/*
  Where the recognition server lives.
  - Development (npm start): empty, so requests go to the dev server on the computer.
  - Installed app: EXPO_PUBLIC_API_URL, e.g. https://mushly.pages.dev (set in eas.json),
    since an installed app has no dev server to talk to.
*/
const API_BASE = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
const api = (path) => `${API_BASE}${path}`;

const ENDPOINT = api('/api/identify');
// Long enough for the whole server chain: Evren (80 s) + Gemini fallback (60 s)
const TIMEOUT_MS = 150_000;

/** Is the phone online? (unknown counts as "yes"; the request itself decides) */
export async function isOnline() {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

/** @param {object} photo  a record from the photos table */
export async function identify(photo) {
  if (!(await isOnline())) throw new OfflineError();

  const image = await photoBase64(photo);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mediaType: 'image/jpeg', language }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new RecognitionError('Identification took too long.', 'timeout');
    }
    throw new OfflineError(); // network error
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new RecognitionError(data.error || 'Identification failed.', data.code);
  }

  // The server already filtered the result; filter once more on the phone (two layers).
  let result = sanitizeResult(data);

  // The server couldn't reach iNaturalist (it rate-limits Cloudflare's shared addresses now and
  // then); the phone has its own address, so it looks the names and photos up itself.
  if (data.grounded === false && result.candidates.length) {
    const { candidates } = await enrichCandidates(result.candidates, language);
    result = sanitizeResult({ ...result, candidates });
  }
  return { ...result, mock: data.mock === true };
}

// ---------------------------------------------------------------- "none of these" search

/**
 * Searches mushroom species by name (Turkish, English or Latin) on iNaturalist.
 * The phone asks iNaturalist directly (its own address isn't rate-limited like the server's);
 * if that fails, it asks through the server.
 */
export async function searchSpecies(query) {
  const asCandidates = (list) => list.map((r) => ({ ...sanitizeCandidate(r), source: 'user' })).filter((r) => r.latinName);
  try {
    return asCandidates(await searchINaturalist(query, language));
  } catch (err) {
    console.warn('[search] iNaturalist directly failed, trying the server:', err.message);
  }

  const params = new URLSearchParams({ q: query, language });
  let response;
  try {
    response = await fetch(api(`/api/species?${params}`));
  } catch {
    throw new OfflineError();
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new RecognitionError(data.error || 'Search failed.', data.code);
  return asCandidates(data.results ?? []);
}

/**
 * Asks the server to write the book page (descriptions, rarity, fun fact) for a species
 * the user chose themselves. Returns the candidate with descriptions filled in.
 */
export async function describeSpecies(photo, candidate) {
  const image = await photoBase64(photo);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(api('/api/describe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mediaType: 'image/jpeg', language, latinName: candidate.latinName }),
      signal: controller.signal,
    });
  } catch (err) {
    throw err?.name === 'AbortError' ? new RecognitionError('Took too long.', 'timeout') : new OfflineError();
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new RecognitionError(data.error || 'Describe failed.', data.code);
  const written = sanitizeCandidate(data);
  // Keep the user's choice and iNaturalist data even if the reply lacks them
  return {
    ...written,
    latinName: candidate.latinName,
    commonName: written.commonName || candidate.commonName,
    taxonId: written.taxonId ?? candidate.taxonId,
    referencePhotos: written.referencePhotos.length ? written.referencePhotos : candidate.referencePhotos,
    confidence: null,
    source: 'user',
  };
}
