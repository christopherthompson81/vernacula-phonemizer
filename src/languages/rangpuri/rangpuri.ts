/**
 * Rangpuri (rkt) phonemizer — canonical IPA. An Eastern Indo-Aryan KRNB lect of Rangpur (Bangladesh) and
 * adjacent India, written here in Devanagari (the Kamtapuri/activist script). It shares Hindi's Devanagari
 * abugida machinery, so it REUSES the generic Hindi engine (makeNativeHindi) with a Rangpuri data file.
 * The KRNB-specific facts live entirely in the manifest:
 *   · DEAFFRICATION: च/छ → [s], ज/झ → [d͡z] (the Assamese-area feature);
 *   · VOICED aspirates RETAINED (घ झ ढ ध भ → ɡʱ d͡zʱ ɖʱ d̪ʱ bʱ); ⚠ VOICELESS aspirates are POSITIONAL —
 *     ख ठ थ फ keep the [ʰ] word-initially (ठीक→ʈʰik) but deaspirate elsewhere (आठ→aʈ), via a postRule;
 *   · inherent vowel [ɔ] (Eastern-Indic), NO phonemic vowel length, ◌ॉ → [æ], व → [w], ण → [n].
 * Inherent-schwa deletion is the same shared algorithm as Hindi.
 */
/**
 * NORMALIZER WORDS: NO SOURCE EXISTS, and Rangpuri is the language most likely to diverge.
 * rkt.wikipedia does not exist and there is no FLEURS corpus or artifact. The
 * one source it has — `tools/referee-eval/referees/rkt.toulmin-rp.tsv`, 372 lines from Toulmin's grammar — is a
 * word→IPA list and contains NONE of the candidate words (its only `डॉ` hit is डॉना, a different word).
 *
 * So the inherited Hindi words stand unconfirmed, and this is the case to treat with most suspicion: Rangpuri
 * is Eastern Indo-Aryan (KRNB), not a Hindi-belt variety, and the engine reads Hindi's clock words through
 * KRNB phonology — `10:30` → *d̪ˈɔs bˈɔd͡zkɔɾ t̪ˈis mˈinɔʈ*, which is Hindi's WORD in Rangpuri's SOUND, the
 * "confidently wrong" shape. Flagged, not guessed at: a KRNB source is what would settle it.
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
