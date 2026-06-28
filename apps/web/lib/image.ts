'use client';

/**
 * Read an image File, resize/crop it to a square `max`×`max` and return a JPEG data URL.
 * Keeps avatars tiny (~10–40 KB) so they fit the server's ~512 KB cap and store inline.
 */
export async function fileToAvatarDataUrl(file: File, max = 256, quality = 0.85): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Файлът трябва да е изображение / File must be an image');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('decode failed'));
    i.src = dataUrl;
  });
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = max;
  canvas.height = max;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, max, max);
  return canvas.toDataURL('image/jpeg', quality);
}
