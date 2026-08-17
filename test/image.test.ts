import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildCardSvg } from "../src/card";
import { renderCardPng } from "../src/image";
import type { HadithText } from "../src/messages";

const hadith: HadithText = {
  textEn: "Whoever recites Surah al-Kahf on Friday, a light will shine for him between the two Fridays.",
  textAr: "مَنْ قَرَأَ سُورَةَ الْكَهْفِ يَوْمَ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الْجُمُعَتَيْنِ",
  sourceEn: "Al-Mustadrak 2/399; graded sahih by al-Albani, Sahih al-Jami' 6470",
  sourceAr: "المستدرك ٢/٣٩٩، وصححه الألباني في صحيح الجامع ٦٤٧٠",
};

const wasmPath = join(
  process.cwd(),
  "node_modules",
  "@resvg",
  "resvg-wasm",
  "index_bg.wasm"
);

/** Minimal PNG decoder: returns raw RGBA rows. Guards against blank renders. */
function decodePngRgba(png: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  for (let off = 8; off < png.length; ) {
    const len = new DataView(png.buffer, png.byteOffset + off).getUint32(0);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    if (type === "IHDR") {
      width = new DataView(png.buffer, png.byteOffset + off + 8).getUint32(0);
      height = new DataView(png.buffer, png.byteOffset + off + 8).getUint32(4);
    } else if (type === "IDAT") {
      idat.push(png.subarray(off + 8, off + 8 + len));
    }
    off += 12 + len;
  }
  const stride = width * 4;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]!;
    const cur = raw.subarray(p, p + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? cur[x - 4]! : 0;
      const b = prev[x]!;
      const c = x >= 4 ? prev[x - 4]! : 0;
      let v = cur[x]!;
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const pa = Math.abs(b - a);
        const pb = Math.abs(c - a);
        const pc = Math.abs(c - b);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pr) & 0xff;
      }
      pixels[y * stride + x] = v;
    }
    prev.set(cur);
    p += stride;
  }
  return { width, height, pixels };
}

describe("renderCardPng", () => {
  it("renders the card SVG to a valid PNG", async () => {
    const png = await renderCardPng(buildCardSvg(hadith, "en"), () =>
      readFile(wasmPath)
    );

    // PNG magic bytes
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
    expect(png.length).toBeGreaterThan(10_000);

    // The card must actually contain text: cream-colored pixels (matn
    // #F7F1E3). A blank frame only has the green gradient, gold pattern and
    // borders - nothing brighter than gold (#D4B36A, r=212).
    const { width, height, pixels } = decodePngRgba(png);
    expect(width).toBe(1080);
    expect(height).toBe(1080);
    let cream = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if ((pixels[i] ?? 0) > 235 && (pixels[i + 1] ?? 0) > 220) cream++;
    }
    expect(cream).toBeGreaterThan(5_000);
  });
});
