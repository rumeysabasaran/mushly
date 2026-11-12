/*
  LOCATION — a one-off reading of where the phone is, with permission.
  Returns { lat, lng, accuracy } (rounded to ~1 m), or throws an error whose
  `code` is 'denied' (no permission) or 'error' (location services off, timeout…).
*/
import * as Location from 'expo-location';

export async function currentCoords() {
  let status;
  try {
    ({ status } = await Location.requestForegroundPermissionsAsync());
  } catch {
    throw Object.assign(new Error('Location unavailable'), { code: 'error' });
  }
  if (status !== 'granted') throw Object.assign(new Error('Location permission denied'), { code: 'denied' });
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      lat: Number(pos.coords.latitude.toFixed(5)),
      lng: Number(pos.coords.longitude.toFixed(5)),
      accuracy: Math.round(pos.coords.accuracy ?? 0),
    };
  } catch (err) {
    console.warn('[location]', err);
    throw Object.assign(new Error('Location unavailable'), { code: 'error' });
  }
}
