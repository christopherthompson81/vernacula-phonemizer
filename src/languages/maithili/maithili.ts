/**
 * Native Maithili / मैथिली (mai) text phonemizer — canonical IPA. Eastern Indo-Aryan (Bihari
 * group), Devanagari. Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress,
 * numbers) with a Maithili data file whose divergences from Hindi are: SHORT e/o (ए→e, ओ→o), the diphthongs
 * ऐ→[əɪ] / औ→[əu], and inherent /ə/. Maithili's signature — a cluster schwa that Hindi DELETES instead reduces to
 * an ULTRASHORT [ᵊ] (इसपात→ɪsᵊpaːt) — is a narrow phonetic detail folded (ᵊ~∅) against the referee.
 *
 * 🔷 SINGLE-SOURCE: the only referee is wikipron mai_deva narrow (167 human pairs) — small, so this is a
 * single-source-verified bring-up, not a confident convergence. Distinct from the ⛔ Bhojpuri/Awadhi stubs, which
 * have NO referee at all.
 */
/**
 * #583 — NORMALIZER WORDS: Hindi's CLOCK words are confirmed for Maithili; its percent word is NOT, and is
 * retained unconfirmed. Evidence from mai.wikipedia via `tools/normalization/attest.ts`
 * (`tools/corpus/attest/mai.jsonc`). This language is why the reading has to be done per sentence:
 *
 *   बजकर + मिनट ✓ "प्राण प्रतिष्ठाक मुहूर्त १२ बजकर २९ मिनट ८ सेकेण्ड सँ … रहल जे"
 *                  — प्रतिष्ठाक / सेकेण्ड सँ / रहल जे are Maithili. TWO of the four बजकर hits are Maithili;
 *                    the other two are the same passage in HINDI (का मुहूर्त, रहा, मिलाकर), quoted verbatim.
 *   मिनट     ✓ "5 घंटा 30 मिनट जोड़ला सं प्राप्त होइत अछि"           — होइत अछि is Maithili
 *   प्रतिशत   ✗ its single hit is a NEPALI passage ("९७.९ प्रतिशत भन्दा अधिक … लागेकाछन्"), so it says
 *              nothing about Maithili. Hindi's default stands, unconfirmed — not replaced, because an
 *              unsourced substitute is worse than an inherited word (this issue's own standing rule).
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
