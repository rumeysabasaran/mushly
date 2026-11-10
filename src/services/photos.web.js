/*
  PHOTOS (web preview) — the same jobs as photos.js, in the browser.
  The browser has no file folder, so resized photos are stored in the database
  as text (data URIs). Only used while developing on the computer.
*/
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

async function resized(uri, width, height, maxSide, compress) {
  const context = ImageManipulator.manipulate(uri);
  if (width && height && Math.max(width, height) > maxSide) {
    const scale = maxSide / Math.max(width, height);
    context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  return `data:image/jpeg;base64,${result.base64}`;
}

export async function storePhotoFiles(asset) {
  try {
    return {
      full: await resized(asset.uri, asset.width, asset.height, 1280, 0.85),
      thumb: await resized(asset.uri, asset.width, asset.height, 360, 0.75),
    };
  } catch (err) {
    console.warn('[photos] could not store', err);
    throw Object.assign(new Error('The photo could not be prepared.'), { code: 'photo-prepare' });
  }
}

export function photoUri(photo, variant = 'thumb') {
  return photo?.[variant] ?? null;
}

export async function photoBase64(photo) {
  return String(photo.full).split(',')[1] ?? '';
}

export function deletePhotoFiles() {
  /* deleted together with the database record */
}
