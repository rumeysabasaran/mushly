/*
  PENDING QUEUE
  Photos taken without internet land here. When the connection returns (or the app
  is opened / brought to the foreground) they are identified one by one and marked
  "ready". The user then picks the species from the Pending screen and saves it.

  Statuses: waiting → processing → ready | error
*/
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { tables, withMeta } from '../data/db.js';
import { identify, OfflineError, isOnline } from './recognizer.js';
import { deletePhoto } from './collection.js';

const { pending: Pending, photos: Photos } = tables;
let running = false;

export async function addPending(photoId, reason = 'offline') {
  const item = withMeta({ photoId, status: 'waiting', reason, result: null, errorCode: '' });
  await Pending.put(item);
  processPending(); // try right away if there is a connection
  return item.id;
}

/** Tries to identify every waiting photo in turn. Only one run at a time. */
export async function processPending() {
  if (running) return;
  running = true;
  try {
    if (!(await isOnline())) return;
    const items = await Pending.all({ orderBy: 'createdAt' });
    for (const item of items) {
      if (item.status !== 'waiting') continue;

      const photo = await Photos.get(item.photoId);
      if (!photo) {
        await Pending.delete(item.id); // the photo was deleted
        continue;
      }

      await Pending.update(item.id, { status: 'processing', updatedAt: Date.now() });
      try {
        const result = await identify(photo);
        await Pending.update(item.id, { status: 'ready', result, errorCode: '', updatedAt: Date.now() });
      } catch (err) {
        if (err instanceof OfflineError) {
          await Pending.update(item.id, { status: 'waiting', updatedAt: Date.now() });
          break; // the connection dropped again; try the rest later
        }
        await Pending.update(item.id, { status: 'error', errorCode: err.code || 'generic', updatedAt: Date.now() });
      }
    }
  } catch (err) {
    console.warn('[pending]', err);
  } finally {
    running = false;
  }
}

/** Puts a failed item back in the queue. */
export async function retryPending(id) {
  await Pending.update(id, { status: 'waiting', errorCode: '', errorMessage: '', updatedAt: Date.now() });
  return processPending();
}

/** Deletes a pending item. keepPhoto: don't delete the photo if it was saved to the journal. */
export async function removePending(id, { keepPhoto = false } = {}) {
  const item = await Pending.get(id);
  await Pending.delete(id);
  if (item && !keepPhoto) await deletePhoto(item.photoId);
}

/** Called once on app start: fixes interrupted items and listens for the connection. */
export async function startPendingWatcher() {
  // If the app closed while "processing", put those items back in the queue
  const stuck = (await Pending.all()).filter((p) => p.status === 'processing');
  for (const p of stuck) await Pending.update(p.id, { status: 'waiting' });

  let wasOnline = true;
  const netSub = NetInfo.addEventListener((state) => {
    const online = state.isConnected !== false && state.isInternetReachable !== false;
    if (online && !wasOnline) processPending();
    wasOnline = online;
  });
  const appSub = AppState.addEventListener('change', (s) => s === 'active' && processPending());

  processPending();
  return () => {
    netSub();
    appSub.remove();
  };
}
