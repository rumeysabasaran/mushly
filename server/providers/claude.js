/*
  CLAUDE (Anthropic) — paid fallback recognition service
  Used when ANTHROPIC_API_KEY is set and the services before it in the chain fail.
*/
import Anthropic from '@anthropic-ai/sdk';
import { IdentifyError, parseJsonReply } from '../prompt.js';

export const CLAUDE_MODEL = 'claude-opus-5-5';

export async function askClaude({ image, mediaType, prompt, schema, apiKey }) {
  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      // If a safety classifier wrongly refuses a request, Anthropic automatically
      // retries it with another suitable model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema },
      },
      system: prompt.system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: prompt.user },
          ],
        },
      ],
    });
  } catch (err) {
    throw claudeError(err);
  }

  if (response.stop_reason === 'refusal') {
    throw new IdentifyError('refused', 'The model declined to identify this photo.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new IdentifyError('incomplete', 'The reply was cut off (max_tokens).');
  }
  return parseJsonReply(response.content.find((block) => block.type === 'text')?.text);
}

// From the most specific error to the most general
function claudeError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return new IdentifyError('bad-key', 'Invalid Anthropic API key.', 500);
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new IdentifyError('no-permission', 'The API key has no access to this model.', 500);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new IdentifyError('rate-limit', 'Rate limited by Anthropic.', 429);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new IdentifyError('unreachable', 'Could not reach the Anthropic API.', 503);
  }
  if (err instanceof Anthropic.APIError) {
    console.error('[identify:claude]', err.status, err.message);
    return new IdentifyError('api-error', `Anthropic API error (${err.status ?? '?'}).`, 502);
  }
  return err;
}
