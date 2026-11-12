/*
  COLLECTION — the operations that write photos and finds to the database.

  Flow:
  - Species NOT in the book yet → a new species page opens; points are earned by rarity.
  - Species ALREADY in the book → its sighting count goes up; a small bonus is earned.
  - "I'm not sure" → saved as a draft find, no points (the species can be picked later).

  Point rule (per species): the earliest find earns the new-species points, every other
  find earns the repeat bonus. This is recalculated when a find is deleted or re-dated.
*/
import { tables, transaction, withMeta, newId } from '../data/db.js';
import { RARITY, REPEAT_BONUS, levelFor } from '../data/gamification.js';
import { checkBadges } from './badges';
import { tripFor } from './trips';
import { language } from '../i18n';
import { commonNameOf, lacksTurkishLetters, pageTexts } from './safety.js';
import { storePhotoFiles, deletePhotoFiles } from './photos';
import { describeSpecies } from './recognizer';

const { species: Species, sightings: Sightings, photos: Photos, points: Points } = tables;

/** Unique key from a Latin name: "Trametes  Versicolor" → "trametes versicolor" */
export function speciesKeyOf(latinName) {
  return String(latinName).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Shrinks and stores a photo from the camera or gallery; returns the record id. */
export async function savePhoto(asset) {
  const id = newId();
  const files = await storePhotoFiles(asset, id);
  await Photos.put(withMeta({ id, ...files, sightingId: null }));
  return id;
}

/** Deletes a photo that was abandoned before saving. */
export async function deletePhoto(photoId) {
  if (!photoId) return;
  const photo = await Photos.get(photoId);
  await Photos.delete(photoId);
  deletePhotoFiles(photo);
}

/** Links the chosen candidate to a species page in the book (opening one if needed). */
async function attachToSpecies(candidate, photoId, foundAt) {
  const now = Date.now();
  const speciesKey = speciesKeyOf(candidate.latinName);
  let species = (await Species.where('speciesKey', speciesKey))[0];

  if (species) {
    const changes = {
      seenCount: (species.seenCount || 1) + 1,
      firstFoundAt: Math.min(species.firstFoundAt, foundAt),
      lastSeenAt: Math.max(species.lastSeenAt || 0, foundAt),
      updatedAt: now,
    };
    species = await Species.update(species.id, changes);
    return { species, isNew: false, pointsEarned: REPEAT_BONUS };
  }

  species = withMeta({
    speciesKey,
    latinName: candidate.latinName,
    commonName: commonNameOf(candidate),
    taxonId: candidate.taxonId ?? null, // iNaturalist taxon id, when recognition was grounded
    language, // the language the description was written in
    rarity: candidate.rarity,
    description: {
      capShape: candidate.capShape,
      color: candidate.color,
      stem: candidate.stem,
      habitat: candidate.habitat,
      season: candidate.season,
    },
    funFact: candidate.funFact,
    coverPhotoId: photoId,
    firstFoundAt: foundAt,
    lastSeenAt: foundAt,
    seenCount: 1,
  });
  await Species.put(species);
  return { species, isNew: true, pointsEarned: (RARITY[candidate.rarity] ?? RARITY.common).points };
}

/** Recalculates a species' points: the earliest find earns new-species points, the rest the repeat bonus. */
async function recomputeSpeciesPoints(speciesId) {
  await Points.deleteWhere('speciesId', speciesId);
  const species = await Species.get(speciesId);
  if (!species) return;
  const sightings = (await Sightings.where('speciesId', speciesId)).sort((a, b) => a.foundAt - b.foundAt);
  const rows = sightings.map((s, i) =>
    withMeta({
      amount: i === 0 ? (RARITY[species.rarity] ?? RARITY.common).points : REPEAT_BONUS,
      reason: i === 0 ? 'new-species' : 'repeat',
      sightingId: s.id,
      speciesId,
      tripId: s.tripId ?? null,
    })
  );
  await Points.bulkPut(rows);
}

/** Recalculates a species' dates and sighting count from its finds. */
async function refreshSpecies(speciesId) {
  const sightings = await Sightings.where('speciesId', speciesId);
  if (sightings.length === 0) {
    await Species.delete(speciesId); // the last find was deleted, so the page goes too
    return;
  }
  const times = sightings.map((s) => s.foundAt);
  const species = await Species.get(speciesId);
  const coverStillExists = sightings.some((s) => s.photoId === species?.coverPhotoId);
  await Species.update(speciesId, {
    firstFoundAt: Math.min(...times),
    lastSeenAt: Math.max(...times),
    seenCount: sightings.length,
    ...(coverStillExists ? {} : { coverPhotoId: [...sightings].sort((a, b) => a.foundAt - b.foundAt)[0].photoId }),
    updatedAt: Date.now(),
  });
}

/** The total score: the sum of every point entry */
export async function totalPoints() {
  const rows = await Points.all();
  return rows.reduce((sum, row) => sum + (row.amount || 0), 0);
}

/**
 * Runs a save and works out what it unlocked: badges earned just now and, if the score
 * crossed a level threshold, the new level. Added to the result as
 * { newBadges: ['firstFind', …], newLevel: 'wanderer' | null }.
 */
async function withRewards(save) {
  const before = levelFor(await totalPoints()).current;
  const result = await save();
  let newBadges = [];
  let newLevel = null;
  try {
    newBadges = await checkBadges();
    const after = levelFor(await totalPoints()).current;
    if (after.minPoints > before.minPoints) newLevel = after.key;
  } catch (err) {
    console.warn('[rewards]', err); // the find is saved either way
  }
  return { ...result, newBadges, newLevel };
}

/**
 * Saves a find.
 * @param {object} p
 * @param {string} p.photoId
 * @param {object|null} p.candidate   The chosen species; null for a draft
 * @param {object[]} p.candidates     Every candidate recognition suggested (kept for drafts)
 * @param {object} p.notes            Field notes { weather, companions, note, location }
 * @param {number} p.foundAt          When it was found (ms)
 * @returns {{type:'new'|'repeat'|'draft', species, sighting, pointsEarned, newBadges, newLevel}}
 */
export async function recordSighting({ photoId, candidate = null, candidates = [], notes = {}, foundAt = Date.now() }) {
  const trip = await tripFor(foundAt); // the trip it was found on, by time

  return withRewards(() => transaction(async () => {
    const attached = candidate ? await attachToSpecies(candidate, photoId, foundAt) : null;

    const sighting = withMeta({
      speciesId: attached?.species.id ?? null,
      photoId,
      tripId: trip?.id ?? null,
      foundAt,
      status: candidate ? 'confirmed' : 'draft',
      confidence: candidate?.confidence ?? null,
      candidates,
      notes,
    });
    await Sightings.put(sighting);
    await Photos.update(photoId, { sightingId: sighting.id, updatedAt: Date.now() });
    if (attached) await recomputeSpeciesPoints(attached.species.id);

    return {
      type: !attached ? 'draft' : attached.isNew ? 'new' : 'repeat',
      species: attached?.species ?? null,
      sighting,
      pointsEarned: attached?.pointsEarned ?? 0,
    };
  }));
}

/** Picks the species of a draft later on. Returns points and a celebration like a normal save. */
export async function resolveDraft(sightingId, candidate) {
  return withRewards(() => transaction(async () => {
    const sighting = await Sightings.get(sightingId);
    if (!sighting || sighting.speciesId) throw new Error('Draft not found.');

    const attached = await attachToSpecies(candidate, sighting.photoId, sighting.foundAt);
    await Sightings.update(sightingId, {
      speciesId: attached.species.id,
      status: 'confirmed',
      confidence: candidate.confidence ?? null,
      updatedAt: Date.now(),
    });
    await recomputeSpeciesPoints(attached.species.id);

    return { type: attached.isNew ? 'new' : 'repeat', species: attached.species, pointsEarned: attached.pointsEarned };
  }));
}

/** Updates a find's field notes and date. */
export async function updateSighting(sightingId, { foundAt, notes }) {
  return transaction(async () => {
    const sighting = await Sightings.get(sightingId);
    if (!sighting) return;
    const dateChanged = foundAt !== sighting.foundAt;
    const tripId = dateChanged ? ((await tripFor(foundAt))?.id ?? null) : sighting.tripId ?? null;
    await Sightings.update(sightingId, { foundAt, notes, tripId, updatedAt: Date.now() });
    if (sighting.speciesId && dateChanged) {
      await refreshSpecies(sighting.speciesId);
      await recomputeSpeciesPoints(sighting.speciesId); // the "first find" may have changed
    }
  });
}

/** Deletes a find together with its photo and points. Removes the page if it was the last find. */
export async function deleteSighting(sightingId) {
  const photo = await transaction(async () => {
    const sighting = await Sightings.get(sightingId);
    if (!sighting) return null;
    const photoRecord = await Photos.get(sighting.photoId);
    await Sightings.delete(sightingId);
    await Photos.delete(sighting.photoId);
    await Points.deleteWhere('sightingId', sightingId);
    if (sighting.speciesId) {
      await refreshSpecies(sighting.speciesId);
      await recomputeSpeciesPoints(sighting.speciesId);
    }
    return photoRecord;
  });
  // Files are deleted only after the database transaction succeeded
  if (photo) deletePhotoFiles(photo);
}

/**
 * True when a species page should be written again: it is in another language than the
 * app's (or from before pages had one), or its Turkish text lacks Turkish letters.
 */
export function needsRewrite(species) {
  if (!species) return false;
  if (species.language !== language) return true;
  // Checked once: a page already rewritten for this isn't rewritten again on every start
  return language === 'tr' && !species.lettersChecked && lacksTurkishLetters(pageTexts(species));
}

/**
 * Rewrites a species page's descriptions and fun fact in the app's language, looking at
 * its cover photo. Used for pages saved in another language (e.g. before the app was
 * bilingual). The Latin name, rarity and points stay as they were.
 */
export async function rewriteSpeciesPage(speciesId) {
  const species = await Species.get(speciesId);
  if (!needsRewrite(species)) return;
  const photo = await Photos.get(species.coverPhotoId);
  if (!photo) return;
  const written = await describeSpecies(photo, { latinName: species.latinName, taxonId: species.taxonId, referencePhotos: [] });
  const hasText = [written.capShape, written.color, written.stem, written.habitat, written.season, written.funFact].some(Boolean);
  if (!hasText) throw new Error('The rewritten page came back empty.'); // keep the old text rather than wipe it
  await Species.update(speciesId, {
    commonName: written.commonName || '',
    taxonId: species.taxonId ?? written.taxonId ?? null,
    language,
    lettersChecked: true,
    description: {
      capShape: written.capShape,
      color: written.color,
      stem: written.stem,
      habitat: written.habitat,
      season: written.season,
    },
    funFact: written.funFact,
    updatedAt: Date.now(),
  });
}

/** Replaces the polaroid on a species page with another photo. */
export async function setCoverPhoto(speciesId, photoId) {
  await Species.update(speciesId, { coverPhotoId: photoId, updatedAt: Date.now() });
}
