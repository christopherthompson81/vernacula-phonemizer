/**
 * Spanish (es / es-419) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Third language to get this treatment, after English and French, and it reuses the shared tiers:
 * `core/normalizeSymbols.ts` for %, currency and units, `core/initialisms.ts` for acronyms, and the
 * registry's `core/roman.ts` pass for Roman numerals. What is left here is what is genuinely
 * Spanish-specific: its abbreviations, its ordinal indicators, and the shape of its dates and times.
 *
 * ORDERING — the couplings, measured against the es_419 FLEURS corpus (2,796 utterances):
 *   · `EE. UU.` is claimed BEFORE the generic dotted-abbreviation rule, or it splits into two abbreviations
 *     and reads as "ee . uu ." with two spurious pauses. At 31 occurrences it is by far the most frequent
 *     abbreviation in the corpus, and it expands to words (Estados Unidos), not to letters.
 *   · Era markers (`a. C.`, ×11, usually written WITH a space) run before the generic rule too, or the
 *     bare `a.` is claimed first.
 *   · Times run before units, so a unit rule cannot eat an hour.
 *   · Digit degrouping runs first so every later step sees one unbroken digit run.
 * Roman numerals need no ordering care here, unlike in English and French: `es` is not in the registry's
 * ROMAN_NATIVE set, so the shared pass converts them at the registry seam BEFORE this engine's text() is
 * called. By the time the initialism rule runs, `siglo XVIII` is already digits.
 *
 * NOT a problem in Spanish, in contrast to the other two: a bare 4-digit year is read as a plain cardinal
 * (1988 = mil novecientos ochenta y ocho), so there is no pair-wise year rule; the thousands-dot and
 * decimal-comma conventions were already handled by the number tokenizer; and % and currency already
 * worked through the shared symbol tier.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { spanishOrdinal } from "./romanOrdinals.ts";

/** Space characters used as digit-group separators: regular, NBSP, narrow NBSP, thin. */
const GROUP_SPACE = "    ";

const MONTHS = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";

/**
 * Dotted abbreviations → the spoken words. Each was checked against its corpus context. `no.` is
 * deliberately absent from this table and handled separately, because bare "no" is one of the commonest
 * words in Spanish and only `no.` followed by a DIGIT is the number sign.
 */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    sr: "señor", sra: "señora", srta: "señorita", sres: "señores",
    dr: "doctor", dra: "doctora", lic: "licenciado", ing: "ingeniero", prof: "profesor",
    d: "don", "dña": "doña", dna: "doña", ud: "usted", uds: "ustedes", vd: "usted", vds: "ustedes",
    etc: "etcétera", "pág": "página", "págs": "páginas", pag: "página",
    "núm": "número", num: "número", cap: "capítulo", art: "artículo", vol: "volumen",
    av: "avenida", avda: "avenida", "cía": "compañía", cia: "compañía",
    sto: "santo", sta: "santa", vs: "versus", aprox: "aproximadamente", dpto: "departamento",
};

/** Longest first, so `págs` is not matched as `pág` plus a stray s. */
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Spanish letter names, each verified through this engine: be=[be], ce=[se], efe=[ˈefe], hache=[ˈat͡ʃe],
 *  cu=[ku], equis=[ˈekis], zeta=[ˈseta]. `w` and `x`/`y` are the pan-American names (uve, doble uve, ye). */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", c: "ce", d: "de", e: "e", f: "efe", g: "ge", h: "hache", i: "i",
    j: "jota", k: "ka", l: "ele", m: "eme", n: "ene", "ñ": "eñe", o: "o", p: "pe", q: "cu",
    r: "erre", s: "ese", t: "te", u: "u", v: "uve", w: "doble uve", x: "equis", y: "ye", z: "zeta",
};

/** Spanish phonotactics, for the OOV rule in core/initialisms.ts. Spanish syllable structure is strict —
 *  no word begins with two stops, and codas are limited — so the illegal-cluster tests carry real weight
 *  here: `CD` [kð] and `ADN` [aðn] were both unpronounceable output. */
export const isUnreadableSpanish = makeUnreadableTest({
    vowels: /[aeiouáéíóúü]/u,
    legalOnsets: new Set([
        "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "tl",
        "ch", "ll", "rr", "qu", "gu", "ps", "gn", "mn",
    ]),
    legalCodas: new Set([
        "ch", "ll", "rr", "ns", "rs", "ls", "ds", "bs", "st", "rt", "rd", "rn", "rl", "rm",
        "lt", "ld", "ln", "nt", "nd", "nz", "nc", "ng", "rz", "rc", "rg", "sc", "sm", "cs", "ps", "ns",
    ]),
});

/** LEXICAL: acronyms spelled out although the OOV rule would leave them alone. Authored in spanish.jsonc
 *  beside the language's other hand-authored facts. */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

const INITIALISMS = (isRecorded: (lower: string) => boolean) =>
    makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded,
        isUnreadable: isUnreadableSpanish,
    });

