/**
 * French (fr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * This mirrors the shape of english/normalize.ts: one ordered pipeline of numbered steps, where the
 * order is itself load-bearing. The contract, as everywhere in the fleet: emit plain French words and
 * bare digits, and let the tokenizer / lexicon / g2p / number compositor do the pronouncing.
 *
 * WHY THE ORDER IS WHAT IT IS — the couplings that bite:
 *   · Abbreviations run before initialisms, or `MM.` (Messieurs) is letter-spelled as EM-EM.
 *   · Roman numerals run before initialisms, or `Louis XIV` is letter-spelled as IXE-I-VÉ. Both are
 *     all-caps letter runs; only the numeral rule can tell them apart, so it gets first refusal.
 *   · Times run before units, or a unit rule for `h` eats the hour of `11 h 20` and leaves `20`.
 *   · `av. J.-C.` runs before the generic `av.` → avenue, since every instance in the corpus is the
 *     era marker, not a street.
 *   · Thousands-degrouping runs first so every later step sees one unbroken digit run.
 *
 * Dates and years need less than one might expect: French reads a year as a plain cardinal
 * (1988 = mille neuf cent quatre-vingt-huit), so there is no pair-wise year rule of the English
 * "nineteen eighty-eight" kind, and a day is a plain cardinal too (17 septembre). The only irregular
 * day is the 1st, which is an ordinal (1er janvier = premier janvier).
 *
 * FEMININE AGREEMENT is the trap in times: heure and minute are feminine, so 1 and any number ending in
 * 1 take *une*, not *un* — `1 h 15` is "une heure quinze" and `4:41` is "quatre heures quarante et une".
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";
import { ordinal } from "./ordinals.ts";

/** Space characters used as digit-group separators in French typography: regular, NBSP, narrow NBSP,
 *  thin space. The FLEURS transcripts use NBSP (`5 000`, `9 h 30`, `n° 11`). */
const GROUP_SPACE = "    ";

/** Months, for the date rules. */
const MONTHS = "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre";

/**
 * Dotted abbreviations → the spoken words. Keyed lowercase; the corpus is lowercased throughout, so
 * these must not depend on capitalization. Each was checked against its corpus context: `m.` is
 * Monsieur (m. reid, m. hu, m. costello), `st.` is Saint (st. louis), `dr.` is docteur (le dr. damadian),
 * `av.` is the era marker in every instance (see AV_JC below, which claims those first).
 */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    m: "monsieur", mm: "messieurs", mme: "madame", mmes: "mesdames",
    mlle: "mademoiselle", mlles: "mesdemoiselles",
    dr: "docteur", pr: "professeur", st: "saint", ste: "sainte", sts: "saints", stes: "saintes",
    cf: "confer", ex: "exemple", env: "environ",
    p: "page", pp: "pages", art: "article", vol: "volume", chap: "chapitre",
    éd: "édition", av: "avenue", bd: "boulevard", bld: "boulevard", jr: "junior",
    tél: "téléphone",
};

/**
 * Abbreviations Lexique ALREADY pronounces as a token (etc → [ɛtseteʁa], mme → [madam]). These only need
 * the dot removed so it cannot become a phrase break; expanding them was a regression — spelling out
 * "et cetera" made the g2p read *cetera* with a schwa, [e sətəʁa] instead of Lexique's [ɛtseteʁa].
 */
const DOT_ONLY: ReadonlySet<string> = new Set(["etc", "mme", "mmes", "mlle", "mlles"]);

/** Undotted abbreviations. French normally writes these bare (le Dr Martin, Mme Curie); `dr`/`pr` are not
 *  French words, so expanding them unconditionally is safe. */
const UNDOTTED_ABBREV: Readonly<Record<string, string>> = { dr: "docteur", pr: "professeur" };

/**
 * Acronyms pronounced as WORDS rather than spelled out, where CONVENTION overrides phonotactics: each of
 * these is perfectly readable AND lexicalized, so it must not be spelled out. Lexique carries only a
 * couple of them (sida, ovni) and knows nothing of onu/otan/unesco.
 */
const WORD_ACRONYMS: ReadonlySet<string> = new Set([
    "onu", "otan", "unesco", "unicef", "smic", "sida", "ovni", "insee", "ena", "capes", "cedex",
    "pacs", "nasa", "fifa", "uefa", "opep", "afnor", "inserm", "erasmus", "acta", "covid",
]);

/** French letter names, for initialisms. Verified individually through this engine: bé=[be], cé=[se],
 *  effe=[ɛf], ache=[aʃ], ku=[ky], esse=[ɛs] (NOT "èse", which voices to [ɛz]), ixe=[iks], zède=[zɛd].
 *  `w` and `y` are genuinely two words in French (double vé, i grec). */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "bé", c: "cé", d: "dé", e: "e", f: "effe", g: "gé", h: "ache", i: "i",
    j: "ji", k: "ka", l: "elle", m: "emme", n: "enne", o: "o", p: "pé", q: "ku",
    r: "erre", s: "esse", t: "té", u: "u", v: "vé", w: "double vé", x: "ixe",
    y: "i grec", z: "zède",
};

