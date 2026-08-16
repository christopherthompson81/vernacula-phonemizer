/**
 * Tatar (tt) phonemizer — a Cyrillic grapheme scan + word-final (oxytone) stress, canonical IPA. This
 * file owns the harmony logic: ⟨к г⟩ back to [q ʁ] next to a BACK vowel (nearest-vowel scan), ⟨а⟩
 * fronts to [a] in a front-vowel word, ⟨е⟩ iotates word-initially/post-vocalically, and the
 * maximal-onset stress placement. The letter tables and the encyclopedic record live in tatar.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { numberToWords } from "./numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeTatar, normalizeTatarInitialisms } from "./normalize.ts";

interface TatarDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    vowelLetters: readonly string[];
    backVowels: readonly string[];
    frontVowels: readonly string[];
}
const DEF = loadManifest<TatarDef>(import.meta.url, "tatar.jsonc");
// Letter → IPA tables (tatar.jsonc). The harmony-conditioned ⟨к г а⟩ and iotating ⟨е⟩ are handled in the scan.
const CONS = DEF.consonants;
// Cyrillic vowel letters — for the word-initial/post-vocalic ⟨е⟩→[je] iotation.
const CYR_VOWEL = new Set(DEF.vowelLetters);
const STRESS_NASAL = new Set(["m", "n", "ŋ"]);
/** Sonority for maximal-onset stress: vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0. */
function sonority(seg: string): number {
    if ([...seg].some((c) => IPA_VOWEL.has(c))) return 6;
    if (seg === "j" || seg === "w") return 5;
    if (["l", "r"].includes(seg)) return 4;
    if (STRESS_NASAL.has(seg)) return 3;
    if (seg.includes("͡")) return 1;
    if (["f", "v", "s", "z", "ʃ", "ʒ", "ɕ", "ʑ", "x", "χ", "h", "ʁ", "ɣ"].includes(seg)) return 2;
    return 0;
}
const VOWEL = DEF.vowels;
const IOTATED = DEF.iotated;
// Backness for the к/г harmony: a nearby BACK vowel → [q]/[ʁ]; a FRONT vowel → [k]/[ɡ].
const BACK = new Set(DEF.backVowels);
const FRONT = new Set(DEF.frontVowels);

/** Is the nearest vowel to position `i` (scanning outward) a BACK vowel? Defaults to back (Turkic default). */
function nearBack(chars: string[], i: number): boolean {
    for (let d = 1; d < chars.length; d++) {
        for (const j of [i - d, i + d]) {
            const c = chars[j];
            if (c === "а") continue; // ⟨а⟩ is harmony-neutral for к/г backing — its own quality is decided by harmony
            if (c && BACK.has(c)) return true;
            if (c && FRONT.has(c)) return false;
        }
    }
    return true;
}