/** Spanish has no pronunciation dictionary — the g2p is fully rule-based and reads any letter string — so
 *  nothing is "recorded" in the sense core/initialisms.ts means. Acronyms are therefore decided by the
 *  lexical list plus the OOV rule alone. */
export function normalizeSpanishInitialisms(text: string): string {
    return INITIALISMS(() => false)(text);
}

/** Feminine ordinal: every element of a compound inflects (vigésimo primero → vigésima primera). */
function feminineOrdinal(masc: string): string {
    return masc.split(" ").map((w) => w.replace(/o$/u, "a")).join(" ");
}

/** Non-negative integer → words with the final *uno* feminized (hora and minuto agreement: la una, las
 *  veintiuna). */
function feminineCardinal(n: number): string {
    return numberToWords(n).replace(/uno$/u, "una");
}

/** An hour/minute pair → "las once", "la una quince". `hora` is feminine, so 1 and 21 take *una*. */
function timeWords(h: number, min: number): string {
    const head = feminineCardinal(h);
    return min === 0 ? head : `${head} ${feminineCardinal(min)}`;
}

/** Fraction denominators with a suppletive name; the rest take the ordinal (1/5 = un quinto). */
const DENOMINATOR: Readonly<Record<number, string>> = { 2: "medio", 3: "tercio" };

function fractionWords(num: number, den: number): string | undefined {
    if (den < 2 || num < 1) return undefined;
    const base = DENOMINATOR[den] ?? spanishOrdinal(den);
    if (base === undefined) return undefined;
    // The numerator apocopates before the fraction noun: "un quinto", not "uno quinto".
    return `${num === 1 ? "un" : numberToWords(num)} ${num > 1 ? `${base}s` : base}`;
}

export interface SpanishNormalizeOptions {
    /**
     * Latin-American usage. The one normalization difference between the varieties: the FIRST of the month
     * is an ordinal in America (*el primero de enero*) and a cardinal in Spain (*el uno de enero*). RAE,
     * *Diccionario panhispánico de dudas* s.v. «fecha»: «para el primer día del mes se emplea el ordinal
     * primero en América, mientras que en España es más normal el cardinal uno». Every other day is a
     * cardinal in both.
     */
    americas?: boolean;
}

