/*
  PRODUCTION SERVER — Cloudflare Pages Functions
  Once the app is deployed to Cloudflare Pages, /api/identify runs this file.
  API keys are set as environment variables in the Cloudflare dashboard (e.g. EVREN_API_KEY);
  this is covered in stage 6.
*/
import { handleIdentify } from '../../server/identify.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  const { status, body: out } = await handleIdentify(body, env);
  return Response.json(out, { status });
}
