/**
 * The consolidated hand-authored westarmenian data tables (westarmenian.jsonc).
 *
 * ⚠ THE Def IS SHARED with `armenian` — this language has its own jsonc but not its own shape.
 *
 * ⚠ A SEPARATE MODULE, not a `loadManifest` call inside the engine file: normalize.ts needs the tables and
 * importing the engine to reach them would drag the whole phonemizer in. The type import here is erased,
 * so no cycle survives compilation.
 */
import type { ArmenianDef } from "../armenian/armenian.ts";
import { loadManifest } from "../../core/loadManifest.ts";

export const MANIFEST = loadManifest<ArmenianDef>(import.meta.url, "westarmenian.jsonc");
