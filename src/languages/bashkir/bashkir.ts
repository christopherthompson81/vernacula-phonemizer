/**
 * Bashkir (ba) phonemizer — a Cyrillic grapheme scan + word-final (oxytone) stress, canonical IPA.
 * This file owns the position rules: dark/clear ⟨л⟩ by harmony, the ⟨у ү⟩ glide-vs-vowel split, ⟨е⟩
 * iotation, and RUSSIAN-LOAN routing via vowel-harmony violation. The letter tables and the encyclopedic
 * record (phonology, alphabet, referee caveats) live in bashkir.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeBashkir, normalizeBashkirInitialisms } from "./normalize.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { phonemizeWord as russianWord } from "../russian/russian.ts";
import { numberToWords } from "./numbers.ts";

interface BashkirDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    vowelLetters: readonly string[];
    backVowels: readonly string[];
    bashkirLetters: readonly string[];
    loanFrontVowels: readonly string[];
}
const DEF = loadManifest<BashkirDef>(import.meta.url, "bashkir.jsonc");
// Letter → IPA tables (bashkir.jsonc). The position-dependent letters (⟨л у ү е⟩) are handled in the scan below.
const CONS = DEF.consonants;
const VOWEL = DEF.vowels;
const IOTATED = DEF.iotated;
const CYR_VOWEL = new Set(DEF.vowelLetters);
const BACK = new Set(DEF.backVowels); // back-harmony vowels — govern the dark ⟨л⟩→[ɫ]

// ⚠ RUSSIAN-LOAN DETECTION. Real Bashkir text is saturated with Russian loanwords, and Bashkir speakers pronounce them
// RUSSIAN-STYLE (palatalization, akanye, Russian stress) — so a realistic phonemizer routes them to the Russian g2p.
// The signal is VOWEL HARMONY: native Bashkir is strictly all-back or all-front, so a word MIXING a back vowel (а о у ы)
// with a front one — and lacking any Bashkir-specific letter (which are always harmonic) — is a Russian loan.
// The three lists, and WHY the front one is shorter than it looks, are in bashkir.jsonc.
const BASHKIR_LETTER = new Set(DEF.bashkirLetters);
const BACK_V = BACK; // the same back vowels as the ⟨л⟩ rule — one set of them exists, so one list
const FRONT_V = new Set(DEF.loanFrontVowels);
/**
 * ⟨ѳ⟩ U+0473 IS ⟨ө⟩ AND ⟨ӊ⟩ U+04CA IS ⟨ң⟩ — legacy-codepage artefacts, not letters of any alphabet in use.
 *
 * Pre-Unicode Bashkir/Tatar fonts had no slots for ⟨ө⟩ and ⟨ң⟩ and borrowed the Church-Slavonic FITA and the
 * Khanty EN-WITH-TAIL for them; text typed that way keeps the wrong codepoint when it is pasted into the wiki.
 * The corpus decides it: ⟨ѳ⟩ ×7 against ⟨ө⟩ ×1,323 and ⟨ӊ⟩ ×11 against ⟨ң⟩ ×921, and every occurrence is a
 * word that exists with the real letter — `кѳньяғында`, `һѳрѳлгән`, `кѳтѳүлектәр`; `уныӊ`, `кешенеӊ`,
 * `меӊдән`. Fita is in no modern Cyrillic alphabet at all, so there is no other reading to weigh.
 *
 * ⚠ AND THE DAMAGE WAS NOT ONLY THE DELETED LETTER. Both are outside the letter tables, so `кѳньяғында` read
 * `knjɑʁɯnˈdɑ` with the vowel simply gone — AND the loan router saw a word with no front vowel in it, so a
 * front-harmony Bashkir word was one ⟨ѳ⟩ away from being read as Russian. The fold therefore runs before
 * `isRussianLoan`, not inside the native scan.
 */
const LEGACY_CODEPAGE: Readonly<Record<string, string>> = { "ѳ": "ө", "Ѳ": "Ө", "ӊ": "ң", "Ӊ": "Ң" };
const LEGACY_RE = new RegExp(`[${Object.keys(LEGACY_CODEPAGE).join("")}]`, "gu");
export const foldLegacyCodepage = (w: string): string => w.replace(LEGACY_RE, (c) => LEGACY_CODEPAGE[c]!);

export function isRussianLoan(word: string): boolean {
    const w = word.normalize("NFC").toLowerCase();
    if ([...w].some((c) => BASHKIR_LETTER.has(c))) return false; // a native Bashkir letter → native word
    return [...w].some((c) => BACK_V.has(c)) && [...w].some((c) => FRONT_V.has(c)); // harmony violation → loan
}

/** Phonemize one Bashkir word → canonical IPA. A detected RUSSIAN LOAN is routed to the Russian g2p (Bashkir speakers
 *  read loans Russian-style); otherwise the native Bashkir scan (`phonemizeWordNative`) runs. */
export function phonemizeWord(word: string): string {
    const w = foldLegacyCodepage(word);
    return isRussianLoan(w) ? russianWord(w) : phonemizeWordNative(w);
}

/** The NATIVE Bashkir g2p (Cyrillic grapheme scan + word-final stress), WITHOUT Russian-loan routing. */
export function phonemizeWordNative(word: string): string {
    // Folded here too: this entry is exported and `referee-eval` calls it directly, bypassing the router above.
    const w = foldLegacyCodepage(word.normalize("NFC").toLowerCase());
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
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time instead, THROUGH THE SAME COMPOSER: a one-digit number is a call this engine already
    // answers, so the fallback cannot invent a word. See core/numbers.ts `spellDigits` for the full
    // account and the cost — above 2^53 the reading is a digit string, not a quantity.
    if (!Number.isSafeInteger(n))
        return [...digits].flatMap((d) => numberToWords(Number(d))).map(phonemizeWord).join(" ");
    return numberToWords(n).map(phonemizeWord).join(" ");
}

