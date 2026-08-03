/**
 * Native Chhattisgarhi / छत्तीसगढ़ी (hne) text phonemizer — canonical IPA, espeak-independent. Eastern Indo-Aryan
 * (Eastern-Hindi group), Devanagari. Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight
 * stress, numbers) with a Chhattisgarhi data file. Chhattisgarhi is distinguished from Hindi mostly GRAMMATICALLY;
 * segmentally its SOLE confident divergence is श/ष→[s] (no /ʃ/, शहर→[səɦəɾ]).
 *
 * ⚠ CANNOT-VERIFY: there is NO independent phonetic referee — wikipron/kaikki have none, epitran has no hne
 * mapping. The build is instead CORROBORATED (not measured) against Hira Lal Kavyopadhyaya's 'A Grammar of the
 * Chhattisgarhi Dialect of Eastern Hindi' (1921, rev. Grierson): its inventory confirmed श/ष→[s] (no /ʃ/) and the
 * attested UDHR sample corrected an initial error — ऐ/औ are MONOPHTHONGS [ɛː]/[ɔː] as Hindi (गौरव→[ɡɔrəʋ]), NOT the
 * Bhojpuri diphthongs. A further documented feature (reduced schwa deletion) is noted but not modelled. The
 * committed anchor is a hand-adjudicated gold of the distinctive features (test/chhattisgarhi.test.ts). See
 * docs/investigations/hne_native_bringup_investigation.md.
 */
/**
 * #583 — NORMALIZER WORDS: NO SOURCE EXISTS, and that is the recorded verdict rather than a gap to revisit.
 * Checked for Chhattisgarhi: hne.wikipedia does not exist, espeak does not ship the language, there is no
 * FLEURS corpus, no mined artifact and no referee. The haystack is empty in every tier
 * (`tools/normalization/sources.ts --lang hne`).
 *
 * So Hindi's inherited words are not merely the default here, they are the only available answer — consistent
 * with this engine being a labelled cannot-verify approximation served via the Hindi engine. Do not replace
 * them with a guess: an unsourced word is confidently wrong, where an inherited one is merely borrowed.
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
