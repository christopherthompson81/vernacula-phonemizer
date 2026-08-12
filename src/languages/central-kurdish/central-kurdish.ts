/**
 * Native Central Kurdish / Sorani (ckb) text phonemizer — canonical IPA. Iranian (NW), written
 * in the SORANI Perso-Arabic alphabet. Unlike the Arabic/Persian/Urdu abjads, Sorani writes all the LONG vowels
 * (ا→aː, ێ→eː, ۆ→oː, وو→uː, ی→iː) + the short /a/ (ە); only the short /ɪ/ (bizroke) is unwritten (epenthetic in
 * clusters) → not emitted here, and folded in the eval. A left-to-right greedy scan (وو digraph, then single
 * letters) resolves the و/ی matres lectionis (glide [w]/[j] next to a vowel, else the vowel [u]/[iː]); ئ→ʔ is the
 * word-initial glottal onset; н→ŋ before a velar. Signatures: pharyngeals ħ/ʕ, velarised ڵ→ɫ, trill ڕ→r vs tap
 * ر→ɾ. Cardinals use the Iranian decimal compositor with the enclitic -u connective (numbers.ts).
 * Complements the Latin-script Kurmanji (kmr).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { renderNumber, spellDigits } from "../../core/numbers.ts";
import { iranianNumberWords, type CkbNumbersDef } from "./numbers.ts";

interface CkbDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    vowelLetters: readonly string[];
    numbers: CkbNumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<CkbDef>(import.meta.url, "central-kurdish.jsonc");
const CONS = DEF.consonants;
const VOW = DEF.vowels;
const CLAUSE_MARK = DEF.clausePunctuation;
// Letters that carry a vowel (so an adjacent و/ی is a glide, not a syllabic vowel).
const VOWEL_LETTERS = new Set(DEF.vowelLetters);

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

/** A run of ASCII digits → the spoken Sorani cardinal in canonical IPA (out-of-range integers pass through). */
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
    // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
    if (!Number.isSafeInteger(n)) return spellDigits(digits, DEF.numbers, phonemizeWord);
    return renderNumber(n, DEF.numbers, phonemizeWord, iranianNumberWords);
}

// A word (Sorani Perso-Arabic letters, U+0600–U+06FF incl. ZWNJ) / number / punctuation token.
import { normalizeCentralKurdish } from "./normalize.ts";

const TOKEN = /([ؠ-ۿ‌]+)|(\d+)|([،؛؟.!?…,:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class CentralKurdishPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // Everything the g2p cannot read is rewritten FIRST — see normalize.ts.
        // ⚠ MOST IMPORTANTLY THE ARABIC-INDIC DIGITS ARE FOLDED TO ASCII THERE. The letter class above is
        // U+0620–U+06FF, which CONTAINS U+0660–U+0669, so without the fold a native digit run is claimed by
        // the LETTER branch and read as an empty string — and those are the majority digit system in Kurdish.
        return assembleClauses(normalizeCentralKurdish(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Central Kurdish (Sorani) phonemizer. `foreign` handles embedded Latin runs; numbers via numbers.ts. */
export function createCentralKurdish(foreign?: ForeignPhonemizer): Phonemizer {
    return new CentralKurdishPhonemizer(foreign);
}
