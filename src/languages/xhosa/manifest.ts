/**
 * Loads the Xhosa data manifest (xhosa.jsonc) once at module init and exposes it typed. Xhosa reuses the Zulu
 * manifest SHAPE (ZuluManifest) — the same longest-match rule table, tone-code→Chao map, clause punctuation, and
 * Nguni number words — differing only in the DATA (⟨rh⟩→x, Xhosa number words). The shared Nguni scan
 * (zulu/g2p.ts toSegments) reads this table.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { ZuluManifest } from "../zulu/manifest.ts";

/** Zulu's shape without `ordinalYe`: xhosa.jsonc carries no `ye-` ordinal series and nothing in xh reads one
 *  (#1593). The Rust and C# manifests already treat the field as optional. */
export type XhosaManifest = Omit<ZuluManifest, "ordinalYe">;

/** The consolidated hand-authored Xhosa data tables (see xhosa.jsonc). */
export const MANIFEST = loadManifest<XhosaManifest>(import.meta.url, "xhosa.jsonc");
