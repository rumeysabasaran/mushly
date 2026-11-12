/*
  TRIPS — a walk with a start and an end. Every find made in between belongs to it.

  - startTrip()  opens a trip (only one can run at a time)
  - endTrip()    closes it; the badge rules run, since "Trail Friend" counts trips
  - tripFor()    the trip a find made at a given time belongs to. Finds are matched by
                 when they were found, not when they were saved, so a photo taken
                 offline during a walk and identified later still lands in that walk.
  - tripSummary() the numbers on a trip's memory page

  Deleting a trip keeps its finds; they just no longer belong to a trip.
*/
import { tables, transaction, withMeta } from '../data/db.js';
import { checkBadges } from './badges';

const { trips: Trips, sightings: Sightings, points: Points } = tables;

/** The trip that is running right now, or null */
export async function activeTrip() {
  return (await Trips.where('endedAt', null))[0] ?? null;
}

/** Starts a trip. name and location ({ placeName, lat, lng, accuracy }) are optional. */
export async function startTrip({ name = '', location = null } = {}) {
  const running = await activeTrip();
  if (running) return running;
  const trip = withMeta({ name: name.trim(), location, startedAt: Date.now(), endedAt: null });
  await Trips.put(trip);
  return trip;
}

/** Ends a trip. Returns { trip, newBadges }. */
export async function endTrip(tripId) {
  const trip = await Trips.update(tripId, { endedAt: Date.now(), updatedAt: Date.now() });
  let newBadges = [];
  try {
    newBadges = await checkBadges();
  } catch (err) {
    console.warn('[badges]', err);
  }
  return { trip, newBadges };
}

export async function renameTrip(tripId, name) {
  await Trips.update(tripId, { name: name.trim(), updatedAt: Date.now() });
}

/** Deletes a trip; its finds and points stay, without a trip. */
export async function deleteTrip(tripId) {
  await transaction(async () => {
    const now = Date.now();
    for (const s of await Sightings.where('tripId', tripId)) await Sightings.update(s.id, { tripId: null, updatedAt: now });
    for (const p of await Points.all()) if (p.tripId === tripId) await Points.update(p.id, { tripId: null, updatedAt: now });
    await Trips.delete(tripId);
  });
}

/** The trip a find made at `foundAt` belongs to (a running trip has no end yet). */
export async function tripFor(foundAt) {
  const trips = await Trips.all();
  const match = trips.find((trip) => foundAt >= trip.startedAt && (trip.endedAt == null || foundAt <= trip.endedAt));
  return match ?? null;
}

/**
 * The numbers for a trip. `sightings` are the trip's finds, `allSightings` every find
 * (to tell which species were seen for the first time on this trip).
 */
export function tripSummary(trip, sightings, allSightings, pointRows) {
  const finds = sightings.filter((s) => s.speciesId);
  const speciesIds = new Set(finds.map((s) => s.speciesId));
  const firstSeen = new Map();
  for (const s of allSightings) {
    if (!s.speciesId) continue;
    const earliest = firstSeen.get(s.speciesId);
    if (!earliest || s.foundAt < earliest.foundAt) firstSeen.set(s.speciesId, s);
  }
  const newSpecies = [...speciesIds].filter((id) => firstSeen.get(id)?.tripId === trip.id);
  const end = trip.endedAt ?? Date.now();
  return {
    duration: Math.max(0, end - trip.startedAt),
    findCount: sightings.length,
    speciesCount: speciesIds.size,
    newSpeciesIds: newSpecies,
    points: pointRows.filter((p) => p.tripId === trip.id).reduce((sum, p) => sum + (p.amount || 0), 0),
  };
}
