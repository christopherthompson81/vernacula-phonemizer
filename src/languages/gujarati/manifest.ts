/**
 * Loads the Gujarati data manifest (gujarati.jsonc) once at module init and exposes it typed.
 *
 * ⚠ ONE LOAD, MODULE-LEVEL. gujarati.ts loaded the file LAZILY inside its factory — twice, in two places —
 * which was fine while nothing outside the factory needed it. The symbol tier does, so the load moves here
 * and both call sites read the same object.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { HindiDef } from "../hindi/hindi.ts";

/** The consolidated hand-authored Gujarati data tables (see gujarati.jsonc). */
export const MANIFEST = loadManifest<HindiDef>(import.meta.url, "gujarati.jsonc");
