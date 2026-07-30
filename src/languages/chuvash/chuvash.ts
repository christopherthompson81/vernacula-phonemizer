/**
 * Chuvash (chv) phonemizer — Чӑвашла / Чӑваш чӗлхи, the SOLE surviving Oghur (Bulgaric) Turkic language (the deepest
 * split in Turkic — sister to every Common-Turkic language, tr/az/tk/tt/ba/kk), ~1M (Chuvashia, Russia), CYRILLIC (the
 * Chuvash alphabet + ⟨ӑ ӗ ҫ ӳ⟩). Canonical IPA, espeak-independent. A Cyrillic grapheme scan with two Chuvash signatures:
 *
 *   ★★ ALLOPHONIC VOICING — Chuvash has NO phonemic voicing contrast: the voiceless letters ⟨п т к ч с ҫ ш х⟩ voice to
 *      [b d ɡ d͡ʑ z ʑ ʐ ɣ] between vowels, after a NASAL/glide, or after a LIQUID before a FULL vowel (апат→aˈbat,
 *      ача→aˈd͡ʑa, манпа→manˈba, вӑлсем→ʋəlˈzem). A GEMINATE (doubled letter) is the underlying "strong" consonant and
 *      BLOCKS voicing → single long [Cː] (иккӗ→ˈikːɘ).
 *   ★★ REDUCED-VOWEL STRESS — the two reduced vowels ⟨ӑ⟩→[ə], ⟨ӗ⟩→[ɘ] cannot bear stress; stress falls on the last
 *      FULL vowel, else (all-reduced) on the first syllable (вӑлсем→ʋəlˈzem, сӑмах→səˈmax, vs вӑкӑр→ˈvəɡər).
 *
 * 🔷 single-source: English Wiktionary 'Chuvash terms with IPA pronunciation' (84 literal human {{IPA|cv|…}} pairs;
 * no wikipron/epitran chv). See docs/investigations/chv_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";

// Onset (default, pre-voicing) consonants. ⟨в⟩→[ʋ] (labial approximant; ~[w] in a coda), ⟨х⟩→[χ] (uvular), ⟨ҫ⟩→[ɕ].
const ONSET: Record<string, string> = {
    "б": "b", "в": "ʋ", "г": "ɡ", "д": "d", "ж": "ʒ", "з": "z", "й": "j", "к": "k", "л": "l",
    "м": "m", "н": "n", "ҥ": "ŋ", "п": "p", "р": "r", "с": "s", "т": "t", "ф": "f", "х": "χ",
    "ц": "t͡s", "ч": "t͡ɕ", "ш": "ʂ", "щ": "ɕ", "ҫ": "ɕ", "һ": "h",
};
// The intervocalic / post-sonorant VOICED allophone of each of the eight native voiceless obstruents (the Chuvash
// voicing rule). ⟨ф⟩ and ⟨ц⟩ are Russian-loan-only letters — excluded: loans don't undergo Chuvash allophonic voicing.
const VOICE: Record<string, string> = {
    "p": "b", "t": "d", "k": "ɡ", "t͡ɕ": "d͡ʑ", "s": "z", "ɕ": "ʑ", "ʂ": "ʐ", "χ": "ɣ",
};
// Vowels. ⟨ӑ⟩→[ə] and ⟨ӗ⟩→[ɘ] are the two REDUCED vowels (cannot bear stress); ⟨е⟩ is [je] initial/post-vowel below.
const VOWEL: Record<string, string> = {
    "а": "a", "е": "e", "и": "i", "о": "o", "у": "u", "ы": "ɯ", "э": "e", "ӑ": "ə", "ӗ": "ɘ", "ӳ": "y",
};
const IOTATED: Record<string, string> = { "я": "ja", "ю": "ju", "ё": "jo" };
const CYR_VOWEL = new Set([..."аеиоуыэёюяӑӗӳ"]);
// Voicing triggers (before a vowel). The nasals ⟨н м ҥ⟩ and the glide ⟨й⟩ trigger voicing UNCONDITIONALLY, like an
// intervocalic vowel (манпа→manˈba, мӗншӗн→ˈmŏnʐɘn before a REDUCED vowel, айта→ajˈda). The liquids ⟨р л⟩ trigger it
// only before a FULL vowel — the generalization that fits all three referee cases: вӑлсем→ʋəlˈzem (л·с·е FULL → z) vs
// ҫулҫӑ→ɕulɕ… (л·ҫ·ӑ REDUCED → ɕ) and чӗрпӗк→…rʲpʲ… (р·п·ӗ REDUCED → p).
const NASAL_GLIDE = new Set(["n", "m", "ŋ", "j"]);
const LIQUID = new Set(["l", "r"]);
const REDUCED = new Set(["ə", "ɘ"]); // reduced vowels — never stressed
const IPA_VOWEL = new Set([..."aeiouɯəɘyo"]);

type Seg = { ipa: string; vowel: boolean; reduced: boolean };

/** Phonemize one Chuvash word → canonical IPA (Cyrillic scan + intervocalic/post-nasal voicing + reduced-vowel stress). */
export function phonemizeWord(word: string): string {
    const chars = [...word.normalize("NFC").toLowerCase()];
    const segs: Seg[] = [];
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!;
        if (ch === "е") {
            // ⟨е⟩ → [je] word-initial / post-vowel, [e] otherwise.
            const prevV = i > 0 && CYR_VOWEL.has(chars[i - 1]!);
            if (i === 0 || prevV) segs.push({ ipa: "j", vowel: false, reduced: false });
            segs.push({ ipa: "e", vowel: true, reduced: false });
        } else if (VOWEL[ch] !== undefined) {
            const v = VOWEL[ch]!;
            segs.push({ ipa: v, vowel: true, reduced: REDUCED.has(v) });
        } else if (IOTATED[ch] !== undefined) {
            const [g, v] = [...IOTATED[ch]!]; // glide + vowel (ja ju jo)
            segs.push({ ipa: g!, vowel: false, reduced: false });
            segs.push({ ipa: v!, vowel: true, reduced: false });
        } else if (ONSET[ch] !== undefined) {
            // Gemination: a doubled consonant is the "strong" segment — single long [Cː] that BLOCKS voicing.
            if (i + 1 < chars.length && chars[i + 1] === ch) {
                segs.push({ ipa: ONSET[ch]! + "ː", vowel: false, reduced: false });
                i++; // consume the pair
            } else {
                segs.push({ ipa: ONSET[ch]!, vowel: false, reduced: false });
            }
        }
        // ъ ь and stray marks: dropped
    }

    // ★ VOICING pass: a voiceless obstruent voices when the previous seg is a vowel or a nasal AND the next seg is a
    // vowel (intervocalic V_V, or nasal_V). Geminates already carry the length mark and are not in VOICE → untouched.
    for (let k = 0; k < segs.length; k++) {
        const s = segs[k]!;
        const voiced = VOICE[s.ipa];
        if (voiced === undefined) continue;
        const prev = segs[k - 1];
        const next = segs[k + 1];
        if (prev === undefined || next === undefined || !next.vowel) continue; // must be prevocalic
        const trigger = prev.vowel || NASAL_GLIDE.has(prev.ipa) || (LIQUID.has(prev.ipa) && !next.reduced);
        if (trigger) s.ipa = voiced;
    }

    // ★ STRESS: the last FULL (non-reduced) vowel; if the word has only reduced vowels, the first vowel. ˈ before the
    // nucleus's onset consonant.
    const vIdx = segs.map((s, idx) => (s.vowel ? idx : -1)).filter((x) => x >= 0);
    if (vIdx.length) {
        const full = vIdx.filter((idx) => !segs[idx]!.reduced);
        const nucleus = full.length ? full[full.length - 1]! : vIdx[0]!;
        const at = nucleus > 0 && !segs[nucleus - 1]!.vowel ? nucleus - 1 : nucleus;
        segs.splice(at, 0, { ipa: "ˈ", vowel: false, reduced: false });
    }
    return segs.map((s) => s.ipa).join("").normalize("NFC");
}

/** A digit run → spoken Chuvash, phonemized through the same Cyrillic g2p (data + provenance in numbers.ts). */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return numberToWords(n).map(phonemizeWord).join(" ");
}

// A Chuvash Cyrillic word / number / punctuation.
const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])/gu;

class ChuvashPhonemizer implements Phonemizer {
    text(input: string): string {
        // NFC-normalize BEFORE tokenizing: Chuvash ⟨ӑ ӗ ӳ⟩ decompose under NFD to base+combining (U+0306/U+030B), and
        // those combining marks fall OUTSIDE the [Ѐ-ӿ] token class — so NFD input would shatter words mid-token and
        // drop the reduction mark (чӑваш → "t͡ɕa ʋaʂ"). phonemizeWord re-normalizes, but the split has already happened.
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Chuvash phonemizer (Cyrillic scan + allophonic voicing + geminate-blocking + reduced-vowel stress). */
export function createChuvash(): Phonemizer {
    return new ChuvashPhonemizer();
}
