/*
  DESCRIBE A CHOSEN SPECIES — POST /api/describe
  When the user picks a species themselves (search), the AI writes its book page
  (cap, color, habitat, "Did you know?"…) for that species, using the photo for context.
  Runs on the dev server, like /api/identify. Without a key, demo mode returns the
  species with its iNaturalist name and photos but no descriptions.
*/
import { handleDescribe, pickProviders } from '../../../server/identify.js';
import { mockDescribe } from '../../../server/mockIdentify.js';

export async function POST(request) {
  const env = process.env;
  const body = await request.json().catch(() => null);
  const { status, body: out } = pickProviders(env).length ? await handleDescribe(body, env) : await mockDescribe(body);
  return Response.json(out, { status });
}
