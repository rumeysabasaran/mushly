/*
  CLOUDFLARE WORKERS AI — vision models that run on Cloudflare's own GPUs.
  Only available inside the Worker (the `AI` binding in wrangler.toml); not part of the
  default chain. To try it: RECOGNIZER_ORDER=workersai, WORKERS_AI_MODEL=@cf/...

  Unlike Gemini/Evren/Claude, the model runs on the same platform as our server, so no
  third-party AI service is involved. Measured with scripts/benchmark (see docs/ROADMAP.md).
*/
import { IdentifyError, parseJsonReply } from '../prompt.js';

export const DEFAULT_WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';

export async function askWorkersAI({ image, mediaType, prompt, ai, model = DEFAULT_WORKERS_AI_MODEL }) {
  const input = {
    max_tokens: 4096,
    temperature: 0.2,
    // Thinking models (e.g. Gemma 4) otherwise spend the whole budget reasoning, like the
    // other services, we ask for the answer directly
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      { role: 'system', content: prompt.jsonSystem },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt.user },
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${image}` } },
        ],
      },
    ],
  };

  let data;
  try {
    try {
      data = await ai.run(model, input);
    } catch (err) {
      // Models without a thinking switch may reject the option: try once without it
      if (!/chat_template|enable_thinking|additional propert/i.test(String(err?.message))) throw err;
      const { chat_template_kwargs, ...plain } = input;
      data = await ai.run(model, plain);
    }
  } catch (err) {
    const message = String(err?.message ?? err);
    console.error('[identify:workersai]', model, message.slice(0, 300));
    if (/neuron|quota|limit|429|capacity/i.test(message)) throw new IdentifyError('rate-limit', 'Workers AI daily allowance used up.', 429);
    if (/agree|license/i.test(message)) throw new IdentifyError('terms', 'This model needs its license accepted first.', 500);
    throw new IdentifyError('api-error', `Workers AI error: ${message.slice(0, 120)}`, 502);
  }

  // Newer models answer in the OpenAI shape, older ones as { response }
  const text = data?.choices?.[0]?.message?.content ?? data?.response;
  if (data?.choices?.[0]?.finish_reason === 'length') {
    throw new IdentifyError('incomplete', 'The reply was cut off (length).');
  }
  // Some models already return parsed JSON
  return typeof text === 'object' && text !== null ? text : parseJsonReply(text);
}
