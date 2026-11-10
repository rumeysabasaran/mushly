/*
  PRODUCTION SERVER — Cloudflare Pages Functions, GET /api/species (see src/app/api/species+api.js)
*/
import { handleSearch } from '../../server/identify.js';

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const { status, body } = await handleSearch(url.searchParams.get('q'), url.searchParams.get('language'));
  return Response.json(body, { status });
}
