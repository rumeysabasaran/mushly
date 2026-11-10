/*
  RECOGNITION PROMPT AND RESPONSE SCHEMA
  Every AI service gets the same instructions and the same response schema.
  The schema has NO field related to edibility.

  Each language has its own natively written prompt. Writing the Turkish prompt in
  Turkish matters: with English instructions and Turkish output, gemma-4-31b reasoned
  about 3x longer (~125 s vs ~40 s) and ran past the timeout.
*/

const PROMPTS = {
  en: {
    schema: {
      latinName: 'Scientific (Latin) name, e.g. "Trametes versicolor"',
      commonName: 'Common English name; if there is none, a short descriptive name',
      confidence: 'Confidence percentage from 0 to 100',
      capShape: 'Cap shape, 1 sentence',
      color: 'Coloring, 1 sentence',
      stem: 'Stem features, 1 sentence (say so if it has no stem)',
      habitat: 'Where it grows, 1-2 sentences',
      season: 'Season(s) it appears in, short',
      funFact: 'An interesting "Did you know?" fact, 1-2 sentences',
      photoTip: 'A short tip for a better photo; empty if not needed',
    },
    user: 'Identify the mushroom in this photo.',
    system: `You are the species identification assistant of "Mushly", a nature discovery journal. The user sends a photo of a mushroom they found in the forest. Your task is to name the 3 most likely species in the photo and write short, warm and informative English texts for the species page of their journal.

Strict rule: In no field may you give or imply any information about edibility, toxicity, consumption, taste, food, cooking, medicinal use or health effects. The app never shows this information and such sentences are deleted automatically; if you write them, the text will be incomplete. If a species' common name carries such meanings (e.g. "death", "poison"), write a neutral name based on its appearance instead.

Guidelines:
- Identifying a species from a photo is uncertain. Keep confidence percentages realistic; give a low value when unsure. The percentages do not need to add up to 100.
- Order the candidates from most to least likely and give exactly 3. In the descriptions, mention the visible features that tell similar species apart.
- Rarity: based on how often it is seen in the forests of Türkiye and Europe: "common", "rare" or "veryRare".
- Keep each description field to one sentence, plain and in the style of a naturalist's notebook. Write every text in English.
- The "Did you know?" fact should be about ecology, biology, history or culture.
- If there is no mushroom in the photo, set isMushroom=false and candidates to an empty array; kindly suggest retaking the photo in photoTip.
- If the photo is blurry, too far away, or the underside of the cap isn't visible, give a short tip in photoTip.`,
  },
  tr: {
    schema: {
      latinName: 'Bilimsel (Latince) ad, ör. "Trametes versicolor"',
      commonName: 'Yaygın Türkçe ad; yoksa kısa betimleyici bir ad',
      confidence: '0-100 arası güven yüzdesi',
      capShape: 'Şapka şekli, 1 cümle',
      color: 'Renk özellikleri, 1 cümle',
      stem: 'Sap özellikleri, 1 cümle (sapı yoksa bunu belirt)',
      habitat: 'Büyüdüğü ortam, 1-2 cümle',
      season: 'Görüldüğü mevsim(ler), kısa',
      funFact: '"Biliyor muydun?" için ilginç bir bilgi, 1-2 cümle',
      photoTip: 'Daha iyi bir fotoğraf için kısa ipucu; gerek yoksa boş',
    },
    user: 'Bu fotoğraftaki mantarı tanımla.',
    system: `Sen "Mushly" adlı bir doğa keşif defterinin tür tanıma yardımcısısın. Kullanıcı ormanda gördüğü bir mantarın fotoğrafını gönderir. Görevin, fotoğraftaki mantarın en olası 3 türünü tahmin etmek ve kitaptaki tür sayfası için kısa, sıcak ve bilgilendirici Türkçe metinler yazmak.

Kesin kural: Hiçbir alanda yenebilirlik, zehirlilik, tüketim, tat, yemek, mutfak, tıbbi kullanım ya da sağlık etkisi hakkında bilgi verme veya bunu ima etme. Uygulama bu bilgiyi asla göstermez ve bu tür cümleler otomatik olarak silinir; yazarsan metin eksik kalır. Bir türün Türkçe yaygın adı bu anlamları taşıyorsa (ör. ölüm, zehir, köy göçüren), onun yerine tarafsız, görünüşe dayalı bir ad yaz.

Yönergeler:
- Fotoğraftan tür tespiti belirsizdir. Güven yüzdeleri gerçekçi olsun; emin değilsen düşük ver. Yüzdelerin toplamı 100 olmak zorunda değil.
- Adayları en olasıdan başlayarak sırala, tam 3 aday ver. Birbirine benzeyen türleri ayırt eden görünür özellikleri tanımlarda belirt.
- Nadirlik: Türkiye ve Avrupa ormanlarında ne sıklıkla görüldüğüne göre "common" (Yaygın), "rare" (Nadir), "veryRare" (Çok Nadir).
- Tanım alanları birer cümle, sade ve doğa defteri üslubunda olsun. Tüm metinler Türkçe olsun.
- "Biliyor muydun?" bilgisi ekoloji, biyoloji, tarih veya kültürle ilgili ilginç bir bilgi olsun.
- Fotoğrafta mantar yoksa isMushroom=false ve candidates boş dizi olsun; photoTip alanında nazikçe yeniden çekmeyi öner.
- Fotoğraf bulanık, çok uzak ya da şapka altı görünmüyorsa photoTip alanında kısa bir ipucu ver.`,
  },
};

