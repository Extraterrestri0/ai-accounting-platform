import type { DetectedType } from '../models';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'xml'] as const;
export const ALLOWED_MIME = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'application/xml', 'text/xml',
] as const;

/** Detect file type from leading bytes (deterministic — Invariant 6). Returns null if unrecognized. */
export function detectFileType(prefix: Buffer): DetectedType | null {
  const b = prefix;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'; // %PDF
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
                        (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a))) return 'tiff';
  // XML: optional UTF-8 BOM, then '<?xml' or a '<' followed by a name char
  let i = 0; if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i++;
  if (b[i] === 0x3c) { // '<'
    const next = b[i + 1];
    if (next === 0x3f /* ? */ || (next >= 0x41 && next <= 0x5a) || (next >= 0x61 && next <= 0x7a)) return 'xml';
  }
  return null;
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}
export function isAllowedExtension(ext: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}
