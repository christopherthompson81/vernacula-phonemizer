/**
 * Native Chhattisgarhi / छत्तीसगढ़ी (hne) text phonemizer — canonical IPA, espeak-independent. Eastern Indo-Aryan
 * (Eastern-Hindi group), Devanagari. Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight
 * stress, numbers) with a Chhattisgarhi data file. Chhattisgarhi is distinguished from Hindi mostly GRAMMATICALLY;
 * segmentally it is near-identical to Awadhi/Bhojpuri, so the DOCUMENTED divergences implemented are the shared
 * Eastern-Hindi ones: श/ष→[s] (no /ʃ/, शहर→sahar), ऐ/औ kept as the diphthongs [ai]/[au], no Hindi əɦə-lowering.
 *
 * ⚠ CANNOT-VERIFY: there is NO independent referee for Chhattisgarhi — wikipron/kaikki have none, and epitran has
 * no hne mapping at all. Since Chhattisgarhi's segmental phonology is ~Hindi, an engine and any Hindi-clone
 * referee would agree trivially. The committed anchor is a small hand-adjudicated gold of the DISTINCTIVE features
 * (test/chhattisgarhi.test.ts), grading exactly where Chhattisgarhi ≠ Hindi. See
 * docs/investigations/hne_native_bringup_investigation.md.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

let HNE: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "chhattisgarhi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** Build the Chhattisgarhi phonemizer. `foreign` handles embedded Latin runs. */
export function createChhattisgarhi(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return engine(foreign);
}

/** Bare word→IPA (tests). */
export function phonemizeWord(w: string): string {
    return (HNE ??= engine()).word(w);
}
