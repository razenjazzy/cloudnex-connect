import { inflateSync } from 'zlib';

/** LINE-safe 400×260 camera / no-photo PNG (no extra asset copy in the image). */
export const CATALOG_PLACEHOLDER_PNG = Buffer.from(
  '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',
  'base64',
);

const crc32 = (buf: Buffer): number => {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
};

/** True when the PNG has a valid signature, matching chunk CRCs, the given size, and inflatable RGB pixels. */
export const isValidPng = (png: Buffer, width: number, height: number): boolean => {
  try {
    if (png.length < 33 || !png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return false;
    const idat: Buffer[] = [];
    let offset = 8;
    let sized = false;
    while (offset + 12 <= png.length) {
      const length = png.readUInt32BE(offset);
      const type = png.subarray(offset + 4, offset + 8);
      const data = png.subarray(offset + 8, offset + 8 + length);
      if (crc32(Buffer.concat([type, data])) !== png.readUInt32BE(offset + 8 + length)) return false;
      if (type.toString() === 'IHDR') sized = data.readUInt32BE(0) === width && data.readUInt32BE(4) === height;
      if (type.toString() === 'IDAT') idat.push(data);
      offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(idat));
    return sized && raw.length === height * (1 + width * 3);
  } catch (error) {
    console.warn('catalog placeholder PNG failed validation:', error);
    return false;
  }
};
