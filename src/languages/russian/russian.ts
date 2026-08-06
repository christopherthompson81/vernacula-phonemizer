/**
 * Russian (ru) phonemizer — standard Moscow Russian, canonical IPA. Stress is lexical
 * (not derivable from spelling), so a stress dictionary (stress.tsv, word → stressed-vowel ordinal) feeds the
 * rule g2p (g2p.ts). Words not in the dictionary fall back to a default (first-vowel) stress. text()
 * tokenizes words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toIpa } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeRussian, normalizeRussianInitialisms } from "./normalize.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Stress dictionary: word → 0-based ordinal of the stressed vowel. Loaded once, lazily.
let STRESS: Map<string, number> | undefined;
function stressDict(): Map<string, number> {
    if (STRESS === undefined) STRESS = loadTsvMap(import.meta.url, "stress.tsv", Number);
    return STRESS;
}

// Loanword hard-consonant-before-е/и lexicon: word → vowel ordinals whose preceding C is hard (тест → tɛst).
let HARD: Map<string, number[]> | undefined;
function hardDict(): Map<string, number[]> {
    if (HARD === undefined)
        HARD = loadTsvMap(
            import.meta.url,
            "hard-e.tsv",
            (v) => v.split(",").map(Number),
            { optional: true },
        );
    return HARD;
}

const VOWEL_RE = new RegExp(`[${MANIFEST.vowelLetters}]`, "gi");

// Closed-class irregulars the rules can't predict (чт→ʂt / чн→ʃn, genitive -ого/-его → g→v, silent letters) —
// DATA (russian.jsonc).
const IRREGULARS = MANIFEST.irregulars;

/** One Russian word → canonical IPA. Stress from the dictionary; ё is inherently stressed; else first vowel. */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    const irr = IRREGULARS[w];
    if (irr !== undefined) return irr;
    let ord = stressDict().get(w);
    if (ord === undefined && w.includes("е")) {
        // Russian text usually writes ё as е. If the word is unknown, try restoring a ё that IS in the dictionary
        // (ещё, моё, пришёл…) — the ё is inherently stressed, so this fixes both the segment and the stress.
        for (let i = 0; i < w.length; i++) {
            if (w[i] !== "е") continue;
            const cand = w.slice(0, i) + "ё" + w.slice(i + 1);
            if (stressDict().has(cand)) return phonemizeWord(cand);
        }
    }
    if (ord === undefined) ord = adjectiveStress(w); // inflected adjective/pronoun → stress from its masc. lemma
    if (ord === undefined) {
        const eIdx = [...w.matchAll(VOWEL_RE)].findIndex((m) => m[0] === "ё");
        ord = eIdx >= 0 ? eIdx : 0; // ё is always stressed; otherwise default to the first vowel
    }
    return toIpa(w, ord, hardDict().get(w));
}

// Adjective / participle / adjectival-pronoun case endings (longest first), each paired with the masculine
// nominative endings used to reconstruct the lemma. HARD endings (-ое/-ая/-ые…) → -ый/-ой; SOFT (-ее/-яя/-ие…)
// → -ий — so большое → большой (not the comparative больший). Stress is stem-relative → the lemma ordinal transfers.
// -ий is a last-resort fallback on HARD endings for velar/hushing stems whose lemma is -ий but whose feminine
// is spelled -ая (маленький → маленькая), while большое still resolves to большой before reaching -ий.
// Adjective-ending → lemma-ending table (DATA: russian.jsonc). Each ending is HARD (lemma -ый/-ой/-ий) or SOFT
// (lemma -ий/-ый); the shared lemma lists are reconstructed from the manifest's hard/soft groups.
const ADJ_ENDINGS: [string, string[]][] = MANIFEST.adjectiveStress.endings.map(
    (e) => [
        e.end,
        e.type === "hard"
            ? MANIFEST.adjectiveStress.hardLemmas
            : MANIFEST.adjectiveStress.softLemmas,
    ],
);
const countVowels = (w: string): number =>
    [...w].filter((c) => MANIFEST.vowelLetters.includes(c)).length;

/** Stress ordinal for an OOV inflected adjective/pronoun form, inferred from its masculine lemma (большое →
 *  большой, которые → который). Returns undefined if no lemma is in the dictionary. */
