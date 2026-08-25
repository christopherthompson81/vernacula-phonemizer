/**
 * The consolidated hand-authored Swahili data tables (swahili.jsonc).
 *
 * ⚠ A SEPARATE MODULE, not a `loadManifest` call inside the engine file. The engine declares the shape
 * (`SwahiliDef`) and the tests need the values; importing the engine to read a table drags the whole
 * phonemizer in. The type import here is erased, so no cycle survives compilation.
 */
import type { SwahiliDef } from "./swahili.ts";
import { loadManifest } from "../../core/loadManifest.ts";

export const MANIFEST = loadManifest<SwahiliDef>(import.meta.url, "swahili.jsonc");
