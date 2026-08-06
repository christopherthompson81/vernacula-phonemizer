/**
 * Loads the Igbo data manifest (igbo.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA — the orthography→IPA tables, tone marks, clause punctuation and the cardinal numbers; the
 * ALGORITHM stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface IgboManifest {
    language: string;
    name: string;
    script: string;
    clausePunctuation: Record<string, string>;
    /** Cardinal numbers — the MODERN DECIMAL system. See igbo.jsonc for sourcing and why not the vigesimal one. */
    numbers: {
        zero: string;
        /** The irregular multiplier-1 form: `otu narị` (100), not `narị otu`. */
        one: string;
        /** Multipliers 2..9, used AFTER a magnitude word (`iri abụọ` = 20). Slots 0 and 1 are unused. */
        units: string[];
        ten: string;
        hundred: string;
        thousand: string;
        million: string;
        billion: string;
        and: string;
    };
}

/** The consolidated hand-authored Igbo data tables (see igbo.jsonc). */
export const MANIFEST = loadManifest<IgboManifest>(import.meta.url, "igbo.jsonc");
