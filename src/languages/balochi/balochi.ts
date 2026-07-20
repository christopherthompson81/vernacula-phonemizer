/**
 * Native Balochi / بلوچی (bal) text phonemizer — canonical IPA, espeak-independent. Northwestern Iranian; target =
 * SOUTHERN Balochi in the Balochi ARABIC alphabet. Authored from Jahani & Korn (2009). A left-to-right greedy scan
 * (like ckb): consonant lookup + the و/ی matres lectionis (glide [w]/[j] next to a vowel, else the long vowels
 * [uː]/[iː]) + ا→[aː]. The SIGNATURE is the retroflex series ٹ→ʈ, ڈ→ɖ, ڑ→ɽ vs the dental stops ت→t̪, د→d̪ (no
 * native /q/: ق→k; Southern Balochi is unaspirated). The script is DEFECTIVE — short /a i u/ are unwritten and
 * ⟨و⟩/⟨ی⟩ conflate uː/oː and iː/eː — so the output is a consonant + long-vowel-position backbone (و→uː, ی→iː
 * defaulted; short vowels absent). NO machine referee → ⛔. See docs/investigations/bal_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface BalochiDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<BalochiDef>(import.meta.url, "balochi.jsonc");
const CONS = DEF.consonants;
const VOW = DEF.vowels;
const CLAUSE_MARK = DEF.clausePunctuation;
// Letters that carry a vowel (so an adjacent و/ی is a glide, not a syllabic long vowel).
const VOWEL_LETTERS = new Set([..."اآوىیے"]);

/** Phonemize a single Balochi word to canonical IPA (Southern; short vowels unwritten → not emitted). */
export function phonemizeWord(word: string): string {
    const w = [...word.replace(/[‌ـ]/gu, "")]; // strip ZWNJ + tatweel
    const toks: string[] = [];
    for (let i = 0; i < w.length; i++) {
        const c = w[i]!;
        const prev = w[i - 1] ?? "";
        const nxt = w[i + 1] ?? "";
        if (CONS[c] !== undefined) { toks.push(CONS[c]!); continue; }
        if (VOW[c] !== undefined) { toks.push(VOW[c]!); continue; }
        if (c === "ع" || c === "ئ" || c === "ء") continue; // ʿayn / hamza — dropped word-initially (Persian-style), postvocalic loss
        if (c === "ں") { toks.push("̃"); continue; } // noon ghunna → nasalisation of the preceding vowel
        // Matres lectionis: و/ی are glides ([w]/[j]) word-initially or next to a written vowel, else the long
        // vowels [uː]/[iː]. The o/u and e/i quality is NOT recoverable from the script → default to the high vowel.
        const glide = i === 0 || VOWEL_LETTERS.has(prev) || VOWEL_LETTERS.has(nxt);
        if (c === "و") toks.push(glide ? "w" : "uː");
        else if (c === "ی" || c === "ى") toks.push(glide ? "j" : "iː");
    }
    return toks.join("");
}

// A word (Balochi Arabic letters, U+0600–U+06FF incl. ZWNJ) / number / punctuation token.
const TOKEN = /([ؠ-ۿ‌]+)|(\d+)|([،؛؟.!?…,:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class BalochiPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
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

/** Build the Balochi (Southern) phonemizer. `foreign` handles embedded Latin runs; numbers deferred. */
export function createBalochi(foreign?: ForeignPhonemizer): Phonemizer {
    return new BalochiPhonemizer(foreign);
}
