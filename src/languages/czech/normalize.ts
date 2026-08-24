/**
 * Czech (cs) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE `N.` ORDINAL NOTATION IS THE DOMINANT PATTERN, and it collides with the sentence break: `v 16. století`
 * reads as a CARDINAL plus a spurious phrase break, [v ʃɛstnaːt͡st . stolɛt͡siː]. See step 8.
 *
 * ⚠ COUNT AGREEMENT IS THREE-WAY (1 hodina / 2–4 hodiny / 5+ hodin), keyed on the numeral's final digits like
 * the other Slavic engines — but NOT on Russian's `slavicCountForm`. A compound ending in 1 is *dvacet jedna
 * hodin* (genitive plural), never the singular *dvacet jedna hodina*, so `csCountForm` below is the
 * Polish-style selector. That ending-in-1 case is the selectors' only divergence.
 *
 * ⚠ CASE IS THE STANDING LIMITATION. Czech ordinals inflect for case, and the surrounding case is not
 * recoverable from a number alone. Where the FOLLOWING WORD is unambiguous (století → genitive, and locative
 * after an adjacent v/ve; let/letech → genitive/locative plural; místě → locative; month names → genitive;
 * červenci → dative; hodině → locative) the rule reads it and inflects; elsewhere it emits the masculine
 * nominative. Same trade romanOrdinals.ts documents: the right lexeme with the wrong ending beats the wrong
 * word entirely.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

/** Regular, NBSP and narrow-NBSP — all three occur as thousands separators. */
const GROUP_SPACE = " \\u00a0\\u202f\\u2009";

/**
 * Czech count-form selector for the LOCAL rules below and for czech.ts's shared symbol tier. Same final-digit
 * shape as Polish's: 1 → 0 (sg), 2–4 → 1 (paucal, but never 12–14), else 2 (genitive plural). ⚠ The divergence
 * from `slavicCountForm` is only the ending-in-1 compound — see the header.
 */
export const csCountForm = (n: number): number => {
    if (n === 1) return 0;
    const m100 = Math.abs(n) % 100;
    if (m100 >= 12 && m100 <= 14) return 2;
    const m10 = m100 % 10;
    return m10 >= 2 && m10 <= 4 ? 1 : 2;
};

/** Pick the count form of a counted noun written [sg, paucal, gen-pl]. */
function counted(n: number, forms: readonly string[]): string {
    return forms[Math.min(csCountForm(n), forms.length - 1)]!;
}

/**
 * Adjectival case forms of a masculine-nominative ordinal (první, druhý, třetí, dvacátý …). Regular adjectival
 * declension: hard stems in -ý take -ého/-ém/-ým/-ých/-é/-á/-ému, and the two soft stems in the 1–3 range
 * (první, třetí) take the -i- forms.
 * ⚠ EVERY ELEMENT OF A COMPOUND INFLECTS, not just the tail: sto dvacátý pátý → ve stu dvacátém pátém.
 */
type OrdCase = "gen" | "loc" | "instr" | "plGen" | "neutNom" | "fem" | "dat";
function inflectOrdinal(masc: string, c: OrdCase): string {
    return masc.split(" ").map((w) => {
        if (w.endsWith("í")) {
            const stem = w.slice(0, -1); // první/třetí keep the soft -i- (prvního, prvnímu)
            return stem + { gen: "ího", loc: "ím", instr: "ím", plGen: "ích", neutNom: "í", fem: "í", dat: "ímu" }[c];
        }
        const stem = w.replace(/ý$/u, ""); // druhý → druh|ý
        return stem + { gen: "ého", loc: "ém", instr: "ým", plGen: "ých", neutNom: "é", fem: "á", dat: "ému" }[c];
    }).join(" ");
}