export function normalizeLanguage(value) {
  return Object.hasOwn(PROMPTS, value) ? value : 'en';
}

export function resultSchema(language = 'en') {
  const d = PROMPTS[normalizeLanguage(language)].schema;
  const text = (description) => ({ type: 'string', description });
  return {
    type: 'object',
    additionalProperties: false,
    required: ['isMushroom', 'photoTip', 'candidates'],
    properties: {
      isMushroom: { type: 'boolean' },
      photoTip: text(d.photoTip),
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['latinName', 'commonName', 'confidence', 'rarity', 'capShape', 'color', 'stem', 'habitat', 'season', 'funFact'],
          properties: {
            latinName: text(d.latinName),
            commonName: text(d.commonName),
            confidence: { type: 'integer', description: d.confidence },
            rarity: { type: 'string', enum: ['common', 'rare', 'veryRare'] },
            capShape: text(d.capShape),
            color: text(d.color),
            stem: text(d.stem),
            habitat: text(d.habitat),
            season: text(d.season),
            funFact: text(d.funFact),
          },
        },
      },
    },
  };
}

const JSON_EXAMPLE =
  '{"isMushroom": true, "photoTip": "", "candidates": [{"latinName": "", "commonName": "", "confidence": 0, "rarity": "common", "capShape": "", "color": "", "stem": "", "habitat": "", "season": "", "funFact": ""}]}';

/** Appended to the instructions for services that can't enforce the response schema */
const JSON_INSTRUCTIONS = {
  en: `

Reply ONLY with a single JSON object in the format below, with no other text:
${JSON_EXAMPLE}
rarity can only be "common", "rare" or "veryRare"; confidence is an integer from 0 to 100.`,
  tr: `

Yanıtını SADECE aşağıdaki biçimde, başka hiçbir metin eklemeden tek bir JSON nesnesi olarak ver:
${JSON_EXAMPLE}
rarity yalnızca "common", "rare" veya "veryRare" olabilir; confidence 0-100 arası tam sayıdır.`,
};

/**
 * Instructions for one request, in the phone's language.
 * - system:     the instructions (for services that enforce the schema, e.g. Claude)
 * - jsonSystem: the instructions plus an explicit JSON format note (Evren, Gemini)
 * - user:       the user message sent with the photo
 */
export function buildPrompt(language = 'en') {
  const lang = normalizeLanguage(language);
  const { system, user } = PROMPTS[lang];
  return { system, user, jsonSystem: system + JSON_INSTRUCTIONS[lang] };
}

/**
 * Our own error type. `code` is what the app shows to the user (translated on the
 * phone); `message` is an English description for server logs.
 */
export class IdentifyError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Extracts the JSON from a model reply. Some models wrap it in ```json ... ```
 * or add a preface, so we take everything between the first "{" and the last "}".
 */
export function parseJsonReply(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new IdentifyError('empty', 'The recognition service returned an empty reply.');
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new IdentifyError('bad-json', 'The recognition reply could not be parsed.');
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new IdentifyError('bad-json', 'The recognition reply could not be parsed.');
  }
}
