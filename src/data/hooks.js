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