/** Phonemize one Tatar (Cyrillic) word → canonical IPA: harmony-aware grapheme scan + word-final stress. */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const chars = [...w];
    // Vowel harmony: a word with any FRONT vowel ⟨ә ө ү е и э⟩ fronts its ⟨а⟩ → [a] (else the back [ɑ]).
    const frontWord = /[әөүеиэ]/u.test(w);
    const segs: string[] = [];
    chars.forEach((ch, i) => {
        if (ch === "к") segs.push(nearBack(chars, i) ? "q" : "k");
        else if (ch === "г") segs.push(nearBack(chars, i) ? "ʁ" : "ɡ");
        else if (ch === "а") segs.push(frontWord ? "a" : "ɑ");
        else if (ch === "е") segs.push(i === 0 || CYR_VOWEL.has(chars[i - 1]!) ? "je" : "e"); // word-initial / post-vocalic ⟨е⟩ → [je]
        else if (CONS[ch] !== undefined) segs.push(CONS[ch]!);
        else if (IOTATED[ch] !== undefined) segs.push(IOTATED[ch]!);
        else if (VOWEL[ch] !== undefined) segs.push(VOWEL[ch]!);
        else if (ch === "ъ") segs.push("ʔ"); // hard sign — glottal / hiatus
        // ь (soft sign) and other marks: dropped
    });
    // Word-final (oxytone) stress — the Turkic default: ˈ before the MAXIMAL onset of the last vowel's syllable
    // (native Tatar has no onset clusters; loans do — спорт→ˈsport).
    const isV = (s: string): boolean => [...s].some((c) => IPA_VOWEL.has(c));
    const vidx = segs.map((s, idx) => (isV(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        const nucleus = vidx[vidx.length - 1]!;
        let at = nucleus;
        if (at > 0 && !isV(segs[at - 1]!)) at--; // the immediate onset consonant
        while (at > 0 && !isV(segs[at - 1]!)) {
            const p = segs[at - 1]!,
                l = segs[at]!;
            // obstruent + liquid/glide (loan pl/kr) or fricative + stop (sp/st) — Turkic has NO native onset clusters,
            // and no nasal+stop onsets (a medial nasal is a coda, e.g. якшәмбе's ⟨мб⟩), so those two suffice.
            const obstruentLiquid = sonority(p) <= 2 && sonority(l) >= 4;
            const sibilantStop = ["s", "ʃ", "ɕ"].includes(p) && sonority(l) <= 1; // the sC- onsets (спорт→sp), voiceless sibilant only
            if (!(obstruentLiquid || sibilantStop)) break;
            at--;
        }
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

/** A digit run → spoken Tatar, phonemized through the same Cyrillic g2p (see numbers.ts for the data + provenance). */
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

/**
 * The shared SYMBOL tier. Every word here is a tt.wikipedia TOKEN attestation whose examples were read
 * (`tools/corpus/attest/tt.jsonc`), and three of them are glossed by the corpus's own notation:
 *   `градус` — its OWN ARTICLE names the sign AND its sense: "Градус билгесе ((°), Unicode: U+00B0,
 *     HTML: &deg;) — **почмакның** һәм…" ("the degree sign — of an ANGLE and…"), which is the same
 *     finding normalize.ts reaches from the ten instances: in Tatar this sign is angular, not thermal.
 *   `квадрат` — "**Квадра́т киломе́тр (км², кв. км, km²)** — мәйдан үлчәве берәмлеге", which fixes the
 *     word, its POSITION (before the unit) and all three of the notations it has to match.
 *   `доллар` — "1 доллар = 100 цент. Гадәттә **$** яки USD дип билгеләнә" — the article names the sign.
 * `процент` ×many with a figure beside it ("65,0 процент үзенең туган телен"), `тапкыр` ("205 тапкыр —
 * ике һәм 16 тапкыр — өч мәртәбә"), `тигез` beside its own formula ("1000 м × 1000 м = 1 000 000 м² га
 * тигез" — ⚠ and note it governs the DATIVE there, while this layer emits the bare nominative reading a
 * reader says for `5 = 5`), `сум` from the currency article ("тат. **сум** / sum").
 *
 * ⚠ NO `unitPer`, AND NO BARE `г` OR `т`. Tatar does not say "A per B": the denominator takes the
 * possessive-dative and stands alone (*метр секундына*), which is Basque's shape — `unitPer` is the empty
 * string and `rateDenominators` carries the inflected form. And `г`/`т` are declined outright: `В 3 т.`
 * and `1938 г.` are Russian *том* and *года*, this corpus carries Russian bibliography in quantity, and
 * the tier's trailing guard does not reject a dot — so declaring either key would have read every Russian
 * volume number as a tonnage and every Russian year as a weight. Same call ba made for `г`.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["процент"],
    currency: { "$": ["доллар"], "€": ["евро"], "£": ["фунт"], "₽": ["сум"] },
    units: {
        "км": ["километр"], "см": ["сантиметр"], "мм": ["миллиметр"], "кг": ["килограмм"],
        "мг": ["миллиграмм"], "га": ["гектар"], "м": ["метр"],
        // LATIN aliases. tt.wikipedia writes the Cyrillic abbreviation in its Cyrillic articles, but the
        // engine's TOKEN matches Cyrillic only, so the corpus's own `4360 km²` and `9,44 m³/c` — written
        // in Cyrillic prose, not Zamanälif — lose the unit entirely rather than merely mispronouncing it.
        "km": ["километр"], "cm": ["сантиметр"], "mm": ["миллиметр"], "kg": ["килограмм"], "m": ["метр"],
    },
    unitPer: "",
    rateDenominators: {
        "с": "секундына", "сәг": "сәгатенә", "л": "литрына",
        "s": "секундына", "h": "сәгатенә", "c": "секундына",
    },
    exponentWords: { squared: ["квадрат"], cubed: ["куб"], position: "before" },
    multiply: { times: "тапкыр" },
    ampersand: "һәм",
    // Tatar writes the magnitude word after the figure and often after a DECIMAL (`17 752 мең км²`,
    // `1360 мең км²`, `$5,7 миллиард`), so the tier must hop it to reach a unit on the far side. Turkic
    // magnitudes do not inflect.
    magnitudes: ["мең", "миллион", "миллиард", "триллион"],
});

// A word (Tatar Cyrillic letters) / number / punctuation token.
// ⚠ THE DECIMAL COMMA IS SPANNED BY THE NUMBER BRANCH, or the tokenizer's own `,` claims it as a clause
// pause and `9,44 м³/с` reads as *тугыз , кырык дүрт* — a phrase break inside a quantity. `decimals` is
// 33,800 corpus-wide and the retained text writes `0,6 км`, `8,6 кеше/км²`, `11,5%`, `72,9%`, `3,8 %`.
const TOKEN = /([Ѐ-ӿ]+)|(\d+(?:,\d+)?)|([.!?…,;:])/gu;

class TatarPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its clock, suffix, degree and sign steps need the figure and its written
        // suffix still adjacent, which the tier would break — then the INITIALISM pass, then the shared
        // symbol tier, which matches a unit only when a NUMBER is adjacent.
        const prepared = SYMBOLS(normalizeTatarInitialisms(normalizeTatar(input)));
        return assembleClauses(prepared, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                sink.emit(number(intPart!));
                if (frac !== undefined) {
                    // The decimal separator's own NAME, from tt.wikipedia's own punctuation article:
                    // "**өтер**, нокта, нокталы өтер, ике нокта, сорау һәм өндәү билгеләре".
                    // ⚠ THE FULL SPOKEN READING IS DECLINED, deliberately: Tatar says *биш бөтен өчдән
                    // ун* — a "whole" word plus a tail that NAMES THE DECIMAL PLACE. The place name
                    // cannot be composed here, and half of a two-part reading is worse than the sign's
                    // name. Same call ba made (өтөр), uk made (кома), pl made (przecinek), be made (коска).
                    sink.emit(phonemizeWord("өтер"));
                    for (const dg of frac) sink.emit(number(dg));
                }
            }
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Tatar phonemizer (Cyrillic g2p + harmony-driven к/г backing + final stress). */
export function createTatar(): Phonemizer {
    return new TatarPhonemizer();
}