/** Czech letter names, for the initialism pass — USA is [ú es á], DVD [dé vé dé]. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "á", b: "bé", c: "cé", č: "čé", d: "dé", e: "é", f: "ef", g: "gé", h: "há", i: "í",
    j: "jé", k: "ká", l: "el", m: "em", n: "en", o: "ó", p: "pé", q: "kvé", r: "er", ř: "eř",
    s: "es", š: "eš", t: "té", u: "ú", v: "vé", w: "dvojité vé", x: "iks", y: "ypsilon",
    z: "zet", ž: "žet",
};

/** Czech phonotactics, for the OOV rule in core/initialisms.ts. ⚠ Czech tolerates heavy clusters, so the
 *  onset/coda sets are generous ON PURPOSE — the work is done by the no-vowel test (GPS, DVD, GMT, TV) and the
 *  run/onset tests (DSLR, QVC, USGS), not by cluster policing. */
export const isUnreadableCzech = makeUnreadableTest({
    vowels: /[aeiouyáéíóúůýrl]/u,
    legalOnsets: new Set([
        "bl", "br", "bz", "čt", "čv", "čl", "čm", "čn", "čr", "dl", "dr", "dv", "gl", "gr", "gn",
        "kl", "kn", "kr", "kv", "ml", "mn", "mr", "pl", "pn", "pr", "ps", "pt", "rv", "sk", "sl",
        "sm", "sn", "sp", "st", "sv", "sw", "šk", "šl", "šm", "šn", "šp", "št", "šv", "tl", "tr", "tv",
        "vz", "vl", "vn", "vr", "zl", "zn", "zv", "žl", "žn",
        "js", "kd", "zd", "dn", "hr", "lz", "kt", "zh", "jd", "hm", "zb", "zk", "hl", "tm", "km",
    ]),
    legalCodas: new Set([
        "rk", "rt", "rd", "rb", "rs", "rn", "rl", "rm", "rv", "rž", "št", "st", "sk", "zd", "zl",
        "zn", "zm", "čt", "ck", "ct", "dn", "tn",
        "ch", "dl", "tl", "ng", "ns", "sm", "dm", "kt",
    ]),
    // ONE phoneme each — see PhonotacticsData.digraphs.
    digraphs: new Set(["ch", "dž", "dz", "ct"]),
});

/** LEXICAL: acronyms Czech spells out although the letters could be read as a word. Authored in czech.jsonc
 *  beside the language's other hand-authored facts. ⚠ A token with NO vowel letter (DVD, GPS, TV, GMT) needs
 *  no entry — the OOV rule letter-spells it automatically. */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

/**
 * Initialism pass. ORDERING: must run AFTER the abbreviation rules below (`Co.`/`Inc.` must not become
 * SEE-OH/INSEE) and after the regnal rule, whose ordinals are already words by then. Czech has no
 * pronunciation dictionary (its g2p is rule-based), so `isRecorded` is always false, as in Russian.
 */
export function normalizeCzechInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded: () => false,
        isUnreadable: isUnreadableCzech,
    })(text);
}

/** Multi-dot abbreviations — the ERA markers. ⚠ Claimed FIRST, or their interior dots
 *  survive as breaks. The final dot is optional in the corpus (př.n.l appears bare before `!`), and is
 *  re-attached by keepFinal when it was doing duty as the sentence period. */
const MULTI_DOT: ReadonlyArray<readonly [RegExp, string]> = [
    [/(?<![\p{L}\p{M}])př\.\s?n\.\s?l\.?(?!\p{L})/giu, "před naším letopočtem"],
    [/(?<![\p{L}\p{M}])n\.\s?l\.?(?!\p{L})/giu, "našeho letopočtu"],
];

/**
 * Single-dot abbreviations → their expansion. SOURCE: the standard Czech abbreviation inventory (Pravidla
 * českého pravopisu / internetová jazyková příručka): tzv. = takzvaný, např. = například, atd. = a tak
 * dále, apod. = a podobně, aj. = a jiné, tzn. = to znamená, tj. = to jest, Dr. = doktor, Jr. = junior,
 * Sv./St. = svatý, Co./Inc. = společnost, mil. = milionů, s. = strana.
 *
 * `tzv.` is emitted in the masculine-nominative citation form; it is an adjective and agrees with its
 * head ("tzv. spamu" wants *takzvaného*). Accepted per the case limitation in the file header.
 */
