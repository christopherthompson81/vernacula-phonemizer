/**
 * Loads the Hindi data manifest (hindi.jsonc) once at module init and exposes it typed.
 *
 * ⚠ ONE LOAD, MODULE-LEVEL. `createHindi()` loaded the file per call; the symbol tier is built once at module
 * scope and needs it too, so the load lands here and both read the same object.
 *
 * ⚠ `HindiDef` IS SHARED with Marathi and Gujarati, which have their own jsonc files. This module is Hindi's
 * own data only — the other two load theirs through their own manifest modules.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { HindiDef } from "./hindi.ts";

/** The consolidated hand-authored Hindi data tables (see hindi.jsonc). */
export const MANIFEST = loadManifest<HindiDef>(import.meta.url, "hindi.jsonc");
