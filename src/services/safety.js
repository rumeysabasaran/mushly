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
  /kustur/, /kusma/, /ishal/, /ziyafet/, /şölen/, /gurme/, /aşçı/, /restoran/, /\bmenü/, /lokanta/,
  // English
  /\bedib/, /\binedib/, /poison/, /toxic/, /toxin/, /venom/, /\beat/, /\bcook/,
  /culinary/, /delicious/, /tasty/, /\btaste/, /flavo/, /recipe/, /kitchen/, /cuisine/,
  /\bdish/, /\bmeal/, /\bfood/, /\bfry/, /fried/, /saut/, /gourmet/, /delicacy/, /consum/,
  /forag/, /deadly/, /lethal/, /fatal/, /\bdeath/, /\bkill/, /medicin/, /\bcure/, /remed/,
  /therap/, /hallucin/, /psychedel/, /psychoactiv/, /\bdrug/, /digest/, /stomach/,
  /\bliver/, /kidney/, /harmful/, /dangerous/, /\bsafe/, /health/,
  /vomit/, /emetic/, /sicken/, /nause/, /diarrh/, /\bfeast/, /banquet/, /\bchef/, /restaurant/, /\bmenu\b/, /destroying angel/,
];

/** Does the text contain a banned expression? */
export function containsBanned(text) {
  if (typeof text !== 'string' || !text) return false;
  // Turkish lowercase by hand (İ → i, I → ı): some phone JS engines ignore the locale argument
  const tr = text.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
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
 * True when some Turkish text was written without Turkish letters ("baslangicta konik
 * yapidadir" instead of "başlangıçta konik yapıdadır"). Some models do this now and
 * then, sometimes in only one field, so each text is checked on its own:
 * - a sentence of 35+ letters with none of ç ğ ı ö ş ü is almost never real Turkish;
 * - shorter ones are caught by common words in their letterless form.
 */
const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
const LETTERLESS_WORDS =
  /\b(sapka\w*|baslangic\w*|yapid\w*|agac\w*|uzerin\w*|buyu\w*|kucuk\w*|genis\w*|gorul\w*|gorun\w*|yetisi\w*|olusu\w*|cok|icin|yuzey\w*|kirmizi\w*|sarims\w*|beyazims\w*|kahverengims\w*|acik|dogal|duzle\w*|ormanlik\w*|topragi\w*|halkasi|kesesi|ozellik\w*|ilginc\w*)\b/i;

function letterlessText(text) {
  if (typeof text !== 'string' || TURKISH_LETTERS.test(text)) return false;
  const letters = text.replace(/[^a-zA-Z]/g, '').length;
  return letters >= 35 || (letters >= 10 && LETTERLESS_WORDS.test(text));
}

export function lacksTurkishLetters(texts) {
  return texts.some(letterlessText);
}

/** The page texts of a candidate or species record, for lacksTurkishLetters */
export function pageTexts(item) {
  const d = item?.description ?? item ?? {};
  return [d.capShape, d.color, d.stem, d.habitat, d.season, item?.funFact, item?.tellApart];
}

/**
 * The common name of a species or candidate.
 * Records saved before the English migration used `turkishName`.
 */
export function commonNameOf(item) {
  return item?.commonName || item?.turkishName || '';
}

// Reference photos may only come from iNaturalist's own photo hosts
const PHOTO_URL = /^https:\/\/(inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org)\/photos\/\d+\/(square|small|medium|large)\.(jpe?g|png)$/i;
const PHOTO_LICENSES = ['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa'];

/** Keeps only well-formed, openly licensed iNaturalist photos (at most 4). */
function cleanPhotos(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => typeof p?.url === 'string' && PHOTO_URL.test(p.url) && PHOTO_LICENSES.includes(p.license))
    .slice(0, 4)
    .map((p) => ({
      url: p.url,
      license: p.license,
      attribution: typeof p.attribution === 'string' ? p.attribution.replace(/\s+/g, ' ').trim().slice(0, 160) : '',
    }));
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
    tellApart: cleanText(raw?.tellApart, 220),
    taxonId: Number.isInteger(raw?.taxonId) && raw.taxonId > 0 ? raw.taxonId : null,
    referencePhotos: cleanPhotos(raw?.referencePhotos),
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
