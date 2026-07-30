/**
 * Bashkir (ba) phonemizer — Башҡорт теле, Kipchak Turkic (sibling of Tatar), CYRILLIC (the Bashkir alphabet),
 * canonical IPA, espeak-independent. The fleet's first Bashkir. A Cyrillic grapheme scan. Bashkir's HALLMARK is the
 * INTERDENTAL fricatives ⟨ҫ⟩→[θ] and ⟨ҙ⟩→[ð] (shared with Turkmen). Unlike Tatar, Bashkir WRITES the uvulars ⟨ҡ⟩→[q]
 * / ⟨ғ⟩→[ʁ] (so ⟨к⟩→[k], ⟨г⟩→[ɡ] always — no harmony inference). The BASHKIR VOWEL SHIFT: ⟨и⟩→[i], ⟨о⟩→[ʊ],
 * ⟨у⟩→[u], ⟨е⟩→[ɪ] (bare; [je] word-initial), ⟨ы⟩→[ɯ], ⟨ө⟩→[ø], ⟨ү⟩→[y], ⟨ә⟩→[æ]. Word-final (oxytone) stress
 * (Turkic). 🔷 single-source-family (kaikki, referee-noisy with Russian loans). See docs/investigations/ba_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord as russianWord } from "../russian/russian.ts";
import { numberToWords } from "./numbers.ts";

// Context-free consonants. ⟨ҡ⟩/⟨ғ⟩ are the written uvulars; ⟨ҫ⟩/⟨ҙ⟩ the interdentals; ⟨р⟩→[ɾ] tap; ⟨л⟩ dark/clear below.
const CONS: Record<string, string> = {
    "б": "b", "в": "w", "г": "ɡ", "ғ": "ʁ", "д": "d", "ж": "ʒ", "з": "z", "й": "j", "к": "k", "ҡ": "q",
    "м": "m", "н": "n", "ң": "ŋ", "п": "p", "р": "ɾ", "с": "s", "ҫ": "θ", "т": "t", "ф": "f",
    "х": "χ", "һ": "h", "ц": "t͡s", "ч": "t͡ʃ", "ш": "ʃ", "щ": "ɕː", "ҙ": "ð",
};
// Vowels (the Bashkir shift). ⟨у ү⟩ are vowels in onset but the glide [w] after a vowel (diphthong ау→ɑw); ⟨е⟩ is
// [ɪ] except word-initial/post-vowel → [jɪ].
const VOWEL: Record<string, string> = {
    "а": "ɑ", "ә": "æ", "о": "ʊ", "ө": "ø", "у": "u", "ү": "y", "ы": "ɯ", "и": "i", "э": "ɪ",
};
// Iotated vowels → glide + vowel.
const IOTATED: Record<string, string> = { "я": "jɑ", "ю": "ju", "ё": "jo" };
const CYR_VOWEL = new Set([..."аәоөуүыиэеяюё"]);
const BACK = new Set([..."аоуы"]); // back-harmony vowels — govern the dark ⟨л⟩→[ɫ]
const IPA_VOWEL = new Set([..."ɑæʊøɯɪyiuo"]); // every vowel the scan emits (а→ɑ ә→æ о→ʊ ө→ø ы→ɯ э/е→ɪ ү→y и→i у/ю→u ё→o)

// ★ RUSSIAN-LOAN DETECTION. Real Bashkir text is saturated with Russian loanwords, and Bashkir speakers pronounce them
// RUSSIAN-STYLE (palatalization, akanye, Russian stress) — so a realistic phonemizer routes them to the Russian g2p.
// The signal is VOWEL HARMONY: native Bashkir is strictly all-back or all-front, so a word MIXING a back vowel (а о у ы)
// with a front one (е и э) — and lacking any Bashkir-specific letter (which are always harmonic) — is a Russian loan.
const BASHKIR_LETTER = new Set([..."ҡғҙҫңәөүһ"]);
const BACK_V = new Set([..."аоуы"]);
const FRONT_V = new Set([..."еэ"]); // ⟨и⟩ is harmonically NEUTRAL (frequent in back-vowel Arabic/Persian loans) → NOT a loan signal; ⟨ә ө ү⟩ are front but also Bashkir letters (caught by the guard)
export function isRussianLoan(word: string): boolean {
    const w = word.normalize("NFC").toLowerCase();
    if ([...w].some((c) => BASHKIR_LETTER.has(c))) return false; // a native Bashkir letter → native word
    return [...w].some((c) => BACK_V.has(c)) && [...w].some((c) => FRONT_V.has(c)); // harmony violation → loan
}

/** Phonemize one Bashkir word → canonical IPA. A detected RUSSIAN LOAN is routed to the Russian g2p (Bashkir speakers
 *  read loans Russian-style); otherwise the native Bashkir scan (`phonemizeWordNative`) runs. */
export function phonemizeWord(word: string): string {
    return isRussianLoan(word) ? russianWord(word) : phonemizeWordNative(word);
}

/** The NATIVE Bashkir g2p (Cyrillic grapheme scan + word-final stress), WITHOUT Russian-loan routing. */
export function phonemizeWordNative(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const chars = [...w];
    const backWord = [...w].some((c) => BACK.has(c)); // ⟨л⟩ is dark [ɫ] in a back-harmony word, clear [l] in a front one
    const segs: string[] = [];
    chars.forEach((ch, i) => {
        const prevVowel = i > 0 && CYR_VOWEL.has(chars[i - 1]!);
        if (ch === "л") segs.push(backWord ? "ɫ" : "l");
        else if (ch === "у") segs.push(prevVowel ? "w" : "u"); // ⟨у⟩: vowel [u] in onset, glide [w] after a vowel (ау→ɑw)
        else if (ch === "ү") segs.push(prevVowel ? "w" : "y"); // ⟨ү⟩: [y] in onset, glide [w] after a vowel (әү→æw)
        else if (ch === "е") segs.push(i === 0 || prevVowel ? "jɪ" : "ɪ"); // ⟨е⟩: [jɪ] initial/post-vowel, else [ɪ]
        else if (CONS[ch] !== undefined) segs.push(CONS[ch]!);
        else if (IOTATED[ch] !== undefined) segs.push(IOTATED[ch]!);
        else if (VOWEL[ch] !== undefined) segs.push(VOWEL[ch]!);
        // ъ ь and other marks: dropped
    });
    // Word-final (oxytone) stress — the Turkic default: ˈ before the last vowel's onset consonant.
    const isV = (s: string): boolean => [...s].some((c) => IPA_VOWEL.has(c));
    const vidx = segs.map((s, idx) => (isV(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        const nucleus = vidx[vidx.length - 1]!;
        const at = nucleus > 0 && !isV(segs[nucleus - 1]!) ? nucleus - 1 : nucleus;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

/** A digit run → spoken Bashkir, phonemized through the same g2p (data + provenance in numbers.ts). The number words
 *  go through the public `phonemizeWord`, so миллион/миллиард get the same loan treatment they would in running text. */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return numberToWords(n).map(phonemizeWord).join(" ");
}

// A Bashkir Cyrillic word / number / punctuation.
const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])/gu;

class BashkirPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Bashkir phonemizer (Cyrillic scan + interdentals + Bashkir vowel shift + final stress). */
export function createBashkir(): Phonemizer {
    return new BashkirPhonemizer();
}
