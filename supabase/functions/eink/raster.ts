import { transliterate } from './font.ts';
import type { BFont } from './fonts.ts';

/*
 * Minimal 1-bit rasterizer for the 800×480 e-ink panel. Bit set = black ink.
 * Text is drawn from Spleen bitmap fonts (see fonts.ts) at native resolution —
 * no scaling, no staircase.
 */

export class Bitmap {
  readonly width: number;
  readonly height: number;
  private rowBytes: number;
  private bits: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.rowBytes = Math.ceil(width / 8);
    this.bits = new Uint8Array(this.rowBytes * height); // 0 = white
  }

  set(x: number, y: number, ink = true): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.rowBytes + (x >> 3);
    const mask = 0x80 >> (x & 7);
    if (ink) this.bits[i] |= mask;
    else this.bits[i] &= ~mask;
  }

  fillRect(x: number, y: number, w: number, h: number, ink = true): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ink);
    }
  }

  /** Rectangle outline with the given stroke thickness. */
  rect(x: number, y: number, w: number, h: number, stroke = 1): void {
    this.fillRect(x, y, w, stroke);
    this.fillRect(x, y + h - stroke, w, stroke);
    this.fillRect(x, y, stroke, h);
    this.fillRect(x + w - stroke, y, stroke, h);
  }

  hline(x: number, y: number, w: number, thickness = 1): void {
    this.fillRect(x, y, w, thickness);
  }
  vline(x: number, y: number, h: number, thickness = 1): void {
    this.fillRect(x, y, thickness, h);
  }

  /** Advance width of a string in a font (monospace cells). */
  static textW(font: BFont, text: string): number {
    return transliterate(text).length * font.w;
  }

  /** Truncate (with "..") so the text fits within maxW. */
  static fit(font: BFont, text: string, maxW: number): string {
    const t = transliterate(text);
    if (Bitmap.textW(font, t) <= maxW) return t;
    const chars = Math.max(1, Math.floor(maxW / font.w) - 2);
    return `${t.slice(0, chars)}..`;
  }

  /** Draw text; `invert` = white-on-black (caller paints the black bg). */
  drawText(
    font: BFont,
    x: number,
    y: number,
    text: string,
    invert = false,
  ): number {
    let cx = x;
    for (const ch of transliterate(text)) {
      const rows = font.g[ch] ?? font.g['?'] ?? [];
      for (let gy = 0; gy < font.h; gy++) {
        const row = rows[gy] ?? 0;
        for (let gx = 0; gx < font.w; gx++) {
          if ((row >> (font.w - 1 - gx)) & 1) this.set(cx + gx, y + gy, !invert);
        }
      }
      cx += font.w;
    }
    return cx;
  }

  /** Packed framebuffer for the panel: row-major, MSB = leftmost, 1 = black. */
  toRaw(): Uint8Array {
    return this.bits.slice();
  }

  /** 1-bit BMP (for browser/debug preview). */
  toBMP(): Uint8Array {
    const rowSize = Math.ceil(this.width / 32) * 4; // BMP rows pad to 4 bytes
    const dataSize = rowSize * this.height;
    const offset = 14 + 40 + 8; // header + DIB + 2-color palette
    const out = new Uint8Array(offset + dataSize);
    const dv = new DataView(out.buffer);

    out[0] = 0x42; out[1] = 0x4d; // "BM"
    dv.setUint32(2, offset + dataSize, true);
    dv.setUint32(10, offset, true);
    dv.setUint32(14, 40, true);
    dv.setInt32(18, this.width, true);
    dv.setInt32(22, this.height, true); // positive = bottom-up
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 1, true); // 1 bpp
    dv.setUint32(34, dataSize, true);
    dv.setUint32(46, 2, true); // 2 palette colors
    // palette[0] = white (bit 0), palette[1] = black (bit 1 = ink)
    dv.setUint32(54, 0x00ffffff, true);
    dv.setUint32(58, 0x00000000, true);

    for (let y = 0; y < this.height; y++) {
      const src = y * this.rowBytes;
      const dst = offset + (this.height - 1 - y) * rowSize; // bottom-up
      out.set(this.bits.subarray(src, src + this.rowBytes), dst);
    }
    return out;
  }
}
