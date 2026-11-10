/*
  iNaturalist ENRICHMENT — grounds the AI's guesses in real taxonomy.

  For each candidate the model suggests, we look its Latin name up on iNaturalist
  (https://api.inaturalist.org, free, no key) and:
  - drop candidates iNaturalist doesn't know (the model invented the species),
  - replace outdated names with the accepted one (e.g. Lepiota procera → Macrolepiota procera),
  - take the common name from iNaturalist in the phone's language, instead of the
    model's (it tends to invent descriptive names like "orange-capped forest mushroom"),
  - attach a few openly licensed reference photos so users can compare by eye.

  Only Latin names are sent to iNaturalist; never the user's photo, location or notes.
  Only names, ids and photo URLs are read back: iNaturalist's text (e.g. Wikipedia
  summaries, which may mention edibility) is never used.

  If iNaturalist can't be reached, the candidates are returned unchanged.
*/

const API = 'https://api.inaturalist.org/v1';
const TIMEOUT_MS = 6_000;
const MAX_PHOTOS = 4;
const HEADERS = { 'User-Agent': 'Mushly/0.2 (open-source nature journal; https://github.com/rumeysabasaran/mushly)' };

// Photos must allow reuse with attribution. Unlicensed ("all rights reserved") photos are skipped.
const OPEN_LICENSES = new Set(['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa']);
const SPECIES_RANKS = new Set(['species', 'subspecies', 'variety', 'form']);

// In-memory cache for the lifetime of the server process: Latin name → lookup result
const cache = new Map();

async function getJson(path) {
  const response = await fetch(`${API}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`iNaturalist ${response.status}`);
  return response.json();
}

const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Capitalizes the first letter with the language's rules ("sinek mantarı" → "Sinek mantarı"). */
function capitalize(text, language) {
  if (!text) return '';
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

// "Amanita sp." / "Amanita spp." means the model is only sure about the genus
const GENUS_ONLY = /^([A-Z][a-z]+)\s+spp?\.?$/;

/** Finds the fungus taxon for a Latin name. Returns null when iNaturalist doesn't know it. */
async function findTaxon(latinName, language) {
  const key = `${language}:${normalize(latinName)}`;
  if (cache.has(key)) return cache.get(key);

  const genus = String(latinName).trim().match(GENUS_ONLY)?.[1];
  const name = genus ?? latinName;
  const ranks = genus ? new Set(['genus']) : SPECIES_RANKS;

  const query = new URLSearchParams({ q: name, per_page: '5', locale: language, is_active: 'true' });
  const { results = [] } = await getJson(`/taxa?${query}`);
  const wanted = normalize(name);
  const taxon =
    results.find(
      (t) =>
        t.iconic_taxon_name === 'Fungi' &&
        ranks.has(t.rank) &&
        (normalize(t.name) === wanted || normalize(t.matched_term) === wanted)
    ) ?? null;

  cache.set(key, taxon);
  return taxon;
}

function openPhotos(taxon) {
  const photos = [taxon.default_photo, ...(taxon.taxon_photos ?? []).map((tp) => tp.photo)].filter(Boolean);
  const seen = new Set();
  return photos
    .filter((p) => OPEN_LICENSES.has(p.license_code) && p.medium_url && !seen.has(p.id) && seen.add(p.id))
    .slice(0, MAX_PHOTOS)
    .map((p) => ({ url: p.medium_url, attribution: p.attribution ?? '', license: p.license_code }));
}

/** Common name in the phone's language, or '' if iNaturalist only has another language's name. */
function commonNameFor(taxon, language) {
  const name = taxon.preferred_common_name;
  if (!name) return '';
  // For Turkish, iNaturalist falls back to the English name when there is no Turkish one.
  if (language !== 'en' && taxon.english_common_name && normalize(name) === normalize(taxon.english_common_name)) {
    return '';
  }
  return capitalize(name, language);
}

/**
 * Enriches sanitized candidates with iNaturalist names and photos.
 * @param {object[]} candidates  output of sanitizeResult().candidates
 * @param {'en'|'tr'} language
 */
export async function enrichCandidates(candidates, language) {
  if (!candidates.length) return candidates;

  let taxa;
  try {
    taxa = await Promise.all(candidates.map((c) => findTaxon(c.latinName, language)));
  } catch (err) {
    console.warn('[inaturalist] lookup failed, keeping AI names:', err.message);
    return candidates;
  }

  // Details (with the photo list) for every found taxon, in a single request
  const ids = [...new Set(taxa.filter(Boolean).map((t) => t.id))];
  const details = new Map();
  if (ids.length) {
    try {
      const { results = [] } = await getJson(`/taxa/${ids.join(',')}?locale=${language}`);
      results.forEach((t) => details.set(t.id, t));
    } catch (err) {
      console.warn('[inaturalist] photo lookup failed:', err.message);
    }
  }

  const byTaxon = new Map();
  candidates.forEach((candidate, i) => {
    const found = taxa[i];
    if (!found) {
      console.info(`[inaturalist] dropped unknown species: ${candidate.latinName}`);
      return;
    }
    const taxon = details.get(found.id) ?? found;
    const enriched = {
      ...candidate,
      // Genus-level guesses keep the "sp." so the book never shows a genus as a species
      latinName: taxon.rank === 'genus' ? `${taxon.name} sp.` : taxon.name,
      commonName: commonNameFor(taxon, language),
      taxonId: taxon.id,
      referencePhotos: openPhotos(taxon),
    };
    // Two guesses may turn out to be the same species once synonyms are resolved
    const existing = byTaxon.get(taxon.id);
    if (!existing || existing.confidence < enriched.confidence) byTaxon.set(taxon.id, enriched);
  });

  return [...byTaxon.values()].sort((a, b) => b.confidence - a.confidence);
}

// ---------------------------------------------------------------- search

const FUNGI_TAXON_ID = 47170;
const SEARCH_RANKS = new Set(['genus', ...SPECIES_RANKS]);
const LATIN_BINOMIAL = /^[A-Z][a-z-]+ [a-z-]+/;

/**
 * Searches mushroom species by Turkish, English or Latin name, for when none of the AI's
 * suggestions is right. Returns at most 10 candidates shaped like recognition candidates
 * (no descriptions; those are written later by server/identify.js → handleDescribe).
 */
export async function searchSpecies(query, language) {
  const q = String(query ?? '').trim().slice(0, 60);
  if (q.length < 2) return [];

  const params = new URLSearchParams({ q, locale: language, taxon_id: String(FUNGI_TAXON_ID), per_page: '15', is_active: 'true' });
  const { results = [] } = await getJson(`/taxa/autocomplete?${params}`);

  return results
    .filter((t) => SEARCH_RANKS.has(t.rank))
    // Skip matches on an old Latin synonym ("Boletus versicolor" → Trametes): confusing in a list
    .filter((t) => !(t.matched_term && LATIN_BINOMIAL.test(t.matched_term) && normalize(t.matched_term) !== normalize(t.name)))
    .slice(0, 10)
    .map((t) => ({
      latinName: t.rank === 'genus' ? `${t.name} sp.` : t.name,
      commonName: commonNameFor(t, language),
      taxonId: t.id,
      rank: t.rank,
      referencePhotos: openPhotos(t),
    }));
}
