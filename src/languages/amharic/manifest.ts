/**
 * The consolidated hand-authored Amharic data tables (amharic.jsonc).
 *
 * ⚠ A SEPARATE MODULE, not a `loadManifest` call inside the engine file. The engine declares the shape
 * (`AmharicDef`) and the tests need the values; importing the engine to read a table drags the whole
 * phonemizer in. The type import here is erased, so no cycle survives compilation.
 */
import type { AmharicDef } from "./amharic.ts";
import { loadManifest } from "../../core/loadManifest.ts";

export const MANIFEST = loadManifest<AmharicDef>(import.meta.url, "amharic.jsonc");
