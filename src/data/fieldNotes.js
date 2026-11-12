/*
  FIELD NOTE OPTIONS AND DATE HELPERS
  Weather keys will also be used by badges (e.g. "After-Rain Seeker").
  Labels live in the i18n dictionaries under `weather.<key>`.
*/
import { localeTag, t } from '../i18n';

export const WEATHER_KEYS = ['sunny', 'cloudy', 'rainy', 'afterRain', 'foggy', 'snowy'];

export function weatherLabel(key) {
  return WEATHER_KEYS.includes(key) ? t(`weather.${key}`) : '';
}

/** Converts a timestamp to the "YYYY-MM-DD" format a date input expects */
export function timeToInputValue(time) {
  const d = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's date as "YYYY-MM-DD" (for the date input) */
export function todayInputValue() {
  return timeToInputValue(Date.now());
}

/** Converts a date input value back to a timestamp. Uses the current time if it is today. */
export function inputValueToTime(value) {
  if (!value || value === todayInputValue()) return Date.now();
  return new Date(`${value}T12:00:00`).getTime();
}

export function formatDate(time, withYear = true) {
  return new Date(time).toLocaleDateString(localeTag, {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** "14:05" */
export function formatTime(time) {
  return new Date(time).toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });
}

/** A length of time: "1 h 20 min" / "1 sa 20 dk", or just minutes under an hour */
export function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? t('duration.hm', { h, m }) : t('duration.m', { m });
}

/** A trip's name, or "Walk on 13 November" when it has none */
export function tripName(trip) {
  return trip?.name || t('trips.untitled', { date: formatDate(trip?.startedAt ?? Date.now(), false) });
}
