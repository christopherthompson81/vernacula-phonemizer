/**
 * Classical Nahuatl / nāhuatlahtōlli (nci) phonemizer — Uto-Aztecan, the language of the Aztec Empire (16th-c.
 * Central Mexico), the traditional Spanish-based Latin orthography, canonical IPA. The
 * fleet's FIRST UTO-AZTECAN language. The g2p is AUTHORED FROM Andrews, *Introduction to Classical Nahuatl* (§2).
 *   ★ 8 VOWELS /a e i o/ × length (macron ā ē ī ō → [Vː]); LENGTH is UNWRITTEN in traditional texts → we emit
 *     SHORT vowels (the referee's ː is backbone-stripped). No diphthongs. ⟨u⟩ is NEVER a vowel natively (only
 *     part of cu/uc/hu/uh); a bare ⟨u⟩ is a loan vowel.
 *   ★★ THE SPANISH-ORTHOGRAPHY CONTEXT RULES (§2.4): ⟨c⟩→[s] before e/i, else [k]; ⟨qu⟩→[k]; ⟨z⟩→[s]; ⟨cu⟩+V /
 *     V⟨uc⟩→[kʷ]; ⟨hu⟩+V / V⟨uh⟩→[w]; saltillo ⟨h⟩→[ʔ]; ⟨x⟩→ʃ, ⟨tz⟩→t͡s, ⟨tl⟩→t͡ɬ, ⟨ch⟩→t͡ʃ. ★ THE ⟨chu⟩ TRAP:
 *     ⟨ch⟩ before ⟨u⟩+V is [k]-coda + ⟨hu⟩[w] (cachuah=/kakwa/), NOT the affricate.
 * Stress is regular penultimate (unmarked in the broad referee → not emitted). Syllable-final /l/→[ɬ], /n/→[ŋ]
 * before /k/, and coda /w/→[w̥ ɸ] are allophonic (disclosed/folded).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";

const VOWEL: Record<string, string> = {
    a: "a", e: "e", i: "i", o: "o", u: "u",
    ā: "aː", ē: "eː", ī: "iː", ō: "oː", ū: "uː",
    á: "a", é: "e", í: "i", ó: "o", ú: "u", // acute (some texts) → the plain vowel
};
const isVowel = (c: string | undefined): boolean => c !== undefined && VOWEL[c] !== undefined;
const isFront = (c: string | undefined): boolean => c === "e" || c === "i" || c === "ē" || c === "ī" || c === "é" || c === "í";
// Non-contextual single consonants (⟨c z x h q u⟩ are handled positionally; loan letters map to the nearest sound).
const CONS: Record<string, string> = {
    p: "p", t: "t", m: "m", n: "n", l: "l", y: "j", w: "w",
    s: "s", r: "ɾ", f: "f", b: "b", d: "d", g: "ɡ", v: "v", j: "x", k: "k", q: "k",
};

/** One Classical Nahuatl word → canonical IPA (Andrews §2 orthography rules; morphophonology deferred). */
export function phonemizeWord(word: string): string {
    const t = word.normalize("NFC").toLowerCase();
    let out = "";
    let i = 0;
    while (i < t.length) {
        const c = t[i]!, c1 = t[i + 1], c2 = t[i + 2], c3 = t[i + 3];
        // ⟨cu⟩ + vowel → [kʷ]; ⟨hu⟩ + vowel → [w] (§2.4, syllable-initial labialised/glide).
        if (c === "c" && c1 === "u" && isVowel(c2)) { out += "kʷ"; i += 2; continue; }
        if (c === "h" && c1 === "u" && isVowel(c2)) { out += "w"; i += 2; continue; }
        // THE ⟨chu⟩ TRAP: ⟨ch⟩ + ⟨u⟩ + vowel = [k]-coda + [w] (cachuah=/kakwa/) — emit [k], let ⟨hu⟩ follow.
        if (c === "c" && c1 === "h" && c2 === "u" && isVowel(c3)) { out += "k"; i += 1; continue; }
        // Coda labialised velar / glide: V⟨uc⟩ / V⟨uh⟩ syllable-final (before a consonant or word-end) (§2.4).
        if (c === "u" && c1 === "c" && !isVowel(c2)) { out += "kʷ"; i += 2; continue; }
        if (c === "u" && c1 === "h" && !isVowel(c2)) { out += "w"; i += 2; continue; }
        // Affricate / velar digraphs.
        if (c === "c" && c1 === "h") { out += "t͡ʃ"; i += 2; continue; }
        if (c === "t" && c1 === "z") { out += "t͡s"; i += 2; continue; }
        if (c === "t" && c1 === "l") { out += "t͡ɬ"; i += 2; continue; }
        // ⟨qu⟩ → [k] (standardized orthography: only before e/i). Before a/o it appears only in COLONIAL
        // spellings (⟨qua quo⟩ for standardized ⟨cua cuo⟩ = /kʷ/, Andrews Appendix F) → [kʷ].
        if (c === "q" && c1 === "u") { out += (c2 === "a" || c2 === "o" || c2 === "ā" || c2 === "ō" || c2 === "á" || c2 === "ó") ? "kʷ" : "k"; i += 2; continue; }
        // Context-dependent singles.
        if (c === "c") { out += isFront(c1) ? "s" : "k"; i += 1; continue; } // ⟨c⟩ → [s]/e,i ; [k] else
        if (c === "z" || c === "ç") { out += "s"; i += 1; continue; }
        if (c === "x") { out += "ʃ"; i += 1; continue; }
        // saltillo ⟨h⟩ → [ʔ], but ONLY after a vowel (§2.3.3: /ʔ/ occurs only after a short vowel, never
        // word-initially); a word-initial / post-consonant ⟨h⟩ (loans, e.g. "he") is silent.
        if (c === "h") { out += isVowel(t[i - 1]) ? "ʔ" : ""; i += 1; continue; }
        // Vowels + plain consonants + loan letters.
        out += VOWEL[c] ?? CONS[c] ?? "";
        i += 1;
    }
    return out.normalize("NFC");
}

// Nahuatl letters (traditional orthography + macron/acute + ç) / number / punctuation.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls.
 */
const NATIVE_CLASS = "[a-zāēīōūáéíóúç]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class NahuatlPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Classical Nahuatl phonemizer (Andrews §2 orthography rules; morphophonology deferred). */
export function createNahuatl(): Phonemizer {
    return new NahuatlPhonemizer();
}
