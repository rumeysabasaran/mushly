/*
  SAFETY FILTER — the project's core rule is enforced here:
  Mushly never shows edibility, toxicity or consumption information, anywhere.

  Every recognition response passes through this file before it reaches the screen:
  1. Only allow-listed fields are kept. Even if a service sends something else
     (e.g. "edible: true"), that field is never read.
  2. Texts are scanned sentence by sentence; any sentence containing a banned
     word stem is dropped entirely.
  3. If the common name itself carries these meanings (e.g. "death", "poison"),
     the name is hidden and the Latin name is shown instead.

  This file runs both on the server and on the phone (two layers of protection),
  so it must not import anything app-specific (no i18n, no React Native).
*/

// Matched against lowercased text. Word stems: "poison" → poisonous, poisoning…
const BANNED_PATTERNS = [
  // Turkish
  /yenebil/, /yenil(ir|mez|emez)/, /yenmez/, /yenir\b/, /yenme(si|z)/, /yendiğ/,
  /yemek/, /yemeğ/, /yiyecek/, /yiyen/, /zehir/, /toksi/, /tüket/, /lezzet/,
  /\btadı/, /\blezi/, /pişir/, /kızart/, /mutfak/, /sofra/, /yemek tarif/,
  /ölüm/, /öldür/, /köygöçüren/, /şifa/, /tıbb?i/, /ilaç/, /tedavi/,
  /halüsin/, /sanrı/, /sindirim/, /mide/, /karaciğer/, /böbrek/,
  /zararlı/, /tehlikeli/, /güvenli/, /sağlığ/, /sağlık/, /hayati/,
  // English
  /\bedib/, /\binedib/, /poison/, /toxic/, /toxin/, /venom/, /\beat/, /\bcook/,
  /culinary/, /delicious/, /tasty/, /\btaste/, /flavo/, /recipe/, /kitchen/, /cuisine/,
  /\bdish/, /\bmeal/, /\bfood/, /\bfry/, /fried/, /saut/, /gourmet/, /delicacy/, /consum/,
  /forag/, /deadly/, /lethal/, /fatal/, /\bdeath/, /\bkill/, /medicin/, /\bcure/, /remed/,
  /therap/, /hallucin/, /psychedel/, /psychoactiv/, /\bdrug/, /digest/, /stomach/,
  /\bliver/, /kidney/, /harmful/, /dangerous/, /\bsafe/, /health/,
];

/** Does the text contain a banned expression? */
export function containsBanned(text) {
  if (typeof text !== 'string' || !text) return false;
  const tr = text.toLocaleLowerCase('tr-TR');
  const en = text.toLowerCase(); // second pass for the English "I"
  return BANNED_PATTERNS.some((p) => p.test(tr) || p.test(en));
}

/** Splits text into sentences, drops banned ones and limits the length. */
export function cleanText(text, maxLength = 400) {
  if (typeof text !== 'string') return '';
  const sentences = text.match(/[^.!?…]+[.!?…]*/g) ?? [];
  return sentences
    .map((s) => s.trim())
    .filter((s) => s && !containsBanned(s))
    .join(' ')
    .slice(0, maxLength)
    .trim();
}

const RARITY_KEYS = ['common', 'rare', 'veryRare'];

/** Normalizes a Latin name: letters, spaces, dots and hyphens only. */
function cleanLatinName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[^A-Za-z .\-×]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * The common name of a species or candidate.
 * Records saved before the English migration used `turkishName`.
 */
export function commonNameOf(item) {
  return item?.commonName || item?.turkishName || '';
}

/** Rebuilds a single species candidate from the allow-list. */
export function sanitizeCandidate(raw) {
  const latinName = cleanLatinName(raw?.latinName);
  const commonRaw = commonNameOf(raw);
  const commonName = typeof commonRaw === 'string' ? commonRaw.trim().slice(0, 80) : '';
  const confidence = Math.round(Number(raw?.confidence));

  return {
    latinName,
    commonName: containsBanned(commonName) ? '' : commonName,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0,
    rarity: RARITY_KEYS.includes(raw?.rarity) ? raw.rarity : 'common',
    capShape: cleanText(raw?.capShape, 220),
    color: cleanText(raw?.color, 220),
    stem: cleanText(raw?.stem, 220),
    habitat: cleanText(raw?.habitat, 260),
    season: cleanText(raw?.season, 120),
    funFact: cleanText(raw?.funFact, 360),
  };
}

/** Filters a whole recognition response. At most 3 candidates, sorted by confidence. */
export function sanitizeResult(raw) {
  const list = Array.isArray(raw?.candidates) ? raw.candidates : [];
  const candidates = list
    .map(sanitizeCandidate)
    .filter((c) => c.latinName)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  return {
    isMushroom: raw?.isMushroom !== false && candidates.length > 0,
    photoTip: cleanText(raw?.photoTip, 200),
    mock: raw?.mock === true,
    candidates,
  };
}

/** Name to show on screen: the common name, or the Latin name if there is none. */
export function displayName(item) {
  return commonNameOf(item) || item?.latinName || '';
}
