/*
  BUILD THE RECOGNITION TEST SET

  Picks research-grade iNaturalist observations (species confirmed by the community)
  for mushrooms common in Türkiye and Europe, and writes their photo URLs to
  testset.json. Photos are not downloaded or committed; only URLs and credits are.

  The taxon's own default photo is skipped, since models may have seen it often.

  Usage: node scripts/benchmark/build-testset.mjs [photosPerSpecies=2]
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SPECIES = [
  'Amanita muscaria', 'Amanita caesarea', 'Amanita phalloides', 'Amanita pantherina',
  'Boletus edulis', 'Cantharellus cibarius', 'Macrolepiota procera', 'Coprinus comatus',
  'Pleurotus ostreatus', 'Laetiporus sulphureus', 'Fomes fomentarius', 'Trametes versicolor',
  'Ganoderma applanatum', 'Lycoperdon perlatum', 'Morchella esculenta', 'Hydnum repandum',
  'Lactarius deliciosus', 'Russula emetica', 'Armillaria mellea', 'Clathrus ruber',
  'Auricularia auricula-judae', 'Xylaria hypoxylon', 'Schizophyllum commune', 'Tremella mesenterica',
];
const LICENSES = 'cc0,cc-by,cc-by-sa,cc-by-nc,cc-by-nc-sa';
const HEADERS = { 'User-Agent': 'Mushly-benchmark/0.2 (open-source nature journal)' };
const perSpecies = Number(process.argv[2] ?? 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

const items = [];
for (const name of SPECIES) {
  const { results: [taxon] } = await getJson(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&rank=species&per_page=1`);
  const params = new URLSearchParams({
    taxon_id: taxon.id, quality_grade: 'research', photos: 'true', photo_license: LICENSES,
    order_by: 'votes', per_page: '30', page: '2',
  });
  const { results } = await getJson(`https://api.inaturalist.org/v1/observations?${params}`);
  const users = new Set();
  for (const obs of results) {
    const photo = obs.photos?.[0];
    if (!photo || photo.id === taxon.default_photo?.id || users.has(obs.user?.id)) continue;
    users.add(obs.user?.id);
    items.push({
      species: taxon.name,
      observation: `https://www.inaturalist.org/observations/${obs.id}`,
      url: photo.url.replace('/square.', '/large.'),
      attribution: photo.attribution,
    });
    if (users.size >= perSpecies) break;
  }
  console.log(`${taxon.name}: ${users.size} photo(s)`);
  await sleep(1100); // iNaturalist asks for about one request per second
}

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'testset.json');
fs.writeFileSync(out, JSON.stringify(items, null, 2) + '\n');
console.log(`\n${items.length} photos written to ${out}`);
