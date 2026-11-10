/*
  GOOGLE GEMINI — default recognition service (free tier)
  The most accurate option in our benchmark: right species first in 81% of test photos, ~11 s.

  Required (.env):  GEMINI_API_KEY=...   (https://aistudio.google.com/apikey)
  Optional:         GEMINI_MODEL=gemini-3.5-flash-lite
  (gemini-3.5-flash and 3.8-flash allow only ~20 requests per day on the free tier)

  Note: on Google's free tier, submitted content may be used to improve Google's
  products. Only the photo is sent; location and field notes never are.

  Uses Google's currently recommended "Interactions" endpoint.
*/
import { IdentifyError, parseJsonReply } from '../prompt.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// In testing, gemini-3.8-flash often returned "overloaded" (503) on the free tier;
// flash-lite was fast (~3-4 s) and identified species correctly.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 60_000;

export async function askGemini({ image, mediaType, prompt, schema, apiKey, model = DEFAULT_GEMINI_MODEL }) {
  const request = {
    model,
    system_instruction: prompt.jsonSystem,
    input: [
      { type: 'text', text: prompt.user },
      { type: 'image', data: image, mime_type: mediaType },
    ],
    // Ask for a reply that matches our schema
    response_format: { type: 'text', mime_type: 'application/json', schema },
    generation_config: {
      thinking_level: 'low', // think less: faster and lighter on the quota
      max_output_tokens: 4096,
    },
    store: false, // don't keep a conversation record on Google's servers
  };

  let data;
  try {
    data = await sendWithRetry(request, apiKey);
  } catch (err) {
    // If the schema is too complex for this model, retry once without it
    // (the JSON instruction in the prompt still asks for the right format).
    if (err instanceof IdentifyError && err.code === 'bad-request') {
      const { response_format, ...withoutSchema } = request;
      data = await send(withoutSchema, apiKey);
    } else {
      throw err;
    }
  }

  if (data.status === 'incomplete') {
    throw new IdentifyError('incomplete', 'The reply was cut off (incomplete).');
  }
  if (data.status && data.status !== 'completed') {
    throw new IdentifyError('api-error', `Gemini did not complete (${data.status}).`);
  }

  // The reply text sits in the model output inside "steps"
  const text =
    (data.steps ?? [])
      .filter((step) => step.type === 'model_output')
      .flatMap((step) => step.content ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('') || data.output_text;

  return parseJsonReply(text);
}

// "Overloaded" (503) spikes on the free tier usually pass within seconds. In our benchmark
// almost half of the requests hit one, so a couple of short retries keep most photos on
// Gemini (the most accurate model) instead of falling back.
const BUSY_RETRY_DELAYS_MS = [1_500, 3_500];

async function sendWithRetry(body, apiKey) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send(body, apiKey);
    } catch (err) {
      const delay = BUSY_RETRY_DELAYS_MS[attempt];
      if (!(err instanceof IdentifyError) || err.code !== 'busy' || delay === undefined) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function send(body, apiKey) {
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
        'Api-Revision': '2026-05-20',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // The Expo dev server uses its own fetch, which drops the connection if the reply
      // hasn't started within 30 s. The model sends nothing while it thinks, so we extend
      // that limit. (Standard fetch doesn't know this option and ignores it.)
      connectTimeout: TIMEOUT_MS + 5_000,
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new IdentifyError('timeout', 'Gemini took too long to reply.', 504);
    }
    throw new IdentifyError('unreachable', 'Could not reach the Gemini API.', 503);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw geminiError(response.status, data);
  return data;
}

/** Maps Google's error responses to our error codes. */
function geminiError(status, data) {
  // Google sometimes wraps the error in a list: [{ error: {...} }]
  const err = (Array.isArray(data) ? data[0] : data)?.error ?? {};
  const text = `${err.status ?? ''} ${err.code ?? ''} ${err.message ?? ''}`;
  console.error('[identify:gemini]', status, text.slice(0, 300));

  if (/API_KEY|api key|apikey|UNAUTHENTICATED/i.test(text) || status === 401) {
    return new IdentifyError('bad-key', 'Invalid Gemini API key.', 500);
  }
  if (status === 429) {
    return new IdentifyError('rate-limit', 'Gemini free-tier quota reached.', 429);
  }
  if (status === 503) {
    return new IdentifyError('busy', 'Gemini is overloaded.', 503);
  }
  if (status === 403) return new IdentifyError('no-permission', 'The Gemini key has no access to this model.', 500);
  if (status === 400) return new IdentifyError('bad-request', 'Gemini rejected the request.', 502);
  return new IdentifyError('api-error', `Gemini API error (${status}).`, 502);
}
