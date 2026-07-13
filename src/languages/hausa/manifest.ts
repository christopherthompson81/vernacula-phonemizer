/**
 * Loads the Hausa data manifest (hausa.jsonc) once at module init and exposes it typed. The hand-authored DATA
 * (the longest-match orthography→IPA rule table, the tone-code→Chao map, clause punctuation, and the number
 * words) lives in the JSONC; the ALGORITHM (longest-match scan + penultimate stress + tone overlay) stays in
 * g2p.ts / hausa.ts / numbers.ts, and the per-word tone lexicon is a separate file (tone.tsv).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";

export interface HausaManifest {
    rules: [string, string, boolean][];
    toneChao: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        teensConnector: string;
        connector: string;
        hundred: string;
        thousand: string;
    };
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored Hausa data tables (see hausa.jsonc). */
export const MANIFEST = parseJsonc<HausaManifest>(
    readFileSync(join(dir, "hausa.jsonc"), "utf8"),
);
