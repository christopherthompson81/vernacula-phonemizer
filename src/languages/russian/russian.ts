/**
 * Russian (ru) phonemizer — standard Moscow Russian, canonical IPA, espeak-independent. Stress is lexical
 * (not derivable from spelling), so a stress dictionary (stress.tsv, word → stressed-vowel ordinal) feeds the
 * rule g2p (g2p.ts). Words not in the dictionary fall back to a default (first-vowel) stress. text()
 * tokenizes words / numbers / punctuation. See docs/investigations/ru_native_bringup_investigation.md.
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
    percent: ["процент", "процента", "процентов"],
    currency: { "€": ["евро"], "$": ["доллар", "доллара", "долларов"], "£": ["фунт", "фунта", "фунтов"] },
    units: { "км": ["километр", "километра", "километров"], "см": ["сантиметр", "сантиметра", "сантиметров"],
        "мм": ["миллиметр", "миллиметра", "миллиметров"], "кг": ["килограмм", "килограмма", "килограммов"] },
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