const DOTTED: Readonly<Record<string, string>> = {
    tzv: "takzvaný", např: "například", atd: "a tak dále", apod: "a podobně",
    aj: "a jiné", tzn: "to znamená", tj: "to jest",
    dr: "doktor", jr: "junior", sv: "svatý", st: "svatý",
    co: "společnost", inc: "společnost", mil: "milionů", s: "strana",
    cca: "cirka",  // corpus: `rychlosti cca 83 km/h`; read as the cluster [t͡st͡sˈa] before this
};
const DOTTED_ALT = Object.keys(DOTTED).sort((a, b) => b.length - a.length).join("|");

const HOUR: readonly string[] = ["hodina", "hodiny", "hodin"];

/**
 * A numeral agreeing with a FEMININE counted noun. Czech marks gender on 1 and 2 only — jeden vs jedna,
 * dva vs dvě — and both clock nouns are feminine, so the composer's masculine citation form was wrong on
 * every such hour: `1:15 ráno`, the corpus's own instance, read "jeden hodina patnáct minut". The suffix
 * form is what changes, so a compound is handled by the same replacement (dvacet jeden → dvacet jedna).
 */
const feminine = (words: string): string => words.replace(/jeden$/u, "jedna").replace(/dva$/u, "dvě");
const MINUTE: readonly string[] = ["minuta", "minuty", "minut"];
const DEGREE: readonly string[] = ["stupeň", "stupně", "stupňů"];

/**
 * Re-attach a sentence period that an abbreviation's dot was doing double duty for. `rest` is the tail of
 * a `String.replace` callback's arguments (…groups, offset, wholeString), so the check works for any arity.
 */
function keepFinal(expansion: string, matched: string, rest: readonly unknown[]): string {
    const whole = rest[rest.length - 1];
    const offset = rest[rest.length - 2];
    if (typeof whole !== "string" || typeof offset !== "number") return expansion;
    return /^[\s»)”"']*$/u.test(whole.slice(offset + matched.length)) ? `${expansion}.` : expansion;
}

/** Masculine-nominative ordinal for 1–999, or undefined out of range. */
function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 999) return undefined;
    if (n < 20) return ORD_1_19[n]!;
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return ORD_TENS[t]! + (u ? ` ${ORD_1_19[u]!}` : "");
    }
    const h = Math.floor(n / 100), r = n % 100;
    return ORD_HUNDREDS[h]! + (r ? ` ${ordinal(r)}` : "");
}
const ORD_1_19 = [
    "", "první", "druhý", "třetí", "čtvrtý", "pátý", "šestý", "sedmý", "osmý", "devátý",
    "desátý", "jedenáctý", "dvanáctý", "třináctý", "čtrnáctý", "patnáctý", "šestnáctý",
    "sedmnáctý", "osmnáctý", "devatenáctý",
];
const ORD_TENS = ["", "", "dvacátý", "třicátý", "čtyřicátý", "padesátý", "šedesátý", "sedmdesátý",
    "osmdesátý", "devadesátý"];
const ORD_HUNDREDS = ["", "stý", "dvoustý", "třístý", "čtyřstý", "pětistý", "šestistý", "sedmistý",
    "osmistý", "devítistý"];

/** The genitive (and the one dative) month-name forms the date rule reads. Sourced from the corpus's date
 *  instances; the full 12 + červenci (dative/locative, after `k 1. červenci`) is listed. */
const MONTH_RULE: Readonly<Record<string, OrdCase>> = {
    ledna: "gen", února: "gen", března: "gen", dubna: "gen", května: "gen", června: "gen",
    července: "gen", srpna: "gen", září: "gen", října: "gen", listopadu: "gen", prosince: "gen",
    červenci: "dat",
};
const MONTH_ALT = Object.keys(MONTH_RULE).sort((a, b) => b.length - a.length).join("|");

