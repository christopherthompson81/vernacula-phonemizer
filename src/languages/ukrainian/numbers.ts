/**
 * EAST-SLAVIC (uk, be) cardinal composition with MAGNITUDE-NOUN AGREEMENT.
 *
 * WHY this exists instead of `core/numbers.ts`'s `westernNumberWords`: a magnitude word is a NOUN with its own
 * gender and its own count-form paradigm, and the multiplier in front of it must agree with THAT noun. The shared
 * Western composer stores one string per magnitude and concatenates, so it emitted *два тисяча / п'ять тисяча
 * (uk) and *два тысяча (be) — a plain grammatical error, not a citation-form choice. Ukrainian тисяча and
 * Belarusian тысяча are FEMININE, so the multiplier's 1/2 must be одна/дві (be адна/дзве), and the noun itself
 * inflects: nom.sg after a count ending in 1, nom.pl after 2–4, gen.pl otherwise.
 *
 * The agreement GRAMMAR is identical in Ukrainian and Belarusian (and in Russian — see russian/numbers.ts, which
 * solves the same problem for its own data), so the compositor is parameterised by the number-word table and
 * Belarusian imports it (the croatian←serbian pattern). The count-form selector is the SHARED
 * `slavicCountForm` from core/normalizeSymbols.ts: 1→nom.sg, 2–4→nom.pl, else gen.pl, with 11–14 always gen.pl.
 * That selector IS correct for uk/be (unlike Polish, where a compound ending in *jeden* takes the genitive
 * plural) — 21 тисяча / 22 тисячі / 25 тисяч / 12 тисяч.
 *
 * SOURCES for every form added here:
 *  - тисяча (uk): FEMININE; nom.pl тисячі, gen.pl тисяч — en.wiktionary.org/wiki/тисяча#Ukrainian
 *  - тысяча (be): FEMININE; nom.pl тысячы, gen.pl тысяч — en.wiktionary.org/wiki/тысяча#Belarusian
 *  - мільйон (uk): masc. inan.; nom.pl мільйони, gen.pl мільйонів — en.wiktionary.org/wiki/мільйон#Ukrainian
 *  - мільён (be): masc. inan.; nom.pl мільёны, gen.pl мільёнаў — en.wiktionary.org/wiki/мільён#Belarusian
 *  - мільярд: masc.; uk nom.pl мільярди / gen.pl мільярдів, be nom.pl мільярды / gen.pl мільярдаў
 *    — en.wiktionary.org/wiki/мільярд (both language sections)
 *  - feminine "one"/"two": uk одна / дві (одна = fem of один, дві = fem of два) — en.wiktionary.org/wiki/один,
 *    en.wiktionary.org/wiki/два#Ukrainian; be адна / дзве — en.wiktionary.org/wiki/адзін,
 *    en.wiktionary.org/wiki/два#Belarusian
 *
 * A bare 1000 stays the bare magnitude word (тисяча / тысяча, like the bare hundred сто) — pre-existing
 * behaviour, and the natural counting form; million/billion keep the multiplier (один мільйон).
 */
import { westernNumberWords, type NumberComposer, type NumbersDef } from "../../core/numbers.ts";
import { slavicCountForm } from "../../core/normalizeSymbols.ts";

/** A magnitude noun's three count forms, in `slavicCountForm` index order: nom.sg, nom.pl (2–4), gen.pl. */
export interface MagnitudeForms {
    /** nom.pl — the form after a count ending in 2–4 (дві тисячі, два мільйони). */
    few: string;
    /** gen.pl — the form after 5+, 11–14, and 0 (п'ять тисяч, п'ять мільйонів). */
    many: string;
}

/** The East-Slavic number data: the Western/Slavic base table plus the magnitude count forms and the
 *  feminine 1/2 that the feminine тисяча/тысяча demands. */
export interface EastSlavicNumbers extends NumbersDef {
    magnitudeCounts: {
        thousand: MagnitudeForms;
        million: MagnitudeForms;
        billion: MagnitudeForms;
    };
    /** Feminine nominative of 1 and 2 — required before тисяча/тысяча. */
    feminine: { one: string; two: string };
}

/** Pick the magnitude noun's form for `count` (nom.sg / nom.pl / gen.pl) via the shared Slavic selector. */
function magnitude(count: number, sg: string, forms: MagnitudeForms): string {
    return [sg, forms.few, forms.many][slavicCountForm(count)]!;
}

/**
 * One magnitude group: the multiplier words followed by the agreeing magnitude noun. `feminine` feminises the
 * multiplier's FINAL word (один→одна, два→дві) — the noun's gender governs it, so this is internal to the
 * number. `omitOne` drops a multiplier of exactly 1 (тисяча, not *одна тисяча).
 */
function group(
    count: number,
    d: EastSlavicNumbers,
    sg: string,
    forms: MagnitudeForms,
    opts: { feminine?: boolean; omitOne?: boolean } = {},
): string[] {
    const noun = magnitude(count, sg, forms);
    if (count === 1 && opts.omitOne) return [noun];
    // Recurse through the AGREEING composer (not the shared Western one) so a >999 group — reachable only above
    // 10¹², where the billions multiplier itself contains a thousands group — keeps its agreement too.
    const words = eastSlavicNumberWords(count, d).map((w) => w ?? "?");
    if (opts.feminine) {
        // Only the UNITS slot is gender-marked, and it is always the last word (двадцять один → двадцять одна).
        // Compare against the table's own masculine 1/2 rather than a literal, so this works for both languages.
        const i = words.length - 1;
        if (words[i] === d.units[1]) words[i] = d.feminine.one;
        else if (words[i] === d.units[2]) words[i] = d.feminine.two;
    }
    return [...words, noun];
}

/**
 * EAST-SLAVIC (uk, be) composition: units/teens/tens/hundreds as in the shared Western composer, but each
 * magnitude group carries agreement (gender + count) with its magnitude noun.
 */
export const eastSlavicNumberWords: NumberComposer = (n, def) => {
    const d = def as EastSlavicNumbers;
    const M = d.magnitudeCounts;
    if (n < 1000) return westernNumberWords(n, d);
    const parts: (string | null)[] = [];
    const bil = Math.floor(n / 1_000_000_000),
        mil = Math.floor((n % 1_000_000_000) / 1_000_000),
        th = Math.floor((n % 1_000_000) / 1000),
        r = n % 1000;
    if (bil) parts.push(...group(bil, d, d.magnitudes.billion!, M.billion));
    if (mil) parts.push(...group(mil, d, d.magnitudes.million!, M.million));
    // тисяча / тысяча is FEMININE → одна/дві (адна/дзве); a bare 1000 is the noun alone.
    if (th) parts.push(...group(th, d, d.magnitudes.thousand, M.thousand, { feminine: true, omitOne: true }));
    if (r) parts.push(...westernNumberWords(r, d));
    return parts;
};
