/**
 * Native Maithili / मैथिली (mai) text phonemizer — canonical IPA, espeak-independent. Eastern Indo-Aryan (Bihari
 * group), Devanagari. Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress,
 * numbers) with a Maithili data file whose divergences from Hindi are: SHORT e/o (ए→e, ओ→o), the diphthongs
 * ऐ→[əɪ] / औ→[əu], and inherent /ə/. Maithili's signature — a cluster schwa that Hindi DELETES instead reduces to
 * an ULTRASHORT [ᵊ] (इसपात→ɪsᵊpaːt) — is a narrow phonetic detail folded (ᵊ~∅) against the referee.
 *
 * 🔷 SINGLE-SOURCE: the only referee is wikipron mai_deva narrow (167 human pairs) — small, so this is a
 * single-source-verified bring-up, not a confident convergence. Distinct from the ⛔ Bhojpuri/Awadhi stubs, which
 * have NO referee at all. See docs/mai_native_bringup_investigation.md.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

let MAI: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "maithili.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** Build the Maithili phonemizer. `foreign` handles embedded Latin runs. */
export function createMaithili(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return engine(foreign);
}

/** Bare word→IPA (tests / eval). */
export function phonemizeWord(w: string): string {
    return (MAI ??= engine()).word(w);
}
