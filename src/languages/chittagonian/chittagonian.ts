/**
 * Native Chittagonian (ctg) text phonemizer — canonical IPA, espeak-independent. Eastern Indo-Aryan,
 * Bengali-Assamese script. ⛔ CANNOT-VERIFY (no independent referee). Reuses the Bengali engine
 * (makeNativeBengali — the shared Eastern-Indic abugida scan + inherent-vowel deletion + geminate→length) with a
 * Chittagonian manifest whose phoneme values carry the DOCUMENTED divergences from Bengali: the SPIRANTISATION
 * signature খ→[x] / ঘ→[ɣ] / ফ→[f], deaffrication চ/ছ→[s] জ/ঝ/য→[z], and the [s]/[ʃ] contrast স→[s]. The
 * undocumented parts (dental/retroflex aspirates, vowels) are kept Bengali-conservative. See
 * docs/investigations/ctg_native_bringup_investigation.md.
 */
import {
    makeNativeBengali,
    type BengaliDef,
    type ForeignPhonemizer,
} from "../bengali/bengali.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

/** Load chittagonian.jsonc (beside this file) and build the Chittagonian phonemizer. `foreign` handles embedded Latin. */
export function createChittagonian(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return makeNativeBengali(
        loadManifest<BengaliDef>(import.meta.url, "chittagonian.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

let CTG: ReturnType<typeof makeNativeBengali> | undefined;
/** Bare word→IPA (for the hand-adjudicated distinctive-feature gold). */
export function phonemizeWord(word: string): string {
    return (CTG ??= makeNativeBengali(
        loadManifest<BengaliDef>(import.meta.url, "chittagonian.jsonc"),
        loadSharedPhonology(),
    )).word(word);
}
