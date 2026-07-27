/**
 * Aksara Sunda (ᮃᮊ᮪ᮞᮛ, U+1B80–1BBF) → Sundanese Latin transliteration — the second-script front-end for Sundanese
 * (su), the Tashelhit/Fula pattern applied to a Brahmic ABUGIDA (cf. the Javanese aksara front-end). Aksara Sunda
 * is the revived traditional script (Sunda Baku, 1990s; official in West Java). A base consonant (ngalagéna)
 * carries an inherent /a/, replaced by a vowel sign (rarangkén) or suppressed by pamaéh/virama; medial signs
 * (panyakra -r-, pamingkal -y-, panyiku -l-) insert a glide; final signs (panyecek -ng, panglayar -r, pangwisad -h,
 * the final-k/final-m letters) close the syllable. We assemble the abugida back into the Latin orthography and reuse
 * the existing su g2p (digraphs eu/ng/ny, glottal insertion, penult stress) unchanged → identical IPA.
 *
 * Vowel mapping to the Latin (which the g2p reads): AE / panaélaéng → ⟨é⟩ [e]; the pepet E / pamepet → ⟨e⟩ [ə];
 * EU / paneuleung → ⟨eu⟩ [ɨ]. Digits (U+1BB0–1BB9) are normalised to ASCII in sundanese.ts so the number path fires.
 */

// Base consonant (ngalagéna) → Latin ONSET (the inherent /a/ is added by the assembler, or replaced by a sign).
const ONSET: Record<string, string> = {
    "ᮊ": "k", "ᮋ": "q", "ᮌ": "g", "ᮍ": "ng", "ᮎ": "c", "ᮏ": "j", "ᮐ": "z", "ᮑ": "ny", "ᮒ": "t", "ᮓ": "d",
    "ᮔ": "n", "ᮕ": "p", "ᮖ": "f", "ᮗ": "v", "ᮘ": "b", "ᮙ": "m", "ᮚ": "y", "ᮛ": "r", "ᮜ": "l", "ᮝ": "w",
    "ᮞ": "s", "ᮟ": "x", "ᮠ": "h", "ᮮ": "kh", "ᮯ": "sy", "ᮽ": "bh",
};
const INDEP: Record<string, string> = { "ᮃ": "a", "ᮄ": "i", "ᮅ": "u", "ᮆ": "é", "ᮇ": "o", "ᮈ": "e", "ᮉ": "eu" };
const SYLLABIC: Record<string, string> = { "ᮻ": "reu", "ᮼ": "leu" }; // REU / LEU = r/l + the eu vowel
// Vowel signs (rarangkén) — replace the inherent /a/.
const VOWEL_SIGN: Record<string, string> = { "ᮤ": "i", "ᮥ": "u", "ᮦ": "é", "ᮧ": "o", "ᮨ": "e", "ᮩ": "eu" };
// Medial consonant signs — insert a glide/liquid between the onset and the vowel.
const MEDIAL: Record<string, string> = { "ᮡ": "y", "ᮢ": "r", "ᮣ": "l", "ᮬ": "m", "ᮭ": "w" };
// Final signs — close the syllable with a coda.
const FINAL: Record<string, string> = { "ᮀ": "ng", "ᮁ": "r", "ᮂ": "h", "ᮾ": "k", "ᮿ": "m" };
const VIRAMA = new Set(["᮪", "᮫"]); // pamaéh / virama — suppress the inherent vowel
const DIGITS: Record<string, string> = { "᮰": "0", "᮱": "1", "᮲": "2", "᮳": "3", "᮴": "4", "᮵": "5", "᮶": "6", "᮷": "7", "᮸": "8", "᮹": "9" };

/** Is any character of `s` an Aksara Sunda letter/sign (U+1B80–1BBF)? */
export function isAksaraSunda(s: string): boolean {
    for (const ch of s) { const c = ch.codePointAt(0)!; if (c >= 0x1b80 && c <= 0x1bbf) return true; }
    return false;
}

/** Normalise Aksara Sunda digits (U+1BB0–1BB9) → ASCII (so the su number path can read them). */
export function normalizeSundaDigits(s: string): string {
    return [...s].map((ch) => DIGITS[ch] ?? ch).join("");
}

/** Transliterate an Aksara Sunda word → the Sundanese Latin orthography (the caller then runs the su g2p). */
export function aksaraToLatin(word: string): string {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    let out = "";
    let i = 0;
    const finals = (): void => { while (i < n && FINAL[s[i]!] !== undefined) out += FINAL[s[i++]!]!; };
    while (i < n) {
        const ch = s[i]!;
        if (ONSET[ch] !== undefined) {
            out += ONSET[ch]!;
            i++;
            while (i < n && MEDIAL[s[i]!] !== undefined) out += MEDIAL[s[i++]!]!; // medial glide(s)
            if (i < n && VOWEL_SIGN[s[i]!] !== undefined) out += VOWEL_SIGN[s[i++]!]!; // sign replaces inherent /a/
            else if (i < n && VIRAMA.has(s[i]!)) i++; // pamaéh → bare consonant (no vowel)
            else out += "a"; // inherent /a/
            finals();
        } else if (SYLLABIC[ch] !== undefined) {
            out += SYLLABIC[ch]!;
            i++;
            finals();
        } else if (INDEP[ch] !== undefined) {
            out += INDEP[ch]!;
            i++;
            finals();
        } else if (FINAL[ch] !== undefined) {
            out += FINAL[ch]!; // a coda sign after a vowel (e.g. an independent vowel + panyecek)
            i++;
        } else i++; // avagraha / stray sign / unknown → skip
    }
    return out;
}
