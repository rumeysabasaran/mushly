/*
  DATA HOOKS — screens read their data through these.
  Thanks to useLiveQuery, a screen refreshes itself whenever the database changes
  (the same idea as Dexie's useLiveQuery in the old web version).
*/
import { useEffect, useRef, useState } from 'react';
import { tables, subscribe } from './db.js';
import { photoUri } from '../services/photos';
import { needsRewrite, rewriteSpeciesPage } from '../services/collection';
import { badgeProgress } from '../services/badges';
import { tripSummary } from '../services/trips';

/**
 * Runs the query, and runs it again whenever the database changes.
 * Returns `fallback` while loading.
 */
export function useLiveQuery(query, deps = [], fallback = undefined) {
  const [value, setValue] = useState(fallback);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    let alive = true;
    let version = 0;
    const run = () => {
      const mine = ++version;
      queryRef
        .current()
        .then((result) => {
          if (alive && mine === version) setValue(result); // only the latest query's result
        })
        .catch((err) => console.warn('[data]', err));
    };
    run();
    const unsubscribe = subscribe(run);
    return () => {
      alive = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

const EMPTY_STATS = { speciesCount: 0, points: 0, tripCount: 0, pendingCount: 0, badgeCount: 0 };

/** Summary numbers shown on the home and profile screens */
export function useStats() {
  return useLiveQuery(
    async () => {
      const [speciesCount, tripCount, pendingCount, badgeCount, pointRows] = await Promise.all([
        tables.species.count(),
        tables.trips.count(),
        tables.pending.count(),
        tables.badges.count(),
        tables.points.all(),
      ]);
      const points = pointRows.reduce((sum, row) => sum + (row.amount || 0), 0);
      return { speciesCount, points, tripCount, pendingCount, badgeCount };
    },
    [],
    EMPTY_STATS
  );
}

/** Most recent finds (newest first), with their species */
export function useRecentSightings(limit = 5) {
  return useLiveQuery(
    async () => {
      const sightings = await tables.sightings.all({ orderBy: 'foundAt', desc: true, limit });
      const species = await tables.species.bulkGet(sightings.map((s) => s.speciesId));
      const byId = Object.fromEntries(species.map((sp) => [sp.id, sp]));
      return sightings.map((s) => ({ ...s, species: byId[s.speciesId] ?? null }));
    },
    [limit],
    []
  );
}

/**
 * Everything the book needs: species (in order found), finds per species, and drafts.
 * Returns undefined while loading.
 */
export function useBookData() {
  return useLiveQuery(async () => {
    const [species, sightings] = await Promise.all([
      tables.species.all({ orderBy: 'firstFoundAt' }),
      tables.sightings.all(),
    ]);
    const bySpecies = {};
    const drafts = [];
    for (const s of sightings) {
      if (!s.speciesId) drafts.push(s);
      else (bySpecies[s.speciesId] ??= []).push(s);
    }
    Object.values(bySpecies).forEach((list) => list.sort((a, b) => a.foundAt - b.foundAt));
    drafts.sort((a, b) => b.foundAt - a.foundAt);
    return { species, bySpecies, drafts };
  }, []);
}

/** Pending photos (oldest first) */
export function usePendingList() {
  return useLiveQuery(() => tables.pending.all({ orderBy: 'createdAt' }), [], []);
}

/**
 * Turns a photo record into a URI an <Image> can display.
 * variant: 'thumb' (small) or 'full' (large)
 */
export function usePhotoUri(photoId, variant = 'thumb') {
  return useLiveQuery(
    async () => (photoId ? photoUri(await tables.photos.get(photoId), variant) : null),
    [photoId, variant],
    null
  );
}

/**
 * Rewrites, in the app's language, species pages that were saved in another one
 * (e.g. before the app was bilingual). Runs in the background, one page at a time;
 * the book updates by itself as each page is saved. A page that fails (no internet,
 * service busy) is tried again the next time the app starts.
 */
const rewriteTried = new Set();
let rewriting = false;

export function useRewriteForeignPages(species) {
  useEffect(() => {
    if (rewriting || !species?.length) return;
    const queue = species.filter((s) => needsRewrite(s) && !rewriteTried.has(s.id));
    if (!queue.length) return;
    rewriting = true;
    (async () => {
      for (const s of queue) {
        rewriteTried.add(s.id);
        try {
          await rewriteSpeciesPage(s.id);
        } catch {
          // left as it is; tried again on the next app start
        }
      }
    })().finally(() => {
      rewriting = false;
    });
  }, [species]);
}

/**
 * Badges for the profile: when each was earned ({ [key]: earnedAt }) and how far along
 * the user is for the others ({ [key]: { value, target } }).
 */
export function useBadges() {
  return useLiveQuery(
    async () => {
      const [rows, progress] = await Promise.all([tables.badges.all(), badgeProgress()]);
      return { earned: Object.fromEntries(rows.map((b) => [b.id, b.earnedAt])), progress };
    },
    [],
    { earned: {}, progress: {} }
  );
}

/** Everything needed to summarize trips: all trips (newest first) with their finds and numbers */
async function loadTrips() {
  const [trips, sightings, species, points] = await Promise.all([
    tables.trips.all({ orderBy: 'startedAt', desc: true }),
    tables.sightings.all(),
    tables.species.all(),
    tables.points.all(),
  ]);
  const speciesById = Object.fromEntries(species.map((sp) => [sp.id, sp]));
  return trips.map((trip) => {
    const finds = sightings
      .filter((s) => s.tripId === trip.id)
      .sort((a, b) => a.foundAt - b.foundAt)
      .map((s) => ({ ...s, species: speciesById[s.speciesId] ?? null }));
    return { ...trip, finds, summary: tripSummary(trip, finds, sightings, points) };
  });
}

/** The running trip with its finds, or null (undefined while loading) */
export function useActiveTrip() {
  return useLiveQuery(async () => (await loadTrips()).find((trip) => trip.endedAt == null) ?? null, []);
}

/** Finished trips, newest first, each with its finds and summary */
export function useTrips() {
  return useLiveQuery(async () => (await loadTrips()).filter((trip) => trip.endedAt != null), [], []);
}

/** One trip with its finds and summary; null if it doesn't exist (undefined while loading) */
export function useTrip(id) {
  return useLiveQuery(async () => (await loadTrips()).find((trip) => trip.id === id) ?? null, [id]);
}

/** Re-renders every `ms` milliseconds, for live clocks */
export function useTicker(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

const RARITY_ORDER = { veryRare: 3, rare: 2, common: 1 };

/**
 * The profile's highlights: since when the user explores, how many finds, the most seen
 * and rarest species, the longest trip, and the latest point entries.
 */
export function useProfileHighlights() {
  return useLiveQuery(
    async () => {
      const [species, sightings, points, trips] = await Promise.all([
        tables.species.all(),
        tables.sightings.all(),
        tables.points.all(),
        tables.trips.all(),
      ]);
      const speciesById = Object.fromEntries(species.map((sp) => [sp.id, sp]));
      const pick = (list, better) => list.reduce((best, x) => (best == null || better(x, best) ? x : best), null);

      const mostSeen = pick(species, (a, b) => (a.seenCount || 0) > (b.seenCount || 0));
      const rarest = pick(species, (a, b) => {
        const ra = RARITY_ORDER[a.rarity] ?? 0;
        const rb = RARITY_ORDER[b.rarity] ?? 0;
        return ra > rb || (ra === rb && a.firstFoundAt < b.firstFoundAt);
      });
      const finished = trips.filter((trip) => trip.endedAt);
      const longestTrip = pick(finished, (a, b) => a.endedAt - a.startedAt > b.endedAt - b.startedAt);
      // Point rows are rebuilt when finds change, so they're ordered by their find's date
      const foundAt = Object.fromEntries(sightings.map((s) => [s.id, s.foundAt]));
      const recentPoints = points
        .map((p) => ({ ...p, foundAt: foundAt[p.sightingId] ?? 0, species: speciesById[p.speciesId] ?? null }))
        .sort((a, b) => b.foundAt - a.foundAt)
        .slice(0, 5);

      return {
        since: species.length ? Math.min(...species.map((sp) => sp.firstFoundAt)) : null,
        findCount: sightings.length,
        mostSeen: mostSeen && (mostSeen.seenCount || 0) > 1 ? mostSeen : null,
        rarest,
        longestTrip,
        recentPoints,
      };
    },
    [],
    { since: null, findCount: 0, mostSeen: null, rarest: null, longestTrip: null, recentPoints: [] }
  );
}
