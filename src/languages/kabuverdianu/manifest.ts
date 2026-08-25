/**
 * The consolidated hand-authored kabuverdianu data tables (kabuverdianu.jsonc).
 *
 * ⚠ A SEPARATE MODULE, not a `loadManifest` call inside the engine file: normalize.ts needs the tables and
 * importing the engine to reach them would drag the whole phonemizer in. The type import here is erased,
 * so no cycle survives compilation.
 */
import type { KabuverdianuDef } from "./kabuverdianu.ts";
import { loadManifest } from "../../core/loadManifest.ts";

export const MANIFEST = loadManifest<KabuverdianuDef>(import.meta.url, "kabuverdianu.jsonc");
