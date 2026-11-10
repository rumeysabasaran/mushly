/*
  PHOTOS (phone) — resizing, storing, deleting.

  Phone cameras take very large photos (3–8 MB). To save space on the device and
  send them to the recognition service quickly, two sizes are stored:
  - full:  longest side 1280 px → for recognition and the book page
  - thumb: longest side 360 px  → for small previews in lists

  Files live in the app's own folder (Documents/photos). Only the file NAME is stored
  in the database, never the full path: on iPhone the folder path can change when the
  app updates, but the name does not.

  Note: photos.web.js does the same jobs for the web preview.
*/
import { File, Directory, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const FULL_SIDE = 1280;
const THUMB_SIDE = 360;

function photosDir() {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Shrinks the image so its longest side is maxSide (leaves smaller images alone) */
async function resized(uri, width, height, maxSide, compress) {
  const context = ImageManipulator.manipulate(uri);
  if (width && height && Math.max(width, height) > maxSide) {
    const scale = maxSide / Math.max(width, height);
    context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress });
  return result.uri;
}

/**
 * Stores a camera / gallery photo in two sizes.
 * @param {{uri:string, width?:number, height?:number}} asset  an expo-image-picker result
 * @param {string} id  the photo record's id (used in the file names)
 * @returns {{ full: string, thumb: string }} file names
 */
export async function storePhotoFiles(asset, id) {
  try {
    const dir = photosDir();
    const fullTemp = await resized(asset.uri, asset.width, asset.height, FULL_SIDE, 0.85);
    const thumbTemp = await resized(asset.uri, asset.width, asset.height, THUMB_SIDE, 0.75);

    const full = `${id}-full.jpg`;
    const thumb = `${id}-thumb.jpg`;
    await new File(fullTemp).move(new File(dir, full), { overwrite: true });
    await new File(thumbTemp).move(new File(dir, thumb), { overwrite: true });
    return { full, thumb };
  } catch (err) {
    console.warn('[photos] could not store', err);
    throw Object.assign(new Error('The photo could not be prepared.'), { code: 'photo-prepare' });
  }
}

/** A displayable URI for a photo record. variant: 'full' | 'thumb' */
export function photoUri(photo, variant = 'thumb') {
  const name = photo?.[variant];
  if (!name) return null;
  return new File(Paths.document, 'photos', name).uri;
}

/** The large photo as base64, for sending to the recognition service */
export async function photoBase64(photo) {
  const file = new File(Paths.document, 'photos', photo.full);
  if (!file.exists) throw Object.assign(new Error('The photo file was not found.'), { code: 'photo-missing' });
  return file.base64();
}

/** Deletes a photo's files (silently skips missing ones) */
export function deletePhotoFiles(photo) {
  for (const variant of ['full', 'thumb']) {
    if (!photo?.[variant]) continue;
    try {
      const file = new File(Paths.document, 'photos', photo[variant]);
      if (file.exists) file.delete();
    } catch (err) {
      console.warn('[photos] could not delete', err);
    }
  }
}
