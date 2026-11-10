/*
  RECOGNITION ENDPOINT — /api/identify
  This file does NOT run on the phone; it runs on the computer (in the Expo dev server).
  API keys from .env are read only here and are never sent to the phone.
  Without a key, the demo recognizer kicks in (fake results).

  The real work happens in server/identify.js (Evren → Gemini → Claude fallback chain).
*/
import { handleIdentify, pickProviders } from '../../../server/identify.js';
import { mockIdentify } from '../../../server/mockIdentify.js';

let announced = false;

export async function POST(request) {
  const env = process.env;
  const providers = pickProviders(env);

  if (!announced) {
    announced = true;
    const mode = providers.length
      ? providers.map((p) => p.label).join('  →  fallback: ')
      : 'DEMO mode (no key in .env)';
    console.log(`\n  🍄 Species recognition: ${mode}\n`);
  }

  const body = await request.json().catch(() => null);
  const { status, body: out } = providers.length ? await handleIdentify(body, env) : await mockIdentify(body);
  return Response.json(out, { status });
}
