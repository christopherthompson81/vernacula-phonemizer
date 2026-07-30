/**
 * German (de) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Twelfth language, and the one the ORDINAL work has been building towards. German writes the ordinal as a
 * numeral plus a bare PERIOD — `16. Jahrhundert`, `am 17. September` — which is the class Run 1 flagged as
 * needing a detector, because a regex cannot tell it from a sentence-final digit. It is the largest single
 * defect here (×100), and previously every one read as a cardinal followed by a PAUSE: "im 16. Jahrhundert"
 * came out as *sechzehn . Jahrhundert*.
 *
 * THE DETECTOR IS BUILT FROM THE CORPUS, not from intuition. Tabulating what surrounds `N.` over the 2,987
 * de_de utterances:
 *   AFTER   Jahrhundert(s) ×34, month names ×66, a few regiment names — and 79 instances with NOTHING
 *           after, which are the sentence-final periods that must NOT be claimed.
 *   BEFORE  am ×54, im ×14, des ×9, dem ×8, das ×7, zum ×5, vom ×2, bis ×2, ins ×1, den ×1.
 * So the rule fires on the FOLLOWING word (a month or Jahrhundert) — which alone covers ~100 of the 109 —
 * or on a preceding date/ordinal-licensing article plus a capitalised noun, which picks up the regiments.
 * A sentence-final `N.` matches neither, because nothing follows it and the word before is a content word.
 *
 * DECLENSION comes from the same evidence. The governing preposition or article decides the ending:
 * `am/im/vom/zum/dem/des/den/ins/seit/bis` take the weak **-en** (*am siebzehnten September*, *des
 * sechzehnten Jahrhunderts*), while `das/der/die` and a bare ordinal take **-e** (*das sechzehnte
 * Jahrhundert*). That is not full case agreement — it is the two forms the corpus actually needs.
 *
 * Measured over de_de (2,987 utterances): ordinals ×109, dates ×66, units ×60, dotted abbreviations ×58,
 * dot-thousands ×55, percent ×30, `Uhr` ×30, comma-decimals ×29, times ×23, `v. Chr.` ×11, all-caps ×222
 * (US ×30, USA ×14, AOL ×8), signs ×5.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const MONTHS = "Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
/** Nouns that follow an ordinal numeral. `Jahrunderts` is the corpus's own misspelling, kept so the rule
 *  still fires on it. */
const ORDINAL_NOUN = `${MONTHS}|Jahrhundert|Jahrhunderts|Jahrunderts|Jh`;
/** Articles and prepositions that license an ordinal reading, and which of the two endings they govern. */
const WEAK_EN = new Set(["am", "im", "vom", "zum", "beim", "dem", "des", "den", "ins", "seit", "bis", "ab", "nach", "vor", "zur"]);
const LICENSER = new Set([...WEAK_EN, "das", "der", "die", "ein", "eine", "sein", "ihr"]);

/**
 * Integer → the German ordinal STEM. Below 20 the stem is the cardinal plus -t, above it plus -st, with
 * four suppletive stems (erst, dritt, siebt, and acht which already ends in t).
 */
const IRREGULAR_STEM: Readonly<Record<number, string>> = { 1: "erst", 3: "dritt", 7: "siebt", 8: "acht" };
function ordinalStem(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    const irr = IRREGULAR_STEM[n];
    if (irr !== undefined) return irr;
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    return n < 20 ? `${card}t` : `${card}st`;
}

/** Dotted abbreviations → the spoken words. `bzw.` ×13 and `usw.` ×7 are the frequent ones, and both were
 *  read as a consonant cluster plus a phrase break. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    bzw: "beziehungsweise", usw: "und so weiter", ca: "circa", evtl: "eventuell", ggf: "gegebenenfalls",
    inkl: "inklusive", exkl: "exklusive", bzgl: "bezüglich", einschl: "einschließlich",
    dr: "Doktor", prof: "Professor", st: "Sankt", hr: "Herr", fr: "Frau", nr: "Nummer",
    mio: "Millionen", mrd: "Milliarden", jh: "Jahrhundert", bd: "Band", s: "Seite", vgl: "vergleiche",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** German letter names, for initialisms: USA is [uː ʔɛs ʔaː], not the word *usa*. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", c: "ze", d: "de", e: "e", f: "eff", g: "ge", h: "ha", i: "i", j: "jott",
    k: "ka", l: "ell", m: "emm", n: "enn", o: "o", p: "pe", q: "ku", r: "err", s: "ess", t: "te",
    u: "u", v: "vau", w: "we", x: "iks", y: "üpsilon", z: "zett", "ä": "ä", "ö": "ö", "ü": "ü",
};

/** German phonotactics, for the OOV rule in core/initialisms.ts. */
export const isUnreadableGerman = makeUnreadableTest({
    vowels: /[aeiouäöüy]/u,
    legalOnsets: new Set([
        "bl", "br", "ch", "dr", "fl", "fr", "gl", "gr", "kl", "kn", "kr", "pf", "pl", "pr", "ps",
        "qu", "sc", "sch", "sh", "sk", "sl", "sm", "sn", "sp", "st", "sw", "th", "tr", "tw", "vl", "vr", "zw",
    ]),
    legalCodas: new Set([
        "ch", "ck", "ft", "ht", "lb", "ld", "lf", "lk", "lm", "ln", "lp", "ls", "lt", "lz", "mm",
        "mp", "ms", "nd", "nf", "ng", "nk", "ns", "nt", "nz", "pf", "ps", "rb", "rd", "rf", "rg",
        "rk", "rl", "rm", "rn", "rp", "rs", "rt", "rz", "sch", "sk", "sp", "st", "ss", "tt", "tz", "ts", "ks",
    ]),
});

