/**
 * Loads the Bengali data manifest (bengali.jsonc) once at module init and exposes it typed.
 *
 * ⚠ ONE LOAD, MODULE-LEVEL. bengali.ts loaded the file LAZILY inside its factory — twice, in two places —
 * which was fine while nothing outside the factory needed it. The symbol tier does, so the load moves here
 * and both call sites read the same object.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { BengaliDef } from "./bengali.ts";

/** The consolidated hand-authored Bengali data tables (see bengali.jsonc). */
export const MANIFEST = loadManifest<BengaliDef>(import.meta.url, "bengali.jsonc");