/**
 * All-caps sequences that are read LETTER BY LETTER even though their lowercase form is an attested
 * French word, so the lexicon veto below would otherwise read them as that word. `usa` is the passé
 * simple of *user*, `pis`/`ps` and `bd` are words too — the initialism is what is meant in running text.
 */
const FORCE_LETTERS: ReadonlySet<string> = new Set([
    "usa", "cd", "dvd", "bd", "ps", "pib", "rer", "vtt", "qg", "jo", "ir", "as", "pc", "id", "ong",
]);

/**
 * French phonotactics, for the readability guard in core/initialisms.ts. Legal onsets are obstruent +
 * liquid plus the s-/p- clusters and the digraphs standing for one sound; legal codas are broadly the
 * liquid- and nasal-final ones plus stop/fricative + s (the shape of a written plural, and of PACS
 * [paks]). What is NOT legal is the stop+stop / fricative+stop shape an initialism throws up: RATP /tp/,
 * EDF /df/, and the /tv/ onset of TVA.
 */
export const isUnreadableFrench = makeUnreadableTest({
    vowels: /[aeiouyàâäéèêëîïôöûüùœæ]/u,
    legalOnsets: new Set([
        "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "kl", "kr",
        "ch", "ph", "th", "gn", "qu", "sc", "sp", "st", "ps", "pn", "pt", "sm", "sn", "gu", "rh", "ct",
    ]),
    legalCodas: new Set([
        "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "ch", "gn",
        "st", "sc", "sk", "sp", "ct", "pt", "ft", "xt", "ss", "tt", "ll", "mm", "nn", "pp", "rr", "ff",
        "rt", "rd", "rs", "rc", "rl", "rm", "rn", "rp", "rb", "rg", "rf", "rv", "rq",
        "lt", "ld", "ls", "lc", "lm", "lp", "lb", "lf", "lk", "lv",
        "nt", "nd", "ns", "nc", "nk", "ng", "mp", "mb",
        "cs", "ks", "ts", "ps", "bs", "ds", "gs", "fs", "ms",
    ]),
});

/** Non-negative integer → words, with the final *un* feminized (heure/minute are feminine). */
function feminineWords(n: number): string {
    return numberToWords(n).replace(/(^|[-\s])un$/u, "$1une");
}

/** An hour/minute pair → "onze heures vingt" / "une heure" / "zéro heure trente". */
function timeWords(h: number, min: number | undefined): string {
    const hourWord = h === 1 ? "heure" : "heures";
    const head = `${feminineWords(h)} ${hourWord}`;
    return min === undefined || min === 0 ? head : `${head} ${feminineWords(min)}`;
}

/** Fraction denominators with a suppletive name; anything else uses the ordinal (1/5 = un cinquième). */
const DENOMINATOR: Readonly<Record<number, string>> = { 2: "demi", 3: "tiers", 4: "quart" };

function fractionWords(num: number, den: number): string | undefined {
    const base = DENOMINATOR[den] ?? ordinal(den);
    if (base === undefined || den < 2) return undefined;
    // *tiers* is invariable; the others take the plural s.
    const plural = num > 1 && !base.endsWith("s") ? `${base}s` : base;
    return `${numberToWords(num)} ${plural}`;
}

/** Longest first, so `mmes` is not matched as `mme` + a stray s. */
const ABBREV_ALT = [...Object.keys(DOTTED_ABBREV), ...DOT_ONLY].sort((a, b) => b.length - a.length).join("|");

/**
 * Normalize one French input string. Pure text→text.
 *
 * `isWord` is the Lexique membership test, passed in by french.ts (the lexicon lives there, and taking
 * it as a parameter keeps this module free of both an import cycle and mutable state). It decides
 * whether an all-caps run is an acronym to be read as a word or an initialism to be spelled out.
 */