/**
 * Normalize one Czech input string. Pure text→text; ordered, and each ordering coupling is stated.
 * Runs BEFORE the shared symbol tier (which needs the number still adjacent to its unit/sign).
 */
export function normalizeCzech(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, first (⚠ a grouping separator is otherwise read as clause
    //    punctuation, and the number token cannot span a space). Czech groups thousands with a SPACE and
    //    marks the decimal with a COMMA — verified against the corpus: 5 space-grouped numbers, 16
    //    comma-decimals. Two passes, because the groups overlap on the shared digit (3 850 000). The
    //    decimal comma itself is NOT rewritten here: it must stay adjacent to the number for the shared
    //    unit/percent tier to see it, so czech.ts's TOKEN swallows it and emits "čárka" (the Czech name of
    //    the decimal comma) between the parts.
    for (let i = 0; i < 2; i++)
        s = s.replace(new RegExp(`(\\d)[${GROUP_SPACE}](\\d{3})(?!\\d)`, "gu"), "$1$2");
    s = s.replace(new RegExp(`[${GROUP_SPACE}]`, "gu"), " ");

    // 1) MULTI-DOT ABBREVIATIONS (the era markers), before the single-dot rule —
    //    otherwise the interior dots survive as breaks and the letters read as a bogus word.
    //    Each expansion CONSUMES the abbreviation's final dot, so where that dot was also the sentence
    //    period it has to be put back — "…do roku 1000 př. n. l." ends the utterance, and eating the dot
    //    lost its sentence-final pause. `keepFinal` is applied to every dot-consuming rule below.
    for (const [re, w] of MULTI_DOT)
        s = s.replace(re, (m0: string, ...rest: unknown[]) => keepFinal(w, m0, rest));

    // 2) SINGLE-DOT ABBREVIATIONS. The dot is consumed so it cannot become a phrase break. Two shapes:
    //    followed by a word, and followed by another mark or end of clause (`apod.` at the end of a
    //    list), where the sentence period is kept. `s.` (strana) is matched only before a digit so the
    //    shape-1 lookahead alone decides it, exactly as the numeral shapes below keep their own guards.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}.])(${DOTTED_ALT})\\.(\\s+)(?=[\\p{L}\\d(„"])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}.])(${DOTTED_ALT})\\.(?=\\s*(?:[,;:!?»)”]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED[ab.toLowerCase()]!}.`);

    // 3) CLOCK. ⚠ Before any rule that looks for a bare number: `11:30` must not be
    //    claimed by the range or ordinal rules. The colon is clause punctuation in czech.jsonc, so every
    //    time in the corpus was previously split by a phrase break. Czech reads the time CARDINALLY with
    //    an explicit counted unit (8:46 = osm hodin čtyřicet šest minut), the corpus's own spelling of
    //    "8:46 hodin". `:00` drops the minutes, which is the idiomatic reading. Two digits are REQUIRED
    //    after the colon, and a comma-decimal is rejected — which is what keeps the rule off the corpus's
    //    sports times ("4:41,30", "2:11,60"), exactly as Polish's clock rule is.
    //    A trailing `h`/`hodin` is consumed: the corpus writes "9:30 h" and "8:46 hodin", and emitting the
    //    unit twice (*osm hodin … hodin*) is worse than the alternative. The governing preposition
    //    ("v 8:46", "ve 12:00") is left as its own word; inflecting the cardinal to agree is beyond what a
    //    number can tell us (case limitation in the header).
    s = s.replace(/([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!,\d)(?:\s+(?:h|hodin)(?![\p{L}\p{M}]))?/gu,
        (m0, h: string, min: string) => {
            const hv = Number(h), mv = Number(min);
            const head = `${feminine(numberToWords(hv))} ${counted(hv, HOUR)}`;
            return mv === 0 ? head : `${head} ${feminine(numberToWords(mv))} ${counted(mv, MINUTE)}`;
        });

    // 4) DATE `N. N.` — `24. 8. do 5. 9. 2021` (both halves claimed, read as genitive ordinals: "dvacátého
    //    čtvrtého osmého"). Before the version-dot rule, which would otherwise eat the interior dot of
    //    "5. 9." (a space separates date parts; version dots never do). Validated on day/month ranges so a
    //    bare "N. N." cannot be claimed spuriously.
    s = s.replace(/(?<![\p{L}\p{M}\d])(\d{1,2})\.\s+(\d{1,2})\.(?=\s*(?:do\b|\d{4}|[.,\p{Ll}]|$))/gu,
        (m0, d: string, mo: string) => {
            const dv = Number(d), mv = Number(mo);
            if (dv < 1 || dv > 31 || mv < 1 || mv > 12) return m0;
            return `${inflectOrdinal(ordinal(dv)!, "gen")} ${inflectOrdinal(ordinal(mv)!, "gen")} `;
        });

    // 5) VERSION / FIGURE DOTS between digits — `802.11n` ×3, `2.4Ghz`/`5.0Ghz` and the figure `1.1` were
    //    breaking the sentence at the interior dot. Before the ordinal rules so they never see a
    //    digit-dot-digit.
    s = s.replace(/(\d)\.(?=\d)/gu, "$1 tečka ");

    // 6) ORDINAL RANGE — `10.–11.` in "mezi 10.–11. a 14. stoletím" read as two cardinals plus a break.
    //    Read as "až" (through). Digits on BOTH sides carry the dots; the en dash is the corpus form.
    s = s.replace(/(?<![\p{L}\p{M}\d.])(\d+)\.\s*[–—-]\s*(\d+)\.(?![\d])/gu, (m0, a: string, b: string) => {
        const oa = ordinal(Number(a)), ob = ordinal(Number(b));
        if (oa === undefined || ob === undefined) return m0;
        return `${oa} až ${ob}`;
    });

    // 7) CENTURY — `N. + století`, the corpus's single largest ordinal context (×28). The noun's case is
    //    recoverable: an immediately-preceding v/ve governs the LOCATIVE (v 18. století → v osmnáctém
    //    století), every other preposition (do/ze/od/kolem/koncem/během …) takes the GENITIVE (do 15.
    //    století → do patnáctého století). The list shape covers the corpus's "11., 12. a 13. století".
    //    `stoletím` (instrumental, "mezi 10.–11. a 14. stoletím") is deliberately NOT matched — its number
    //    context is the general ordinal's business, which keeps that sentence's endings consistent.
    s = s.replace(/((?:\d+\.\s*)(?:,\s*\d+\.\s*)*(?:\s+a\s+\d+\.\s*)?)století(?![\p{L}\p{M}])/gu,
        (m0: string, list: string, offset: number, whole: string) => {
            const loc = /(?:v|ve)\s+$/iu.test(whole.slice(0, offset));
            const c: OrdCase = loc ? "loc" : "gen";
            return `${list.replace(/(\d+)\./gu, (_m, n: string) => inflectOrdinal(ordinal(Number(n))!, c))}století`;
        });

    // 8) DECADE — `N. + let/letech` (60. let, 70. let, 20./30./50./80. letech) governs the
    //    genitive/locative PLURAL (v 60. letech → v šedesátých letech). Before the general ordinal so
    //    the number is claimed here with the agreeing ending.
    s = s.replace(/(?<![\p{L}\p{M}\d.,])(\d+)\.\s+(let|letech)(?!\p{L})/gu,
        (_m, n: string, head: string) => `${inflectOrdinal(ordinal(Number(n))!, "plGen")} ${head}`);

    // 9) DATE MONTHS — `N. + month genitive` (21. července, 24. září, 17. září 2007 …). The month name is
    //    the case cue; červenci (after `k`) takes the dative. Before the general ordinal for the same
    //    reason as step 8.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}\\d.,])(\\d+)\\.\\s+(${MONTH_ALT})(?!\\p{L})`, "gu"),
        (_m, n: string, month: string) => `${inflectOrdinal(ordinal(Number(n))!, MONTH_RULE[month]!)} ${month}`);

    // 10) PLACE — `na 5. a 6. místě` (compound first), `na 13. místě` (locative) and `na 190. místo`
    //     (neuter accusative: na + acc). The `místo` form is the "place" sense in the corpus, not the
    //     homographic preposition.
    s = s.replace(/(?<![\p{L}\p{M}\d.,])(\d+)\.\s+a\s+(\d+)\.\s+místě/gu,
        (_m, a: string, b: string) =>
            `${inflectOrdinal(ordinal(Number(a))!, "loc")} a ${inflectOrdinal(ordinal(Number(b))!, "loc")} místě`);
    s = s.replace(/(?<![\p{L}\p{M}\d.,])(\d+)\.\s+místě(?!\p{L})/gu,
        (_m, n: string) => `${inflectOrdinal(ordinal(Number(n))!, "loc")} místě`);
    s = s.replace(/(?<![\p{L}\p{M}\d.,])(\d+)\.\s+místo(?!\p{L})/gu,
        (_m, n: string) => `${inflectOrdinal(ordinal(Number(n))!, "neutNom")} místo`);
    //    The one written-out hour ordinal, `po 11. hodině` → po jedenácté hodině (locative, feminine —
    //    the same -é/-í ending as the neuter, so neutNom supplies it).
    s = s.replace(/(?<![\p{L}\p{M}\d.,])(\d+)\.\s+(hodin\p{L}*)(?!\p{L})/gu,
        (_m, n: string, head: string) => `${inflectOrdinal(ordinal(Number(n))!, "neutNom")} ${head}`);

    // 11) GENERAL ORDINAL — derived by tabulating what surrounds `N.` in this corpus, NOT ported from
    //     another language's rule. The discriminator that fell out of the table: followed by a LOWERCASE
    //     word (or a comma) → ordinal, in the masculine nominative except where a step above claimed the
    //     agreeing form; followed by an UPPERCASE word or end of clause → sentence period (the corpus's
    //     "…lat 21. Cuddeback"-shaped traps do not occur, but the guard is what makes the rule safe).
    s = s.replace(/(?<![\p{L}\p{M}\d.,])(\d+)\.(?=\s*[,\p{Ll}])/gu,
        (m0, digits: string) => ordinal(Number(digits)) ?? m0);

    // 12) REGNAL ORDINALS. All three corpus Romans (Lealofi III, Alžběty II., Ludvík XVI.) are regnal
    //     proper names, and the shared Roman pass has already rewritten them to CARDINAL digits before
    //     this engine runs (Czech has no ROMAN_POLICIES entry). The digit after a capitalized NAME is
    //     read as an ordinal (Lealofi 3 → Lealofi třetí). Guarded two ways: the number must be ≤ 39 (the
    //     practical monarch/pope range, which keeps "Standard 802.11n" and "O 250 let" untouched) and
    //     followed by a break, never another digit/letter.
    s = s.replace(/(?<=\p{Lu}\p{Ll}+\p{M}*[ \u00a0])(\d{1,2})\.?(?=[\s.,;:!?]|$)/gu, (m0, d: string) => {
        const n = Number(d);
        const o = ordinal(n);
        return o === undefined || n > 39 ? m0 : o;
    });

    // 13) NUMERIC RANGES. The en/em dash between two numbers was dropped outright, fusing "1418" and
    //     "1450" into one uninterrupted run of number words. Read as "do" — the ordinary Czech reading of
    //     a range dash. Digits are required on BOTH sides so that "Ił-76"-shaped designations and
    //     "COVID-19" are not touched.
    s = s.replace(/(\d)\s?[–—-]\s?(?=\d)/gu, "$1 do ");

    // 14) RATE UNITS the shared tier cannot compose (the numerator is not one of its units): `mil/h`
    //     (miles per hour), where `mil` is already the written Czech genitive plural of míle. `km/h` and
    //     `m/s` are composed by the shared tier in czech.ts. AFTER the range rule, so "35–40 mil/h" reads
    //     as "35 do 40 mil za hodinu".
    s = s.replace(/(\d+)\s?mil\s?\/\s?h(?![\p{L}\p{M}])/giu, (_m, n: string) => `${n} mil za hodinu`);

    // 15) SIGNS. Degrees take the same three-way agreement. `×` between numbers reads as "krát"
    //     (6 × 6 cm = šest krát šest centimetrů), `+` before a number as "plus".
    s = s.replace(/(\d+)\s?°\s?C(?![\p{L}\p{M}])/gui, (_m, n: string) => `${n} ${counted(Number(n), DEGREE)} Celsia`);
    s = s.replace(/(\d+)\s?°\s?F(?![\p{L}\p{M}])/gui, (_m, n: string) => `${n} ${counted(Number(n), DEGREE)} Fahrenheita`);
    s = s.replace(/(\d+)\s?°/gu, (_m, n: string) => `${n} ${counted(Number(n), DEGREE)}`);
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = s.replace(/±/gu, " plus mínus ");
    s = s.replace(/(^|[\s(])\+\s?(?=\d)/gu, "$1plus ");
    s = s.replace(/(\d)\s*×\s*(?=\d)/gu, "$1 krát ");
    // MINUS, the counterpart of the `plus` rule above and missing from it. A sign before a number was
    // dropped outright, so `-5 stupňů` read as "pět stupňů" — five degrees, not minus five. Same boundary
    // as the plus rule so a hyphenated compound is untouched; U+2212 as well as the hyphen.
    s = s.replace(/(^|[\s(])[-−]\s?(?=\d)/gu, "$1mínus ");

    // RELATIONAL SIGNS. None occurs in this corpus, but a phonemizer is handed arbitrary text and a
    // dropped sign is inaudible — the one outcome that cannot be right. All the words read
    // correctly through the g2p: rovná se [rˈovnaː sˈɛ], mínus [mˈiːnus], plus [plˈus].
    s = s.replace(/\s*[=≈]\s*/gu, " rovná se ");
    s = s.replace(/\s*<\s*/gu, " menší než ");
    s = s.replace(/\s*>\s*/gu, " větší než ");
    s = s.replace(/\s*÷\s*/gu, " děleno ");

    // AMPERSAND → `a` (2 in the corpus, and `a` is its commonest word at 2155). It was dropped, so
    // `B&B` read as two bare letters with nothing between them.
    s = s.replace(/\s*[&＆]\s*/gu, " a ");

    // 16) FRACTIONS — feminine, agreeing with the elided *část*: 1/5 is "jedna pětina". Digits on both
    //     sides only, so the corpus's " / " in "i / nebo"-shaped phrases is untouched.
    s = s.replace(/(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d.,])/gu, (m0, a: string, b: string) => {
        const den = ordinal(Number(b));
        if (den === undefined || Number(a) !== 1) return m0;
        return `jedna ${inflectOrdinal(den, "fem")}`;
    });

    // 17) pH and Ghz — the corpus's lowercase tech tokens that would otherwise read as consonant
    //     clusters ([px] for pH, [ks x] for Ghz). `pH` letter-spells (pé há), `Ghz` is the word
    //     gigahertz. AFTER the version-dot rule, so "2.4Ghz" reads "dva tečka čtyři gigahertz".
    s = s.replace(/(?<![\p{L}\p{M}])pH(?![\p{L}\p{M}])/gu, "pé há");
    s = s.replace(/(?<![\p{L}\p{M}])Ghz(?![\p{L}\p{M}])/giu, "gigahertz");

    return s;
}
