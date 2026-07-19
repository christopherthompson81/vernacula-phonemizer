/**
 * Uyghur / ئۇيغۇرچە (ug) phonemizer — Turkic (Karluk), the Uyghur Arabic alphabet (Ereb Yéziqi), canonical IPA,
 * espeak-independent. ~11M speakers (Xinjiang). The Uyghur Arabic script is a FULL PHONEMIC ALPHABET (it writes
 * all 8 vowels), so — unlike the Arabic/Persian/Urdu abjads — there is NO short-vowel restoration: a plain greedy
 * letter→IPA scan suffices, plus one code rule (word-final obstruent devoicing). Signatures: ا→ɑ (back a), ە→ɛ,
 * the hamza ئ→ʔ (glottal onset), ⟨چ ج⟩→t͡ʃ d͡ʒ, ⟨غ⟩→ʁ, ⟨خ⟩→χ, ⟨ق⟩→q, ⟨ڭ⟩→ŋ. Non-tonal (Turkic).
 * See docs/investigations/ug_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Word-final voiced STOP → voiceless (⟨ب د گ⟩ b/d/g → p/t/k). Uyghur devoices the final stops but NOT the
// fricatives/affricates — final z/ʒ/ʁ/d͡ʒ stay voiced (ئاز→ʔɑz, ئاغ→ʔɑʁ), per the wikipron referee.
const FINAL_DEVOICE: Record<string, string> = { b: "p", d: "t", ɡ: "k" };

/** Phonemize a single Uyghur word to canonical IPA (segmental; final devoicing; non-tonal). */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC");
    const seg: string[] = []; // one IPA segment per grapheme, so the last can be devoiced
    for (const ch of w) {
        const g = G[ch];
        if (g !== undefined) seg.push(g);
    }
    if (seg.length > 0) {
        const last = seg[seg.length - 1]!;
        if (last in FINAL_DEVOICE) seg[seg.length - 1] = FINAL_DEVOICE[last]!;
    }
    return seg.join("");
}

// A word (Uyghur Arabic letters, U+0620–06FF, incl. the hamza-carrier ئ) / number / punctuation token.
const TOKEN = /([ؠ-ۿ]+)|(\d+)|([؟؛،.!?…,])/gu;

class UyghurPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred (digits passed through)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Uyghur phonemizer (greedy letter g2p + final devoicing; numbers deferred). */
export function createUyghur(): Phonemizer {
    return new UyghurPhonemizer();
}
