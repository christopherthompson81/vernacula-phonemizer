/**
 * Loads the Quechua data manifest (quechua.jsonc) once at module init and exposes it typed. Both readers
 * import it from HERE rather than each calling loadManifest: quechua.ts already imports numbers.ts, so
 * having numbers.ts import the manifest back from quechua.ts would close an import cycle, and two
 * loadManifest calls would read and JSONC-parse the same file twice at startup.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { SymbolData } from "../../core/normalizeSymbols.ts";

export interface QuechuaManifest {
    language: string;
    name: string;
    script: readonly string[];
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    /** The SPELLING vowels — see quechua.jsonc; not the IPA vowels, which core/ipa.ts owns. */
    spellingVowels: readonly string[];
    clausePunctuation: Record<string, string>;
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc.
     *  Typed off `SymbolData` itself so the declaration cannot drift from what the engine reads. */
    symbolTier: Required<Pick<SymbolData, "currency" | "units" | "magnitudes" | "exponentWords" | "ampersand">>;
}

/** The consolidated hand-authored Quechua data tables (see quechua.jsonc). */
export const MANIFEST = loadManifest<QuechuaManifest>(import.meta.url, "quechua.jsonc");
