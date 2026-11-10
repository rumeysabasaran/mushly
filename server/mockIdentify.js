/*
  DEMO RECOGNIZER — used only on the dev server when .env has NO API key.
  It lets you try the whole flow (results → choice → save → celebration) without a key.
  It doesn't identify anything; it returns the same three species in random order.
  (Reference photos still need internet, as they come from iNaturalist.)
*/
import { normalizeLanguage } from './prompt.js';
import { groundResult } from './identify.js';

const SAMPLES = [
  {
    latinName: 'Trametes versicolor',
    rarity: 'common',
    en: {
      commonName: 'Turkey tail',
      capShape: 'Thin, fan-shaped shelves stacked one above another.',
      color: 'Concentric bands of brown, grey and cream.',
      stem: 'It has no stem; it attaches directly to the wood.',
      habitat: 'Forms clusters on dead trunks and stumps of broadleaf trees.',
      season: 'All year',
      funFact: 'Its colorful bands resemble the tail feathers of a wild turkey, which gave it its name.',
      tellApart: 'Look under the cap: it has tiny pores and is thin and leathery, not thick and hard.',
    },
    tr: {
      commonName: 'Hindi kuyruğu mantarı',
      capShape: 'İnce, yelpaze biçimli raflar halinde üst üste dizilir.',
      color: 'Kahve, gri ve krem tonlarında halka halka renk bantları vardır.',
      stem: 'Sapı yoktur; doğrudan oduna tutunur.',
      habitat: 'Ölü yaprak döken ağaç gövdelerinde ve kütüklerde kümeler oluşturur.',
      season: 'Yıl boyu',
      funFact: 'Renkli halkaları yaban hindisinin kuyruk tüylerine benzediği için bu adı almıştır.',
      tellApart: 'Şapkanın altına bak: ince ve deri gibidir, kalın ve sert değildir.',
    },
  },
  {
    latinName: 'Fomes fomentarius',
    rarity: 'common',
    en: {
      commonName: 'Tinder fungus',
      capShape: 'Thick and hard, shaped like a horse’s hoof.',
      color: 'Layered tones between grey and dark brown.',
      stem: 'It has no stem; it attaches to the trunk from the side.',
      habitat: 'Lives for years on the trunks of trees such as beech and birch.',
      season: 'All year',
      funFact: 'Its felt-like inner layer was once used as tinder to start fires.',
      tellApart: 'It is thick, hard and hoof-shaped, with grey bands on top.',
    },
    tr: {
      commonName: 'Kav mantarı',
      capShape: 'At toynağı biçiminde, kalın ve sert bir yapısı vardır.',
      color: 'Gri ile koyu kahve arasında, katman katman tonlar görülür.',
      stem: 'Sapı yoktur; gövdeye yandan tutunur.',
      habitat: 'Kayın ve huş gibi ağaçların gövdelerinde yıllarca yaşar.',
      season: 'Yıl boyu',
      funFact: 'İçindeki keçemsi doku eskiden ateş yakmak için "kav" olarak kullanılırdı.',
      tellApart: 'Kalın, sert ve at toynağı biçimindedir; üstünde gri bantlar vardır.',
    },
  },
  {
    latinName: 'Ganoderma applanatum',
    rarity: 'rare',
    en: {
      commonName: 'Artist’s bracket',
      capShape: 'A wide, flat shelf that extends horizontally.',
      color: 'Brown on top, with a smooth white underside.',
      stem: 'It has no stem.',
      habitat: 'Found at the base of old and dead broadleaf trees.',
      season: 'All year',
      funFact: 'Lines scratched into its white underside turn permanently brown, so people draw pictures on it.',
      tellApart: 'Scratch the white underside gently: if the mark turns brown, it is this one.',
    },
    tr: {
      commonName: 'Ressam mantarı',
      capShape: 'Geniş, yassı ve raf gibi yatay uzanır.',
      color: 'Üstü kahverengi, alt yüzeyi beyaz ve pürüzsüzdür.',
      stem: 'Sapı yoktur.',
      habitat: 'Yaşlı ve ölü yaprak döken ağaçların dibinde bulunur.',
      season: 'Yıl boyu',
      funFact: 'Beyaz alt yüzeyine çizilen çizgiler kalıcı olarak kahveye döner; bu yüzden üzerine resim yapılır.',
      tellApart: 'Beyaz alt yüzeyini hafifçe çiz: iz kahveye dönüyorsa budur.',
    },
  },
];

export async function mockIdentify(body) {
  await new Promise((r) => setTimeout(r, 1200)); // wait a little, like a real request
  const language = normalizeLanguage(body?.language);
  const shuffled = [...SAMPLES].sort(() => Math.random() - 0.5);
  const confidences = [55 + Math.round(Math.random() * 30), 15 + Math.round(Math.random() * 15), 5 + Math.round(Math.random() * 8)];
  const raw = {
    isMushroom: true,
    photoTip: '',
    candidates: shuffled.map((s, i) => ({ latinName: s.latinName, rarity: s.rarity, ...s[language], confidence: confidences[i] })),
  };
  // Grounded like a real result, so demo mode shows iNaturalist names and photos too
  return { status: 200, body: { ...(await groundResult(raw, language)), mock: true } };
}

/** Demo version of /api/describe: the chosen species with iNaturalist name and photos, no descriptions. */
export async function mockDescribe(body) {
  await new Promise((r) => setTimeout(r, 600));
  const language = normalizeLanguage(body?.language);
  const latinName = String(body?.latinName ?? '').trim();
  const grounded = await groundResult({ isMushroom: true, candidates: [{ latinName, confidence: 100 }] }, language);
  return { status: 200, body: { ...(grounded.candidates[0] ?? { latinName }), source: 'user', mock: true } };
}