// A Bashkir Cyrillic word / number / punctuation.
// ⚠ THE NUMBER TOKEN SPANS THE DECIMAL COMMA. Without it the comma is clause punctuation and `5,3 %`
// read as *биш , өс* — a phrase break inside a quantity, on 24,214 corpus instances. The DOT is
// deliberately not spanned: this corpus's 98 dot-decimals are percent-encoded wiki anchors, a lens
// aperture and a page range, and not one is a number (see normalize.ts's header).
const TOKEN = /([Ѐ-ӿ]+)|(\d+(?:,\d+)?)|([.!?…,;:])/gu;


/**
 * SYMBOL NORMALIZATION — Bashkir. Every word is a ba.wikipedia TOKEN attestation whose examples were read
 * (see normalize.ts's header and docs/investigations/ba/ba_normalization_investigation.md, run 3):
 *   `процент` ×206 · `километр` ×69 · `килограмм` ×65 · `доллар` ×221 · `евро` ×87 ·
 *   `һум` ×142 ("Һум — Рәсәй Федерацияһының милли аҡсаһы") · `квадрат` ×165 · `куб` ×35 · `тапҡыр` ×103.
 * The corpus's own text supplies the exponent slot verbatim — "майҙаны 130 395 квадрат километр" — which
 * also fixes the WORD ORDER: Bashkir puts the measure adjective BEFORE the noun, like the East Slavic
 * layers and unlike Swedish's fused compound.
 *
 * ⚠ TURKIC AGREEMENT IS NOT SLAVIC AGREEMENT, and this is the one place a Slavic template would mislead:
 * a Turkic counted noun stays SINGULAR after a numeral (`5 километр`, never *5 километрҙар*), so every
 * entry here is a ONE-element `CountForms` array. The tier's default `countForm` then always picks it.
 *
 * ⚠ THREE KEYS ARE DELIBERATELY NOT DECLARED, each on a counted corpus fact:
 *   `г` — `1938 г.` is Russian *года* and `3,300 г` is the gram; the DOT separates them and the tier's
 *     trailing guard does not reject a dot, so the gram is claimed in normalize.ts step 7 instead.
 *   `с` — every standalone `с.` is Russian *страниц* in a bibliography (`80 с.`, `707 с.`). It survives
 *     only as a rate denominator, which is the one Bashkir sense the corpus shows (`м³/с`).
 *   `т` — *том* in the same bibliographies, not the tonne.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["процент"],
    currency: { "$": ["доллар"], "€": ["евро"], "₽": ["һум"], "£": ["фунт"] },
    units: {
        "км": ["километр"], "см": ["сантиметр"], "мм": ["миллиметр"], "кг": ["килограмм"],
        "мг": ["миллиграмм"], "га": ["гектар"], "м": ["метр"],
        // LATIN aliases. ba.wikipedia writes the Cyrillic abbreviation, but the engine's TOKEN matches
        // Cyrillic only, so a foreign-sourced `120 km` loses the unit entirely rather than merely
        // mispronouncing it — the same reasoning as Russian's and Ukrainian's aliases.
        "km": ["километр"], "cm": ["сантиметр"], "mm": ["миллиметр"], "kg": ["килограмм"], "m": ["метр"],
    },
    unitPer: "бер", // м³/с → куб метр БЕР секунд
    rateDenominators: { "с": "секунд", "сәғ": "сәғәт", "s": "секунд", "h": "сәғәт" },
    exponentWords: { squared: ["квадрат"], cubed: ["куб"], position: "before" },
    multiply: { times: "тапҡыр" },
    ampersand: "һәм",
    // Bashkir writes the magnitude word after the figure and often after a DECIMAL (`1 042,4 мең кеше`),
    // so the tier must hop it to reach a unit on the far side. Turkic magnitudes do not inflect.
    magnitudes: ["мең", "миллион", "миллиард", "триллион"],
});

class BashkirPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its ordinal, clock, degree and suffix steps need the figure and its written
        // suffix still adjacent, which the tier would break — then the INITIALISM pass, then the shared
        // symbol tier, which matches a unit only when a NUMBER is adjacent.
        const prepared = SYMBOLS(normalizeBashkirInitialisms(normalizeBashkir(input)));
        return assembleClauses(prepared, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                sink.emit(number(intPart!));
                if (frac !== undefined) {
                    // The decimal separator's own NAME, from ba.wikipedia's article on it: "Өтөр — тыныш
                    // билдәһе" ("comma — a punctuation mark"), ×27 in 17 articles.
                    // ⚠ THE FULL SPOKEN READING IS DECLINED, deliberately: Bashkir says *биш бөтөн өс
                    // ундан* — `бөтөн` ("whole", ×207 and attested in exactly this numeric domain,
                    // "Бөтөн һандар" = the integers) plus a tail that NAMES THE DECIMAL PLACE
                    // (ундан / йөҙҙән / меңдән). The place name cannot be composed here, and half of a
                    // two-part reading is worse than the sign's name. Same call uk made (кома), pl made
                    // (przecinek) and be made (коска).
                    sink.emit(phonemizeWord("өтөр"));
                    for (const dg of frac) sink.emit(number(dg));
                }
            }
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Bashkir phonemizer (Cyrillic scan + interdentals + Bashkir vowel shift + final stress). */
export function createBashkir(): Phonemizer {
    return new BashkirPhonemizer();
}
