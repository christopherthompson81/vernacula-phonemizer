/**
 * Polish (pl) phonemizer — canonical IPA. Rule g2p (g2p.ts) + fixed PENULTIMATE stress
 * (the near-universal Polish pattern). text() tokenizes words / numbers / punctuation; numbers are
 * composed by numbers.ts (Slavic three-way magnitude agreement) and re-phonemized as Polish words.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { toSegments } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizePolish, normalizePolishInitialisms, plCountForm, UNITS } from "./normalize.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** One Polish word → canonical IPA with penultimate primary stress. */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nucIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    // stressed nucleus = penultimate (or the only one)
    const stressAt = nucIdx.length >= 2 ? nucIdx[nucIdx.length - 2]! : nucIdx[0] ?? -1;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressAt) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out.normalize("NFC");
}

/**
 * Shared SYMBOL tier — %, currency signs and unit abbreviations, matched only when a NUMBER is
 * adjacent, which is why it runs LAST and why the decimal comma is left in the text for it to see.
 *
 * `countForm` is Polish's own, not `slavicCountForm`: Polish sends a compound ending in 1 to the genitive
 * plural (dwadzieścia jeden procent) where Russian keeps the singular. See the note in normalize.ts.
 *
 * SOURCED: procent · procenty · procent (the genitive plural of procent is the bare stem); dolar/funt/jen
 * decline regularly, euro is indeclinable. Polish takes NO connective between a magnitude and the currency
 * noun ("pięć milionów dolarów"), so `magnitudeConnective` is deliberately omitted.
 */
const SYMBOLS = makeSymbolNormalizer({
    // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
    // `i` ×846 in this corpus. The tier spaces it on both sides, because `B&B` is two
    // initialisms and joining them would make one token.
    // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
    // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
    // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
    // One word, so `by` defaults to it; this language does not split dimension from product.
    multiply: { times: "razy" },
    ampersand: "i",
    percent: ["procent", "procenty", "procent", "procenta"],
    currency: {
        "$": ["dolar", "dolary", "dolarów", "dolara"],
        "€": ["euro"],
        "£": ["funt", "funty", "funtów", "funta"],
        "¥": ["jen", "jeny", "jenów", "jena"],
        // Polish's own currency, which could not be declared while the tier keyed currencies as single
        // characters — the Polish run reported exactly this gap and had to omit złoty.
        "zł": ["złoty", "złote", "złotych", "złotego"],
        "PLN": ["złoty", "złote", "złotych", "złotego"],
    },
    magnitudes: ["tysiąca", "tysięcy", "miliona", "milionów", "miliarda", "miliardów"],
    units: UNITS,
    // MIGRATION TEST: km²/mm² composed by the shared tier. The adjective agrees, so it carries the
    // same three count forms the unit nouns do.
    exponentWords: {
        squared: ["kwadratowy", "kwadratowe", "kwadratowych", "kwadratowego"],
        cubed: ["sześcienny", "sześcienne", "sześciennych", "sześciennego"],
    },
    countForm: plCountForm,
});

// The number token carries its DECIMAL COMMA (Polish's decimal mark) so the comma is not read as clause
// punctuation — `14,7` was coming out as a phrase break between "czternaście" and "siedem".
/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_CLASS = "[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]";
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions.
 */
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+(?:,\\d+)?)|([.?!,;:])`, "gu");

class PolishPhonemizer implements Phonemizer {
    text(input: string): string {
        // order: Polish rewrites (grouping, abbreviations, ordinals, clock, ranges, signs) →
        // INITIALISMS (after abbreviations, so `m.in.` is not spelled EM-EN) → the shared symbol tier last
        // (it needs the number still adjacent to its unit/sign). Roman numerals arrive already converted
        // at the registry seam, so the roman-vs-initialism hazard cannot arise here.
        const normalized = SYMBOLS(normalizePolishInitialisms(normalizePolish(input)));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                for (const wd of numberToWords(Number(intPart)).split(" "))
                    sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord(MANIFEST.decimalWord)); // the Polish name of the decimal comma
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

/** Build the Polish phonemizer. */
export function createPolish(): Phonemizer {
    return new PolishPhonemizer();
}
