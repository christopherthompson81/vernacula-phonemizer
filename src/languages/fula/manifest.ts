/**
 * Loads the Fula data manifest (fula.jsonc) once at module init and exposes it typed. The hand-authored DATA
 * (the longest-match orthography→IPA rule table and the clause punctuation) lives in the JSONC; the ALGORITHM
 * (the longest-match scan + penultimate stress) stays in g2p.ts / fula.ts.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";

export interface FulaManifest {
    rules: [string, string, boolean][];
    clausePunctuation: Record<string, string>;
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored Fula data tables (see fula.jsonc). */
export const MANIFEST = parseJsonc<FulaManifest>(
    readFileSync(join(dir, "fula.jsonc"), "utf8"),
);
