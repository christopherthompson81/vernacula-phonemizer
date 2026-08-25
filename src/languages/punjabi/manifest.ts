/**
 * Loads the Punjabi data manifest (punjabi.jsonc) once at module init and exposes it typed.
 *
 * ⚠ ONE LOAD, MODULE-LEVEL. punjabi.ts loaded the file LAZILY inside its factory — twice, in two places —
 * which was fine while nothing outside the factory needed it. The symbol tier does, so the load moves here
 * and both call sites read the same object.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { PunjabiDef } from "./punjabi.ts";

/** The consolidated hand-authored Punjabi data tables (see punjabi.jsonc). */
export const MANIFEST = loadManifest<PunjabiDef>(import.meta.url, "punjabi.jsonc");
