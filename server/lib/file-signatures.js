/**
 * Validates file magic bytes against allowed content types.
 * Enforces SECURITY rules: signature check, allow-list.
 */

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/zip',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
]);

export function isAllowedMimeType(mime) {
  return ALLOWED_MIME_TYPES.has(mime.toLowerCase());
}

export function validateMagicBytes(buffer, declaredMime) {
  if (!buffer || buffer.length === 0) return false;
  const mime = declaredMime.toLowerCase();

  if (mime === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }

  if (mime === 'image/png') {
    return buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
  }

  if (mime === 'image/gif') {
    return buffer.length >= 4 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
  }

  if (mime === 'image/webp') {
    return buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  }

  if (mime === 'application/pdf') {
    return buffer.length >= 4 &&
      buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  if (mime === 'application/zip') {
    return buffer.length >= 4 &&
      buffer[0] === 0x50 && buffer[1] === 0x4B &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
      (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08);
  }

  // Text types (plain, csv, markdown, json) - verify no null bytes
  if (['text/plain', 'text/csv', 'text/markdown', 'application/json'].includes(mime)) {
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0) return false;
    }
    return true;
  }

  return false;
}
