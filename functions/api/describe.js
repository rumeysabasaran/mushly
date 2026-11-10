/*
  PRODUCTION SERVER — Cloudflare Pages Functions, POST /api/describe (see src/app/api/describe+api.js)
*/
import { handleDescribe } from '../../server/identify.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  const { status, body: out } = await handleDescribe(body, env);
  return Response.json(out, { status });
}
