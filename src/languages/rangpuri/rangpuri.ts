/**
 * Native Rangpuri (rkt) text phonemizer — canonical IPA, espeak-independent. Rangpuri is the Eastern-Indo-Aryan KRNB
 * lect of Rangpur (Bangladesh) + adjacent India, written here in Devanagari (the Kamtapuri/activist script). It shares
 * Hindi's Devanagari abugida machinery, so it REUSES the generic Hindi engine (makeNativeHindi) with a Rangpuri data
 * file (rangpuri.jsonc). The KRNB-specific facts live entirely in the manifest:
 *   - DEAFFRICATION: च/छ → [s], ज/झ → [d͡z] (the Assamese-area feature);
 *   - VOICED aspirates RETAINED (घ झ ढ ध भ → ɡʱ d͡zʱ ɖʱ d̪ʱ bʱ); VOICELESS aspirates positional — ख ठ थ फ keep [ʰ]
 *     word-initially (ठीक→ʈʰik) but deaspirate elsewhere (आठ→aʈ), via a postRule;
 *   - inherent vowel [ɔ] (Eastern-Indic), NO phonemic vowel length, ◌ॉ → [æ], व → [w], ण → [n].
 * Inherent-schwa deletion is the same shared algorithm as Hindi. Validated against the Toulmin (2006) Appendix-A
 * Rangpur referee (tools/krnb/referees/RP.tsv). See docs/investigations/rkt_krnb_bringup_investigation.md.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

let RKT: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(loadManifest<HindiDef>(import.meta.url, "rangpuri.jsonc"), loadSharedPhonology(), foreign);
}

/** Build the Rangpuri phonemizer. `foreign` handles embedded Latin runs. */
export function createRangpuri(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return engine(foreign);
}

/** Bare word→IPA (tests / referee eval) — the pure rule engine (no lexicon). */
export function phonemizeWord(w: string): string {
    return (RKT ??= engine()).wordRules(w);
}