function adjectiveStress(w: string): number | undefined {
    for (const [end, lemEnds] of ADJ_ENDINGS) {
        if (!w.endsWith(end) || w.length - end.length < 2) continue;
        const stem = w.slice(0, w.length - end.length);
        for (const lemEnd of lemEnds) {
            const ord = stressDict().get(stem + lemEnd);
            if (ord !== undefined && ord < countVowels(w)) return ord;
        }
    }
    return undefined;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([а-яёА-ЯЁ]+)|(\d+(?:[.,]\d+)?)|([.!?…,;:])/gu;

// #562 symbol normalization — Russian: CYRILLIC unit abbreviations (км, not km) and three-way agreement.
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
    // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
    // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
    // defaults to it — this language does not split dimension from product.
    multiply: { times: "умножить на" },
    // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
    // `и` ×1129 in this corpus. The tier spaces it on both sides, because `B&B` is two
    // initialisms and joining them would make one token.
    ampersand: "и",
    percent: ["процент", "процента", "процентов"],
    currency: { "€": ["евро"], "$": ["доллар", "доллара", "долларов"], "£": ["фунт", "фунта", "фунтов"] },
    units: { "км": ["километр", "километра", "километров"], "см": ["сантиметр", "сантиметра", "сантиметров"],
        "мм": ["миллиметр", "миллиметра", "миллиметров"], "кг": ["килограмм", "килограмма", "килограммов"],
        // LATIN aliases. The corpus writes Cyrillic км, but Latin `km` occurs in foreign-sourced text and
        // reached the g2p raw — "120 km/h" came out as the cluster [ˈʊkm] plus the ENGLISH letter H.
        "km": ["километр", "километра", "километров"], "cm": ["сантиметр", "сантиметра", "сантиметров"],
        "mm": ["миллиметр", "миллиметра", "миллиметров"], "kg": ["килограмм", "килограмма", "килограммов"],
        "ч": ["час", "часа", "часов"], "h": ["час", "часа", "часов"],
        // THE BARE METRE, both spellings. метров ×6 / метра ×2, and digit-adjacent bare Latin `m` is ×0 in
        // this corpus. `кубический` was already declared below but unreachable without a head noun, so
        // `120 m³` read as the letter name while `120 km³` read correctly. The apostrophe hazard that kept
        // Ukrainian's `м` out is guarded by the tier itself (`'’ʼ` are rejected after a unit key).
        "м": ["метр", "метра", "метров"], "m": ["метр", "метра", "метров"] },
    unitPer: "в",
    exponentWords: { squared: ["квадратный", "квадратных"], cubed: ["кубический", "кубических"], position: "before" },
    // #586 BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
    // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
    // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
    // they are different words (квадратных километров but двадцать в квадрате).
    // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
    // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact, and the apparent
    // hits for other languages were substring traps of exactly the kind tools/normalization/attest.ts warns
    // about — th `กำลัง` matched the progressive-aspect marker, fa `توان` and ar `أس` matched inside unrelated
    // words. FLEURS is news and encyclopedia prose and simply does not contain spoken arithmetic.
    // The cardinal is used for the generic power, never the ordinal — see core for that argument.
    bareExponent: { squared: "{n} в квадрате", cubed: "{n} в кубе", power: "{n} в степени {e}" , negative: "минус" },
    // Without these the magnitude never matched, so "$5 миллионов" hopped the currency word to the WRONG
    // side and read *пять долларов миллионов*. The inflected forms are listed because running text writes
    // the one its numeral governs (5 миллионов, 2 миллиона).
    magnitudes: ["тысячи", "тысяч", "миллион", "миллиона", "миллионов", "миллиард", "миллиарда", "миллиардов"],
    countForm: slavicCountForm,
});

class RussianPhonemizer implements Phonemizer {
    text(input: string): string {
        // #562 order: Russian rewrites (abbreviations, ordinal notation, clock, units) → INITIALISMS →
        // the shared symbol tier last. Roman numerals arrive already converted from the registry seam,
        // with romanOrdinals.ts supplying the ordinal a century wants, so no ordering hazard here.
        const normalized = SYMBOLS(normalizeRussianInitialisms(normalizeRussian(input)));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(/[.,]/);
                for (const wd of numberToWords(Number(intPart)).split(" "))
                    sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord(MANIFEST.numbers.decimalConnector));
                    for (const d of frac)
                        for (const wd of numberToWords(Number(d)).split(" "))
                            sink.emit(phonemizeWord(wd));
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Russian phonemizer (stress dictionary + rule g2p). */
export function createRussian(): Phonemizer {
    return new RussianPhonemizer();
}
