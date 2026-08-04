/**
 * Czech (cs) phonemizer — canonical IPA, espeak-independent. Rule g2p (g2p.ts) + fixed FIRST-syllable stress
 * with secondary stress on even non-final nuclei (republika→rˈɛpublˌɪka). Syllabic r̩/l̩ count as nuclei.
 * text() pipeline (#562): normalizeCzech (grouping, abbreviations, ordinals with case inflection, clock,
 * dates, ranges, signs) → normalizeCzechInitialisms → the shared symbol tier (units, currency, exponents,
 * rates) → the clause assembler, whose number token carries the decimal comma. See
 * docs/investigations/cs_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { csCountForm, normalizeCzech, normalizeCzechInitialisms } from "./normalize.ts";

// LOANWORD lexicon (loanwords.tsv, kaikki/Wiktionary-derived): pronunciations the native rules mis-derive — chiefly
// di/ti/ni NON-palatalization in loans (stadion→stadɪjon, not staɟɪjon), loanword long í, foreign names. The rules
// correctly palatalize NATIVE di/ti/ni (tisíc→cɪsiːts), so only the exceptions are dictionaried. See build-cs-kaikki-dict.mts.
let LEX: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEX === undefined)
        LEX = loadTsvMap(import.meta.url, "loanwords.tsv", undefined, {
            optional: true,
        });
    return LEX;
}

/** One Czech word → canonical IPA with first-syllable primary stress + even-non-final secondary stress. */
export function phonemizeWord(word: string): string {
    const lex = lexicon().get(word) ?? lexicon().get(word.toLowerCase());
    if (lex !== undefined) return lex;
    const segs = toSegments(word);
    const nucIdx = segs
        .map((s, i) => (s.nucleus ? i : -1))
        .filter((i) => i >= 0);
    if (nucIdx.length === 0) return segs.map((s) => s.ph).join("");
    const last = nucIdx.length - 1;
    let out = "",
        vi = -1;
    for (let i = 0; i < segs.length; i++) {
        if (segs[i]!.nucleus) {
            vi++;
            out +=
                vi === 0
                    ? "ˈ"
                    : vi >= 2 && vi % 2 === 0 && vi !== last
                      ? "ˌ"
                      : "";
        }
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// The number token carries its DECIMAL COMMA (Czech's decimal mark) so the comma is not read as clause
// punctuation — `2,3` was coming out as a phrase break between "dva" and "tři". A 3-digit block after the
// comma is GROUPING, not a fraction (the corpus's "19,500 km²" is nineteen thousand five hundred), so it
// is read as one number.
/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_CLASS = "[A-Za-zÁáČčĎďÉéĚěÍíŇňÓóŘřŠšŤťÚúŮůÝýŽž]";
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions (#657).
 */
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES (#657).
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+(?:,\\d+)?)|([.!?…,;:])`, "gu");

// #562 symbol normalization — Czech, with the Slavic three-way agreement (1 procento / 2 procenta /
// 5 procent). `countForm` is Czech's own, not `slavicCountForm`: a compound ending in 1 is the genitive
// plural (dvacet jedna procent), where the Russian selector keeps the singular. km²/mm² are composed here
// (čtvereční kilometr, before the noun, agreeing), and km/h / m/s read as "kilometrů za hodinu" /
// "metrů za sekundu" via the rate machinery — both were local defects before the migration.
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "krát" },
    percent: ["procento", "procenta", "procent"],
    currency: { "€": ["euro", "eura", "eur"], "$": ["dolar", "dolary", "dolarů"], "£": ["libra", "libry", "liber"] },
    units: { km: ["kilometr", "kilometry", "kilometrů"], m: ["metr", "metry", "metrů"],
        cm: ["centimetr", "centimetry", "centimetrů"], mm: ["milimetr", "milimetry", "milimetrů"],
        kg: ["kilogram", "kilogramy", "kilogramů"] },
    exponentWords: {
        squared: ["čtvereční", "čtvereční", "čtverečních"],
        cubed: ["krychlový", "krychlové", "krychlových"],
        position: "before",
    },
    unitPer: "za",
    rateDenominators: { h: "hodinu", s: "sekundu" },
    countForm: csCountForm,
});

class CzechPhonemizer implements Phonemizer {
    text(input: string): string {
        // #562 order: Czech rewrites (grouping, abbreviations, ordinals, clock, dates, ranges, signs) →
        // INITIALISMS (after abbreviations, so `Co.` is not spelled CEE-OH) → the shared symbol tier last
        // (it needs the number still adjacent to its unit/sign). Roman numerals arrive already converted
        // at the registry seam, so the regnal rule (normalize.ts step 12) sees digits after proper names.
        const normalized = SYMBOLS(normalizeCzechInitialisms(normalizeCzech(input)));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                if (frac !== undefined && frac.length === 3) {
                    // "19,500" is 19500 — a grouped thousand, read as one number.
                    for (const wd of numberToWords(Number(`${intPart}${frac}`)).split(" "))
                        sink.emit(phonemizeWord(wd));
                } else {
                    for (const wd of numberToWords(Number(intPart)).split(" "))
                        sink.emit(phonemizeWord(wd));
                    if (frac !== undefined) {
                        sink.emit(phonemizeWord("čárka")); // the Czech name of the decimal comma
                        for (const d of frac)
                            for (const wd of numberToWords(Number(d)).split(" "))
                                sink.emit(phonemizeWord(wd));
                    }
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}
export function createCzech(): Phonemizer {
    return new CzechPhonemizer();
}
