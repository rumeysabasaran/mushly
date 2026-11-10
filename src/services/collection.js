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
import { RARITY, REPEAT_BONUS } from '../data/gamification.js';
import { language } from '../i18n';
import { commonNameOf } from './safety.js';
import { storePhotoFiles, deletePhotoFiles } from './photos';

const { species: Species, sightings: Sightings, photos: Photos, points: Points, trips: Trips } = tables;

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

/**
 * Saves a find.
 * @param {object} p
 * @param {string} p.photoId
 * @param {object|null} p.candidate   The chosen species; null for a draft
 * @param {object[]} p.candidates     Every candidate recognition suggested (kept for drafts)
 * @param {object} p.notes            Field notes { weather, companions, note, location }
 * @param {number} p.foundAt          When it was found (ms)
 * @returns {{type:'new'|'repeat'|'draft', species, sighting, pointsEarned}}
 */
export async function recordSighting({ photoId, candidate = null, candidates = [], notes = {}, foundAt = Date.now() }) {
  const activeTrip = (await Trips.where('endedAt', null))[0];

  return transaction(async () => {
    const attached = candidate ? await attachToSpecies(candidate, photoId, foundAt) : null;

    const sighting = withMeta({
      speciesId: attached?.species.id ?? null,
      photoId,
      tripId: activeTrip?.id ?? null,
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
  });
}

/** Picks the species of a draft later on. Returns points and a celebration like a normal save. */
export async function resolveDraft(sightingId, candidate) {
  return transaction(async () => {
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
  });
}

/** Updates a find's field notes and date. */
export async function updateSighting(sightingId, { foundAt, notes }) {
  return transaction(async () => {
    const sighting = await Sightings.get(sightingId);
    if (!sighting) return;
    await Sightings.update(sightingId, { foundAt, notes, updatedAt: Date.now() });
    if (sighting.speciesId && foundAt !== sighting.foundAt) {
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

/** Replaces the polaroid on a species page with another photo. */
export async function setCoverPhoto(speciesId, photoId) {
  await Species.update(speciesId, { coverPhotoId: photoId, updatedAt: Date.now() });
}