const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

/** German's lexicon is a stress/length correction table rather than a wordlist of attested forms, so it
 *  cannot serve as the "is this recorded" test. Acronyms are decided by the list plus the OOV rule. */
export function normalizeGermanInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded: () => false,
        isUnreadable: isUnreadableGerman,
    })(text);
}

/** Normalize one German input string. Pure text→text. */
export function normalizeGerman(input: string): string {
    let s = input;

    // 1) ERA and the multi-dot abbreviations, before the single-dot rule so their interior dots are not
    //    left behind as phrase breaks. `v. Chr.` ×11, `z. B.` ×11.
    s = s.replace(/\bv\.\s?Chr\./gu, "vor Christus");
    s = s.replace(/\bn\.\s?Chr\./gu, "nach Christus");
    s = s.replace(/\bz\.\s?B\./gu, "zum Beispiel");
    s = s.replace(/\bd\.\s?h\./gu, "das heißt");
    s = s.replace(/\bu\.\s?a\./gu, "unter anderem");
    s = s.replace(/\bu\.\s?Ä\./gu, "und Ähnliches");

    // 2) ORDINALS. See the file header for how the detector and the two endings were derived. One rule,
    //    two licensing conditions: the FOLLOWING word is a month or Jahrhundert (which alone covers ~100 of
    //    the 109 in the corpus), or the PRECEDING word is a date/ordinal-licensing article and a
    //    capitalised noun follows. A sentence-final "N." satisfies neither.
    const ORD = new RegExp(`(?:(\\p{L}+)(\\s+))?(\\d{1,4})\\.(?=\\s+(\\p{L}+))`, "gu");
    s = s.replace(ORD, (whole, prev: string | undefined, sp: string | undefined, digits: string, next: string) => {
        const licensed = new RegExp(`^(?:${ORDINAL_NOUN})$`, "u").test(next)
            || (prev !== undefined && LICENSER.has(prev.toLowerCase()) && /^\p{Lu}/u.test(next));
        if (!licensed) return whole;
        const stem = ordinalStem(Number(digits));
        if (stem === undefined) return whole;
        const ending = prev !== undefined && WEAK_EN.has(prev.toLowerCase()) ? "en" : "e";
        return `${prev ?? ""}${sp ?? ""}${stem}${ending}`;
    });

    // 3) DOTTED ABBREVIATIONS. The dot is consumed when the sentence continues so it cannot become a
    //    phrase break; at a phrase end it stays, because there it really is the sentence end.
    //    NOT AFTER ANOTHER INITIAL. `s.` is *Seite*, so `J. S. Bach` expanded to "J Seite Bach" — the
    //    single-letter entries in this table collide with personal initials, and contiguity is what tells
    //    them apart (core/initialisms.ts claims a run of two on the same reasoning). A lone `S. Bach` at a
    //    sentence start stays ambiguous and is left to the table, as before.
    //    The lookahead admits a DIGIT as well as a letter: `S. 42` and `Nr. 5` are the ordinary forms and
    //    neither matched before, so both leaked a raw letter plus a spurious pause.
    s = s.replace(new RegExp(`(?<!\\p{Lu}\\.[  ])\\b(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\d])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`\\b(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 4) CLOCK, before the number tokenizer sees the separator. Both written forms occur and both were
    //    broken: the colon became a PAUSE with a spurious "null", and the dot form was read as a DECIMAL
    //    ("11.00 Uhr" → *elf komma null null*). German says "elf Uhr", "acht Uhr sechsundvierzig".
    s = s.replace(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b(?!\.?\d)(\s*Uhr)?/gu,
        (_m, h: string, min: string, uhr?: string) => {
            const head = `${numberToWords(Number(h))}${uhr ?? " Uhr"}`;
            return Number(min) === 0 ? head : `${head} ${numberToWords(Number(min))}`;
        });

    // 5) UNITS the shared tier cannot express, and the degree signs.
    s = s.replace(/(\d)\s?km\/h\b/gu, "$1 Kilometer pro Stunde");
    s = s.replace(/(\d)\s?m\/s\b/gu, "$1 Meter pro Sekunde");
    s = s.replace(/(\d)\s?°\s?C\b/gu, "$1 Grad Celsius");
    s = s.replace(/(\d)\s?°\s?F\b/gu, "$1 Grad Fahrenheit");
    s = s.replace(/(\d)\s?°/gu, "$1 Grad");

    // 6) SIGNS.
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1minus $2");
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 plus $2");
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1plus $2");

    // 7) FRACTIONS. ½ is "ein halb"; the rest are the ordinal stem plus -el (ein Fünftel).
    s = s.replace(/\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])/gu, (m0, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (den === 2) return num === 1 ? "ein halb" : `${numberToWords(num)} halbe`;
        const stem = ordinalStem(den);
        return stem === undefined ? m0 : `${num === 1 ? "ein" : numberToWords(num)} ${stem}el`;
    });

    return s;
}

