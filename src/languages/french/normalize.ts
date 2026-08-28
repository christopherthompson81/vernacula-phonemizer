/**
 * French (fr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * One ordered pipeline of numbered steps, where ⚠ THE ORDER IS ITSELF LOAD-BEARING. The contract, as
 * everywhere in the fleet: emit plain French words and bare digits, and let the tokenizer / lexicon / g2p /
 * number compositor do the pronouncing.
 *
 * The couplings that bite:
 *   · Abbreviations run before initialisms, or `MM.` (Messieurs) is letter-spelled as EM-EM.
 *   · Roman numerals run before initialisms, or `Louis XIV` is letter-spelled as IXE-I-VÉ. Both are
 *     all-caps letter runs; only the numeral rule can tell them apart, so it gets first refusal.
 *   · Times run before units, or a unit rule for `h` eats the hour of `11 h 20` and leaves `20`.
 *   · `av. J.-C.` runs before the generic `av.` → avenue, since every instance in the corpus is the
 *     era marker, not a street.
 *   · Thousands-degrouping runs first so every later step sees one unbroken digit run.
 *
 * Dates and years need less than one might expect: French reads a year as a plain CARDINAL (1988 = mille
 * neuf cent quatre-vingt-huit), so there is no pair-wise year rule of the English "nineteen eighty-eight"
 * kind, and a day is a plain cardinal too. ⚠ The only irregular day is the 1st, an ordinal (1er janvier =
 * premier janvier).
 *
 * ⚠ FEMININE AGREEMENT IS THE TRAP IN TIMES: heure and minute are feminine, so 1 and any number ending in 1
 * take *une*, not *un* — `1 h 15` is "une heure quinze" and `4:41` is "quatre heures quarante et une".
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST as FR_MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { ordinal } from "./ordinals.ts";
import { rewrite } from "../../core/provenance.ts";

/** Space characters used as digit-group separators in French typography: regular, NBSP, narrow NBSP,
 *  thin space. The FLEURS transcripts use NBSP (`5 000`, `9 h 30`, `n° 11`). */
const GROUP_SPACE = "    ";

/** Currency sign → [singular, plural], for the money-with-centimes rule. Mirrors the SYMBOLS config in
 *  french.ts, which owns the plain (no-centimes) currency case. */
const CURRENCY_WORDS: Readonly<Record<string, [string, string]>> = {
    "€": ["euro", "euros"], $: ["dollar", "dollars"], "£": ["livre", "livres"], "¥": ["yen", "yens"],
};

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
 * French phonotactics, for the OOV rule in core/initialisms.ts. Legal onsets are obstruent + liquid plus
 * the s-/p- clusters and the digraphs standing for one sound; legal codas are broadly the liquid- and
 * nasal-final ones plus stop/fricative + s (the shape of a written plural, and of PACS [paks]). What is
 * NOT legal is the stop+stop / fricative+stop shape an initialism throws up: RATP /tp/, EDF /df/, and the
 * /tv/ onset of TVA.
 */
