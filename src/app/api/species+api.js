/*
  SPECIES SEARCH — GET /api/species?q=kanlıca&language=tr
  Used by the "none of these, I'll search" option. Runs on the dev server; looks names
  up on iNaturalist (server/inaturalist.js). Needs no API key.
*/
import { handleSearch } from '../../../server/identify.js';

export async function GET(request) {
  const url = new URL(request.url);
  const { status, body } = await handleSearch(url.searchParams.get('q'), url.searchParams.get('language'));
  return Response.json(body, { status });
}