export function normalizeFrench(input: string, isWord: (lower: string) => boolean): string {
    let s = input;

    // 0) DIGIT GROUPING: French groups thousands with a space (5 000 = five thousand). The tokenizer's
    //    number class does not span a space, so "5 000 ans" read as "cinq zéro ans" — two numbers, and
    //    the thousand lost. Degroup to one digit run, but ONLY for exact 3-digit blocks, or "30 9" would
    //    fuse two unrelated numbers.
    s = s.replace(new RegExp(`(\\d)[${GROUP_SPACE}](\\d{3})(?!\\d)`, "gu"), "$1$2");
    s = s.replace(new RegExp(`(\\d)[${GROUP_SPACE}](\\d{3})(?!\\d)`, "gu"), "$1$2"); // millions: 1 234 567
    //    Remaining non-breaking spaces become ordinary ones so every later pattern can use \s.
    s = s.replace(/[   ]/gu, " ");

    // 1) ERA MARKERS, before the generic `av.` → avenue: every "av." in the corpus is this.
    s = s.replace(/\bav(?:ant)?\.?\s*j\.?\s*-?\s*c\.?/giu, "avant Jésus-Christ");
    s = s.replace(/\bapr(?:ès)?\.?\s*j\.?\s*-?\s*c\.?/giu, "après Jésus-Christ");

    // 2) NUMÉRO: n° / nº before a number.
    s = s.replace(/\bn[°º]\s*(?=\d)/giu, "numéro ");

    // 3) DOTTED ABBREVIATIONS. The dot is CONSUMED when the sentence continues (a following word), so it
    //    cannot become a phrase break — the defect behind the reported English "St. James" pause. At a
    //    phrase end the dot stays, because there it really is the sentence end.
    s = s.replace(new RegExp(`\\b(${ABBREV_ALT})\\.(\\s+)(?=\\p{L})`, "giu"),
        (_m, ab: string, sp: string) => {
            const key = ab.toLowerCase();
            return DOT_ONLY.has(key) ? `${ab}${sp}` : `${DOTTED_ABBREV[key]!}${sp}`;
        });
    s = s.replace(new RegExp(`\\b(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (m0, ab: string) => (DOT_ONLY.has(ab.toLowerCase()) ? m0 : `${DOTTED_ABBREV[ab.toLowerCase()]!}.`));

    // 3b) UNDOTTED abbreviations, which is how French normally writes them (le Dr Martin).
    s = s.replace(/\b(dr|pr)\b\.?(?=\s+\p{L})/giu,
        (_m, ab: string) => UNDOTTED_ABBREV[ab.toLowerCase()]!);

    // 4) NAME INITIALS: a single letter + dot before a word is an initial, read as the LETTER NAME
    //    ("n. wayne hale" → "enne wayne hale"). Runs after step 3 so the honorifics (m., p.) win.
    s = s.replace(/\b([a-zà-ÿ])\.(\s+)(?=[\p{L}])/giu,
        (m0, ltr: string, sp: string) => {
            const name = LETTER_NAME[ltr.toLowerCase()];
            return name === undefined ? m0 : `${name}${sp}`;
        });

    // 5) NEGATIVES: a minus sign before a number is spoken. Requires a boundary before it so a hyphenated
    //    range or a score ("2-1", "1918-1939") is not turned into a subtraction.
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1moins $2");

    // 6) FRACTIONS. Guarded against a date (14/07/1789) and against a unit ratio (km/h) by requiring
    //    digits on both sides and nothing numeric after.
    s = s.replace(/\b(\d{1,3})\/(\d{1,3})\b(?!\s*\/?\d)/gu, (m0, a: string, b: string) =>
        fractionWords(Number(a), Number(b)) ?? m0);

    // 7) TIMES. The `h` form is the French standard (11 h 20, 20h30) and is what the corpus uses; the
    //    colon form also occurs. Both were losing the hour marker completely — "11 h 20" read as "onze
    //    vingt", and "4:41" turned the colon into a pause mark.
    s = s.replace(/\b([01]?\d|2[0-3])\s*[hH]\s*([0-5]\d)?(?![\p{L}\p{M}\d])/gu,
        (_m, h: string, min?: string) => timeWords(Number(h), min === undefined ? undefined : Number(min)));
    s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu,
        (_m, h: string, min: string) => timeWords(Number(h), Number(min)));

    // 8) DATES. A numeric date is day-first in French. Then a bare day 1 before a month name becomes the
    //    ordinal (1 janvier → premier janvier); every other day is a plain cardinal and already correct.
    s = s.replace(new RegExp(`\\b(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4})\\b`, "gu"),
        (m0, d: string, mo: string, y: string) => {
            const month = MONTHS.split("|")[Number(mo) - 1];
            if (month === undefined || Number(d) < 1 || Number(d) > 31) return m0;
            return `${Number(d) === 1 ? ordinal(1) : d} ${month} ${y}`;
        });
    s = s.replace(new RegExp(`\\b1\\s+(${MONTHS})\\b`, "giu"), (_m, mon: string) => `${ordinal(1)} ${mon}`);

    return s;
}

/**
 * INITIALISMS. A SEPARATE pass from `normalizeFrench` because of where it must sit in the order: Roman
 * numerals are all-caps letter runs too (`Louis XIV`), so the numeral rules get first refusal and this
 * claims only what they declined. The decision order and its measurement live in core/initialisms.ts.
 */
export function normalizeFrenchInitialisms(text: string, isWord: (lower: string) => boolean): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        forceLetters: FORCE_LETTERS,
        wordAcronyms: WORD_ACRONYMS,
        isWord,
        isUnreadable: isUnreadableFrench,
    })(text);
}