/** Normalize one Spanish input string. Pure text→text. */
export function normalizeSpanish(input: string, { americas = false }: SpanishNormalizeOptions = {}): string {
    let s = input;

    // 0) DIGIT GROUPING with a space. Spanish groups thousands with a period (17.000), which the number
    //    tokenizer already reads, but the SI space form also occurs (15× in the corpus) and the number
    //    token cannot span a space, so "5 000 años" read as "cinco cero años".
    s = s.replace(new RegExp(`(\\d)[${GROUP_SPACE}](\\d{3})(?!\\d)`, "gu"), "$1$2");
    s = s.replace(new RegExp(`(\\d)[${GROUP_SPACE}](\\d{3})(?!\\d)`, "gu"), "$1$2");
    s = s.replace(/[   ]/gu, " ");

    // 1) ERA MARKERS, before the generic abbreviation rule so the bare `a.` is not claimed first. Usually
    //    written with a space in the corpus ("356 a. C.", 9 of 11 occurrences).
    s = s.replace(/\ba\.\s?de\s?C\.|\ba\.\s?C\./giu, "antes de Cristo");
    s = s.replace(/\bd\.\s?de\s?C\.|\bd\.\s?C\./giu, "después de Cristo");

    // 2) EE. UU. — the most frequent abbreviation in the corpus, and it expands to WORDS. Claimed before
    //    the generic rule, which would otherwise see two separate abbreviations and leave two pauses.
    s = s.replace(/\bEE\.\s?UU\.?/gu, "Estados Unidos");
    s = s.replace(/\bee\.\s?uu\.?/gu, "Estados Unidos");

    // 2b) a. m. / p. m. — read as the LETTER NAMES in Spanish ([a ˈeme], [pe ˈeme]), not expanded to the
    //     Latin. Handled here rather than in the generic table because the interior dots would otherwise
    //     survive as two phrase breaks ("a las 10:08 p. m." kept both).
    s = s.replace(/\b([ap])\.\s?m\./giu, (_m, ap: string) => (ap.toLowerCase() === "a" ? "a eme" : "pe eme"));

    // 3) NÚMERO. `no.` only counts before a digit — bare "no" is one of the commonest Spanish words.
    //    Spanish writes it several ways, and `n.º` — n + period + the ORDINAL INDICATOR — is the form that
    //    actually occurs in the corpus. A single-character class missed it and left a bare º in the output.
    s = s.replace(/\b(?:n\.º|nº|n°|n\.|no\.)\s?(?=\d)/giu, "número ");

    // 4) DOTTED ABBREVIATIONS. The dot is CONSUMED when the sentence continues, so it cannot become a
    //    phrase break; at a phrase end it stays, because there it really is the sentence end.
    s = s.replace(new RegExp(`\\b(${ABBREV_ALT})\\.(\\s+)(?=\\p{L})`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`\\b(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 5) ORDINAL INDICATORS. `1º`/`1ª`/`1er`/`1.º` — the masculine and feminine indicators were reaching
    //    the phoneme string RAW (U+00BA / U+00AA), which is a non-IPA character in the output. `1er` is the
    //    apocopated form used before a masculine noun (primer, not primero).
    //    ° (U+00B0 DEGREE SIGN) is deliberately NOT an ordinal indicator, and no space is allowed before
    //    the indicator either: "20 °C" and "35°" are temperatures, and treating ° as ordinal read them as
    //    "vigésimo k" and "trigésimo quinto". Only º (U+00BA) and ª (U+00AA) are ordinal indicators.
    s = s.replace(/\b(\d+)\.?(?:er\b|º|ª)/gu, (whole) => {
        const n = Number(/\d+/.exec(whole)![0]);
        const masc = spanishOrdinal(n);
        if (masc === undefined) return whole;
        if (/ª/u.test(whole)) return feminineOrdinal(masc);
        if (/er$/u.test(whole)) return masc.replace(/o$/u, ""); // apocopated: primer, tercer
        return masc;
    });

    // 6) SIGNS. A dropped sign is silent content loss, and for a temperature it inverts the meaning.
    // ⚠ ± IS THIS LANGUAGE'S OWN TWO WORDS, juxtaposed — zero new sourcing. Both halves are lifted from
    //    the plus and minus rules already in this file, so nothing is invented. The FORM is the one every
    //    language that already read ± uses (bg/da/is/nb/ro/sv all juxtapose with no conjunction; English is the
    //    outlier that needs "or", and it already has its own rule). Runs BEFORE the + rule: ± is a single
    //    character, so the + rule cannot see it, and putting it first keeps the sign audible either way.
    s = s.replace(/±/gu, " más menos ");
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 más $2");
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1más $2");
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1menos $2");

    // 6b) RELATIONAL AND DIVISION SIGNS. ⚠ SEARCH FOR THE WORDS, NEVER FOR THE SIGN. The notation is
    //     genuinely absent from the corpus — every `<` in the fleet is an HTML tag `stripMarkup` removes — but
    //     the readings are ordinary comparative prose, and those words are in es_419 in quantity:
    //
    //       `menor que`   ×9 phrase hits   (menor ×35, que ×2983)
    //       `igual a`     ×5 phrase hits   (igual ×42)
    //       `mayor que`   ×3 phrase hits   (mayor ×128)
    //       `dividido`    ×1               — the one word the corpus cannot settle on its own
    //
    //     ⚠ THE DIVISION WORD NEEDED THE REGISTER TIER, and general Wikipedia would have answered wrong. Both
    //     `dividido entre` (the school reading in most of the Spanish-speaking world) and `dividido por` are
    //     real, and `dividido` appears once in the whole corpus, so neither the corpus nor a bare existence
    //     check separates them. Restricting the article sample to maths prose
    //     (`attest.ts --context "matemáticas aritmética división"`) puts the canonical División article in the
    //     net, and that article reads the operation aloud in exactly this slot:
    //
    //       "veinte dividido por cinco es igual a cuatro"
    //
    //     which sources the division word AND the equals word in one sentence, between two operands. That is
    //     the tier the German pilot showed is required rather than optional: German Wikipedia's only hit for
    //     `größer als` was a film title, and existence checks cannot tell a sense from a string.
    //
    //     The copula is dropped (`igual a`, not `es igual a`) because the sign occurs in running text where the
    //     verb is already present or absent for its own reasons — the same call `en` makes with `equals`.
    s = s.replace(/\s?=\s?/gu, " igual a ");
    s = s.replace(/\s?<\s?/gu, " menor que ");
    s = s.replace(/\s?>\s?/gu, " mayor que ");
    s = s.replace(/\s?÷\s?/gu, " dividido por ");

    // 7) FRACTIONS, guarded against a date and a unit ratio by requiring digits both sides.
    s = s.replace(/\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])/gu, (m0, a: string, b: string) =>
        fractionWords(Number(a), Number(b)) ?? m0);

    // 8) TIMES. The colon was becoming a PHRASE BREAK — "a las 11:00" read as "a las once , cero" with a
    //    pause and a spurious "cero". `hora` is feminine, so 1 takes *una* (a la una, not a la uno).
    s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu,
        (_m, h: string, min: string) => timeWords(Number(h), Number(min)));

    // 9) DATES. The day is a cardinal, except the first of the month in American usage (see the option).
    s = s.replace(new RegExp(`\\b1\\.?º?\\s+de\\s+(${MONTHS})\\b`, "giu"),
        (m0, mon: string) => (americas ? `primero de ${mon}` : m0.replace(/1\.?º?/u, "uno")));

    return s;
}
