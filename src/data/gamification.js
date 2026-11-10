/*
  GAMIFICATION — points, levels and badges.
  The rules themselves arrive in stage 4; for now this is the list of what exists.
  Display names live in the i18n dictionaries (`rarity.*`, `levels.*`, `badges.*`).
*/
import { t } from '../i18n';

export const RARITY = {
  common: { key: 'common', points: 10 },
  rare: { key: 'rare', points: 25 },
  veryRare: { key: 'veryRare', points: 50 },
};

export function rarityLabel(key) {
  return RARITY[key] ? t(`rarity.${key}`) : '';
}

/** Small bonus for finding a species you already have */
export const REPEAT_BONUS = 2;

/** Levels: the title unlocks once you reach minPoints */
export const LEVELS = [
  { key: 'novice', minPoints: 0 },
  { key: 'wanderer', minPoints: 60 },
  { key: 'enthusiast', minPoints: 180 },
  { key: 'researcher', minPoints: 450 },
  { key: 'mycologist', minPoints: 1000 },
];

export function levelTitle(level) {
  return level ? t(`levels.${level.key}`) : '';
}

/** Badges (icon: an icon name from ui/Icon.jsx) */
export const BADGES = [
  { key: 'firstFind', icon: 'mushroom' },
  { key: 'species5', icon: 'leaf' },
  { key: 'species10', icon: 'leaf' },
  { key: 'species25', icon: 'leaf' },
  { key: 'autumn', icon: 'autumn' },
  { key: 'busyDay', icon: 'sun' },
  { key: 'afterRain', icon: 'rain' },
  { key: 'sharpEye', icon: 'sparkle' },
  { key: 'trailFriend', icon: 'trail' },
  { key: 'oldFriend', icon: 'eye' },
];

export function badgeText(badge) {
  return { title: t(`badges.${badge.key}.title`), description: t(`badges.${badge.key}.description`) };
}

/** Returns the current level for a point total and the progress towards the next one. */
export function levelFor(points) {
  let index = 0;
  LEVELS.forEach((lvl, i) => {
    if (points >= lvl.minPoints) index = i;
  });
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  const progress = next
    ? (points - current.minPoints) / (next.minPoints - current.minPoints)
    : 1;
  return { current, next, index, progress: Math.max(0, Math.min(1, progress)) };
}