export const isUnreadableFrench = makeUnreadableTest({
    vowels: new RegExp(`[${FR_MANIFEST.phonotactics.vowels}]`, "u"),
    legalOnsets: new Set(FR_MANIFEST.phonotactics.onsets),
    legalCodas: new Set(FR_MANIFEST.phonotactics.codas),
});
/** LEXICAL: acronyms spelled out although their lowercase form is an attested French word. Authored in
 *  french.jsonc alongside the language's other hand-authored facts, not here. */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(FR_MANIFEST.acronymLetters);

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
    s = rewrite(s, new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)[${GROUP_SPACE}](?=\\d{3}(?!\\d))`, "gu"), "");
    s = rewrite(s, new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)[${GROUP_SPACE}](?=\\d{3}(?!\\d))`, "gu"), ""); // millions: 1 234 567
    //    Remaining non-breaking spaces become ordinary ones so every later pattern can use \s.
    s = rewrite(s, /[\u00a0\u202f\u2009]/gu, " ");

    // 1) ERA MARKERS, before the generic `av.` → avenue: every "av." in the corpus is this.
    s = rewrite(s, /\bav(?:ant)?\.?\s*j\.?\s*-?\s*c\.?/giu, "avant Jésus-Christ");
    s = rewrite(s, /\bapr(?:ès)?\.?\s*j\.?\s*-?\s*c\.?/giu, "après Jésus-Christ");

    // 1b) THE DEGREE SIGN, SPACED. French typography puts a space before `°C`, and the corpus writes
    //     `une chaleur de 32 ° C` — with blanks on BOTH sides of the sign. The tier reads the degree through
    //     its `"°c"` UNIT KEY, which needs the two characters adjacent, so the spaced form matched nothing and
    //     the whole `° C` was DROPPED: the sentence read "trente-deux" with no unit at all. Closed up here
    //     rather than by loosening the tier's key, because a key is a spelling and this is whitespace.
    //     Only between a DIGIT and the scale letter, so an ordinary `°` (bearings, `n°`) is untouched.
    s = rewrite(s, /(\d)\s*°\s*(?=[CF](?![\p{L}\p{M}]))/gui, "$1°");

    // 2) NUMÉRO: n° / nº before a number.
    s = rewrite(s, /\bn[°º]\s*(?=\d)/giu, "numéro ");

    // 3) DOTTED ABBREVIATIONS. The dot is CONSUMED when the sentence continues (a following word), so it
    //    cannot become a phrase break — the defect behind the reported English "St. James" pause. At a
    //    phrase end the dot stays, because there it really is the sentence end.
    s = rewrite(s, new RegExp(`\\b(${ABBREV_ALT})\\.(\\s+)(?=\\p{L})`, "giu"),
        (_m, ab: string, sp: string) => {
            const key = ab.toLowerCase();
            if (DOT_ONLY.has(key)) return `${ab}${sp}`;
            const w0 = DOTTED_ABBREV[key];   // ⚠ reachable miss (#1122)
            return w0 === undefined ? _m : `${w0}${sp}`;
        });
    s = rewrite(s, new RegExp(`\\b(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (m0, ab: string) => {
            if (DOT_ONLY.has(ab.toLowerCase())) return m0;
            const w0 = DOTTED_ABBREV[ab.toLowerCase()];
            return w0 === undefined ? m0 : `${w0}.`;
        });

    // 3b) UNDOTTED abbreviations, which is how French normally writes them (le Dr Martin).
    s = rewrite(s, /\b(dr|pr)\b\.?(?=\s+\p{L})/giu,
        (m0, ab: string) => UNDOTTED_ABBREV[ab.toLowerCase()] ?? m0);

    // 4) NAME INITIALS: a single letter + dot before a word is an initial, read as the LETTER NAME
    //    ("n. wayne hale" → "enne wayne hale"). Runs after step 3 so the honorifics (m., p.) win.
    s = rewrite(s, /\b([a-zà-ÿ])\.(\s+)(?=[\p{L}])/giu,
        (m0, ltr: string, sp: string) => {
            const name = FR_MANIFEST.letterNames[ltr.toLowerCase()];
            return name === undefined ? m0 : `${name}${sp}`;
        });

    // 4b) MONEY with centimes: "deux euros cinquante", not "deux virgule cinquante euro" — a decimal
    //     reading of a price is wrong in a way listeners notice. Runs before SYMBOLS, which owns the
    //     plain currency case. The symbol normally follows the amount in French; both orders are matched.
    s = rewrite(s, /(\d+),(\d{2})\s?([€$£¥])/gu, (_m, int: string, cents: string, sym: string) => {
        const [sg, pl] = CURRENCY_WORDS[sym]!;
        const unit = int === "1" ? sg : pl;
        return cents === "00" ? `${int} ${unit}` : `${int} ${unit} ${Number(cents)}`;
    });
    s = rewrite(s, /([€$£¥])\s?(\d+),(\d{2})/gu, (_m, sym: string, int: string, cents: string) => {
        const [sg, pl] = CURRENCY_WORDS[sym]!;
        const unit = int === "1" ? sg : pl;
        return cents === "00" ? `${int} ${unit}` : `${int} ${unit} ${Number(cents)}`;
    });

    // 4c) PLUS. The mirror of the negative rule below: a dropped sign is silent content loss, and "+5"
    //     read as "cinq" is as wrong as "-5" read as "cinq" was. Covers the attached form (utc+1).
    //     Emits the ordinary spelling `plus`; the HETERONYM map in french.jsonc supplies the [plys]
    //     operator reading, selected by the number that follows. This replaced a "plusse" respelling that
    //     existed only because Lexique carries just the [ply] "more" reading.
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = rewrite(s, /±/gu, " plus moins ");
    s = rewrite(s, /(\S)\+\s?(\d)/gu, "$1 plus $2");
    s = rewrite(s, /(^|\s)\+\s?(\d)/gu, "$1plus $2");

    // 5) NEGATIVES: a minus sign before a number is spoken. Requires a boundary before it so a hyphenated
    //    range or a score ("2-1", "1918-1939") is not turned into a subtraction.
    s = rewrite(s, /(^|[\s(])[-−–](\d)/gu, "$1moins $2");

    // 5b) RELATIONAL AND DIVISION SIGNS. ⚠ SEARCH FOR THE WORDS, NEVER FOR THE SIGN — the notation is
    //     absent from fr_fr (every `<` in the fleet is an HTML tag) while the vocabulary is ordinary prose.
    //
    //     ⚠ AND FRENCH INFLECTS, SO AN EXACT-FORM TOKEN COUNT UNDER-REPORTS THE LEMMA. Counted in fr_fr
    //     (4158 utterances) the citation forms look thin, and the substring column is where the word actually
    //     is — as inflection, not as a longer unrelated word:
    //
    //       `inférieur`   ×5 TOKEN                      — attested outright
    //       `supérieur`   ×0 token / ×18 SUBSTRING      — all `supérieure(s)`, the feminine/plural of the SAME
    //                                                     adjective, in 16 distinct utterances
    //       `divisé`      ×0 token / ×2 SUBSTRING       — `divisée`, `divisées`: same past participle
    //       `égal`        ×3 TOKEN / ×211 substring     ⚠ the 211 are `également` — see below
    //
    //     ⚠ `égale` IS THE SUBSTRING TRAP, AND IT IS THE SHARPEST INSTANCE YET: ×0 TOKEN / ×190 SUBSTRING, and
    //     every one of the 190 is inside `également` ("also"), a word with no arithmetic sense at all. A plain
    //     grep would have called it the best-attested of the four. That is the sixth time this error has been
    //     caught, and the first where the containing word means something entirely unrelated.
    //
    //     ⚠ THE READING IS QUOTED VERBATIM FROM THE CANONICAL SOURCE. The register tier
    //     (`attest.ts --context "mathématiques arithmétique division"`) put fr.wikipedia's Division article in
    //     the sample, and that article reads the whole expression aloud, both signs in one sentence, between
    //     two operands:
    //
    //       « a divisé par b est égal à c »
    //
    //     with the inequalities attested in the same register on numeric operands ("le plus grand multiple de 7
    //     inférieur à 93", "tout nombre pair strictement supérieur à 2").
    //
    //     ⚠ THE COPULA IS KEPT HERE, unlike de/es/en, and that is a fact about French rather than a change of
    //     policy. `sept égal à trois` is not a French construction — the adjective needs its verb — so the
    //     bare form those languages use has no French equivalent to drop to. `lb` (`ass gläich`) and `nb`
    //     (`er lik`) already ship the copular form, so the fleet has both shapes and this picks the one the
    //     language admits. `divisé par` is a participle and needs no verb ("3 564 divisé par 17").
    s = rewrite(s, /\s?=\s?/gu, " est égal à ");
    s = rewrite(s, /\s?<\s?/gu, " est inférieur à ");
    s = rewrite(s, /\s?>\s?/gu, " est supérieur à ");
    s = rewrite(s, /\s?÷\s?/gu, " divisé par ");

    // 6) FRACTIONS. Guarded against a date (14/07/1789) and against a unit ratio (km/h) by requiring
    //    digits on both sides and nothing numeric after.
    s = rewrite(s, /\b(\d{1,3})\/(\d{1,3})\b(?!\s*\/?\d)/gu, (m0, a: string, b: string) =>
        fractionWords(Number(a), Number(b)) ?? m0);

    // 7) TIMES. The `h` form is the French standard (11 h 20, 20h30) and is what the corpus uses; the
    //    colon form also occurs. Both were losing the hour marker completely — "11 h 20" read as "onze
    //    vingt", and "4:41" turned the colon into a pause mark.
    s = rewrite(s, /\b([01]?\d|2[0-3])\s*[hH]\s*([0-5]\d)?(?![\p{L}\p{M}\d])/gu,
        (_m, h: string, min?: string) => timeWords(Number(h), min === undefined ? undefined : Number(min)));
    //    ⚠ A FRACTIONAL PART MEANS IT IS NOT A TIME OF DAY, and the guard must reject it. `4:41.20` is a
    //    race time — minutes, seconds, hundredths — and without this the clock rule claimed it and asserted
    //    an hour on a four-minute race: *quatre HEURES quarante-et-un*, with the `.20` left over as a stray
    //    pause. The corpus carries one such sentence (a Paralympic result, translated into 45 languages),
    //    so the footprint is small and the reading is flatly wrong. ⚠ THIS DECLINES, IT DOES NOT READ:
    //    a proper duration reading needs its own per-language sourcing, and inventing one would score well
    //    while staying wrong — see the trap documented in tools/corpus/numeral_register.mts. German uses
    //    the same `(?!\.?\d)` shape; a clock at the end of a sentence (`à 4:41.`) still matches.
    s = rewrite(s, /\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!\.\d)/gu,
        (_m, h: string, min: string) => timeWords(Number(h), Number(min)));

    // 8) DATES. A numeric date is day-first in French. Then a bare day 1 before a month name becomes the
    //    ordinal (1 janvier → premier janvier); every other day is a plain cardinal and already correct.
    s = rewrite(s, new RegExp(`\\b(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4})\\b`, "gu"),
        (m0, d: string, mo: string, y: string) => {
            const month = MONTHS.split("|")[Number(mo) - 1];
            if (month === undefined || Number(d) < 1 || Number(d) > 31) return m0;
            return `${Number(d) === 1 ? ordinal(1) : d} ${month} ${y}`;
        });
    s = rewrite(s, new RegExp(`\\b1\\s+(${MONTHS})\\b`, "giu"), (_m, mon: string) => `${ordinal(1)} ${mon}`);

    return s;
}

/**
 * INITIALISMS. A SEPARATE pass from `normalizeFrench` because of where it must sit in the order: Roman
 * numerals are all-caps letter runs too (`Louis XIV`), so the numeral rules get first refusal and this
 * claims only what they declined. The decision order and its measurement live in core/initialisms.ts.
 */
export function normalizeFrenchInitialisms(text: string, isRecorded: (lower: string) => boolean): string {
    return makeInitialismNormalizer({
        letterName: (l) => FR_MANIFEST.letterNames[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded,
        isUnreadable: isUnreadableFrench,
    })(text);
}
