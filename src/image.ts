import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { NOTO_NASKH_ARABIC_B64 } from "./font";

export type WasmSource = () => Promise<BufferSource | WebAssembly.Module>;

let initPromise: Promise<void> | null = null;

/**
 * resvg-wasm does not honor SVG `@font-face` data URIs; fonts must be passed
 * via `font.fontBuffers`, otherwise text silently renders as nothing.
 */
const NOTO_NASKH_ARABIC = Uint8Array.from(atob(NOTO_NASKH_ARABIC_B64), (c) => c.charCodeAt(0));

/** Renders an SVG string to PNG bytes (1080x1080 for the hadith card). */
export async function renderCardPng(svg: string, wasmSource: WasmSource): Promise<Uint8Array> {
  if (!initPromise) {
    initPromise = initWasm(await wasmSource());
  }
  await initPromise;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1080 },
    font: { fontBuffers: [NOTO_NASKH_ARABIC] },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}
