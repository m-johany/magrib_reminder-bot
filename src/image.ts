import { Resvg, initWasm } from "@resvg/resvg-wasm";

export type WasmSource = () => Promise<BufferSource | WebAssembly.Module>;

let initPromise: Promise<void> | null = null;

/** Renders an SVG string to PNG bytes (1080x1080 for the hadith card). */
export async function renderCardPng(svg: string, wasmSource: WasmSource): Promise<Uint8Array> {
  if (!initPromise) {
    initPromise = initWasm(await wasmSource());
  }
  await initPromise;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1080 },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}
