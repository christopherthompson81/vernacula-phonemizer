/**
 * Native Central Kurdish / Sorani (ckb) text phonemizer — canonical IPA, espeak-independent. Iranian (NW), written
 * in the SORANI Perso-Arabic alphabet. Unlike the Arabic/Persian/Urdu abjads, Sorani writes all the LONG vowels
 * (ا→aː, ێ→eː, ۆ→oː, وو→uː, ی→iː) + the short /a/ (ە); only the short /ɪ/ (bizroke) is unwritten (epenthetic in
 * clusters) → not emitted here, and folded in the eval. A left-to-right greedy scan (وو digraph, then single
 * letters) resolves the و/ی matres lectionis (glide [w]/[j] next to a vowel, else the vowel [u]/[iː]); ئ→ʔ is the
 * word-initial glottal onset; н→ŋ before a velar. Signatures: pharyngeals ħ/ʕ, velarised ڵ→ɫ, trill ڕ→r vs tap
 * ر→ɾ. Complements the Latin-script Kurmanji (kmr). See docs/investigations/ckb_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface CkbDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<CkbDef>(import.meta.url, "central-kurdish.jsonc");
const CONS = DEF.consonants;
const VOW = DEF.vowels;
const CLAUSE_MARK = DEF.clausePunctuation;
// Letters that carry a vowel (so an adjacent و/ی is a glide, not a syllabic vowel).
const VOWEL_LETTERS = new Set([..."اەێۆ"]);

/** Phonemize a single Sorani word to canonical IPA (full written vowels; the unwritten short /ɪ/ is not emitted). */
export function phonemizeWord(word: string): string {
    const w = [...word.replace(/[‌ـ]/gu, "")]; // strip ZWNJ + tatweel
    const toks: string[] = [];
    for (let i = 0; i < w.length; i++) {
        const c = w[i]!;
        const prev = w[i - 1] ?? "";
        const nxt = w[i + 1] ?? "";
        if (c === "و" && nxt === "و") { toks.push("uː"); i++; continue; } // وو → uː
        if (CONS[c] !== undefined) { toks.push(CONS[c]!); continue; }
        if (VOW[c] !== undefined) { toks.push(VOW[c]!); continue; }
        if (c === "ئ") { if (i === 0) toks.push("ʔ"); continue; } // hamza carrier: glottal onset word-initially
        // Matres lectionis: و/ی are glides ([w]/[j]) word-initially or next to a written vowel, else the vowels [u]/[iː].
        const glide = i === 0 || VOWEL_LETTERS.has(prev) || VOWEL_LETTERS.has(nxt);
        if (c === "و") toks.push(glide ? "w" : "u");
        else if (c === "ی") toks.push(glide ? "j" : "iː");
    }
    // н → ŋ before a velar stop.
    for (let k = 0; k < toks.length - 1; k++)
        if (toks[k] === "n" && (toks[k + 1] === "k" || toks[k + 1] === "ɡ")) toks[k] = "ŋ";
    return toks.join("");
}

// A word (Sorani Perso-Arabic letters, U+0600–U+06FF incl. ZWNJ) / number / punctuation token.
const TOKEN = /([ؠ-ۿ‌]+)|(\d+)|([،؛؟.!?…,:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class CentralKurdishPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred (dialect-variable orthography — digits passed through)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Central Kurdish (Sorani) phonemizer. `foreign` handles embedded Latin runs; numbers deferred. */
export function createCentralKurdish(foreign?: ForeignPhonemizer): Phonemizer {
    return new CentralKurdishPhonemizer(foreign);
}
