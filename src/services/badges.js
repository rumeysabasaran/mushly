/*
  BADGES — the rules that award them.

  Each rule reads the journal and returns how far along the user is ({ value, target }).
  A badge is earned once value reaches target, and is kept for good: deleting a find
  later doesn't take a badge away.

  checkBadges() runs after every save (and once when the app opens, so journals from
  before badges existed get theirs too). It returns the badges earned just now, for the
  celebration card.
*/
import { tables, withMeta } from '../data/db.js';
import { BADGES } from '../data/gamification.js';

const AUTUMN_MONTHS = [8, 9, 10]; // September, October, November (JS months start at 0)
const RAIN_WEATHER = ['rainy', 'afterRain'];

/** The local calendar day of a time, e.g. "2026-11-13" */
function dayOf(time) {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** The largest number of different species found within one group (day, autumn…) */
function mostSpeciesPerGroup(sightings, groupOf) {
  const groups = new Map();
  for (const s of sightings) {
    const key = groupOf(s);
    if (key == null) continue;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(s.speciesId);
  }
  return Math.max(0, ...[...groups.values()].map((set) => set.size));
}

/** How far along the user is for every badge: { [key]: { value, target } } */
export async function badgeProgress() {
  const [species, allSightings, trips] = await Promise.all([tables.species.all(), tables.sightings.all(), tables.trips.all()]);
  const sightings = allSightings.filter((s) => s.speciesId); // drafts don't count
  const speciesCount = species.length;

  const autumnSpecies = mostSpeciesPerGroup(sightings, (s) => {
    const d = new Date(s.foundAt);
    return AUTUMN_MONTHS.includes(d.getMonth()) ? d.getFullYear() : null;
  });
  const busiestDay = mostSpeciesPerGroup(sightings, (s) => dayOf(s.foundAt));
  const rainyFinds = sightings.filter((s) => RAIN_WEATHER.includes(s.notes?.weather)).length;
  const veryRare = species.filter((s) => s.rarity === 'veryRare').length;
  const finishedTrips = trips.filter((trip) => trip.endedAt).length;
  const mostSeen = Math.max(0, ...species.map((s) => s.seenCount || 0));

  return {
    firstFind: { value: speciesCount, target: 1 },
    species5: { value: speciesCount, target: 5 },
    species10: { value: speciesCount, target: 10 },
    species25: { value: speciesCount, target: 25 },
    autumn: { value: autumnSpecies, target: 10 },
    busyDay: { value: busiestDay, target: 5 },
    afterRain: { value: rainyFinds, target: 1 },
    sharpEye: { value: veryRare, target: 1 },
    trailFriend: { value: finishedTrips, target: 5 },
    oldFriend: { value: mostSeen, target: 5 },
  };
}

/** Awards every badge whose goal is reached. Returns the keys of badges earned just now. */
export async function checkBadges() {
  const [progress, earned] = await Promise.all([badgeProgress(), tables.badges.all()]);
  const have = new Set(earned.map((b) => b.id));
  const fresh = BADGES.filter((b) => !have.has(b.key) && progress[b.key].value >= progress[b.key].target).map((b) => b.key);
  if (fresh.length) {
    const now = Date.now();
    await tables.badges.bulkPut(fresh.map((key) => withMeta({ id: key, earnedAt: now })));
  }
  return fresh;
}
