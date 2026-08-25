/**
 * The consolidated hand-authored Kalaallisut data tables (kalaallisut.jsonc).
 *
 * ⚠ A SEPARATE MODULE, not a `loadManifest` call inside the engine file: numbers.ts needs the numeral
 * lexicon and importing the engine to reach it would drag the whole phonemizer in. The type import here is
 * erased, so no cycle survives compilation.
 */
import type { KalaallisutDef } from "./kalaallisut.ts";
import { loadManifest } from "../../core/loadManifest.ts";

export const MANIFEST = loadManifest<KalaallisutDef>(import.meta.url, "kalaallisut.jsonc");
