/*
  EVREN LLM API — default recognition service (free, OpenAI-compatible format)
  URL: https://evren-llmapi.ssyz.org.tr

  Required (.env):  EVREN_API_KEY=evren_llm_...
  Optional:         EVREN_MODEL=gemma-4-31b   (any other vision-capable model also works)
*/
import { IdentifyError, parseJsonReply } from '../prompt.js';

const BASE_URL = 'https://evren-llmapi.ssyz.org.tr/v1';
export const DEFAULT_EVREN_MODEL = 'gemma-4-31b';
const TIMEOUT_MS = 80_000;

export async function askEvren({ image, mediaType, prompt, schema, apiKey, model = DEFAULT_EVREN_MODEL }) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.2, // low: more consistent, less "imagination"
        // Ask for a reply that matches our schema (the platform supports it)
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'mushroom_result', strict: true, schema },
        },
        messages: [
          { role: 'system', content: prompt.jsonSystem },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt.user },
              // The platform only accepts images as base64 data URLs
              { type: 'image_url', image_url: { url: `data:${mediaType};base64,${image}` } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // The Expo dev server uses its own fetch, which drops the connection if the reply
      // hasn't started within 30 s. The model sends nothing while it thinks, so we extend
      // that limit. (Standard fetch doesn't know this option and ignores it.)
      connectTimeout: TIMEOUT_MS + 5_000,
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new IdentifyError('timeout', 'Evren took too long to reply.', 504);
    }
    throw new IdentifyError('unreachable', 'Could not reach the Evren API.', 503);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw evrenError(response.status, data);
  }

  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new IdentifyError('incomplete', 'The reply was cut off (length).');
  }
  return parseJsonReply(choice?.message?.content);
}

/** Maps the platform's error responses to our error codes. */
function evrenError(status, data) {
  const code = data?.error?.code || data?.code || data?.detail?.code || '';
  console.error('[identify:evren]', status, JSON.stringify(data).slice(0, 300));

  if (status === 401) return new IdentifyError('bad-key', 'Invalid Evren API key.', 500);
  if (status === 403 && String(code).includes('terms')) {
    return new IdentifyError('terms', "Evren's terms of use have not been accepted.", 500);
  }
  if (status === 403) return new IdentifyError('no-permission', 'The key has no access to this model.', 500);
  if (status === 402) return new IdentifyError('no-credit', 'The Evren account is out of credit.', 500);
  if (status === 429) return new IdentifyError('rate-limit', 'Rate limited by Evren.', 429);
  if (status === 400) return new IdentifyError('bad-request', 'Evren rejected the photo.', 502);
  return new IdentifyError('api-error', `Evren API error (${status}).`, 502);
}
