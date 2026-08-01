/**
 * Fula (ff) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the 1,500 unique cased ff_sn FLEURS utterances (column 3 — a Fula translation of the
 * English FLEURS set, heavily English-influenced: miliyon, biliyon, kilometre, miles, hour):
 *   `Nst`/`Nth`/`Nrd` Latin ordinals ×17 (1st, 3rd, 4th, 16th, 190th — English ordinal digits, the
 *     corpus's dates/centuries) — the Fula ordinal is the cardinal + -aɓal (gootal suppletive)
 *   comma-thousands ×23 (2,243, 100,000, 5,000,000) + dot-decimals (1.5, 3.50, 2.3, 12.8)
 *   clocks ×15 (1:15 a.m., 9:30 fajiri, 0230 UTC, 8:30 p.m., 15.00 UTC — the corpus mixes a.m./p.m.
 *     with 24h UTC and the Fula time-of-day word fajiri)
 *   era markers ×4 (1000B.C.) · rates ×6 (160km/h, 133m/s, 300mph, 64kph)
 *   units ×18 (5mm, 35mm, 3136mm2, 12.8km) · currency ×8 (US$11,000, AUD$45, ¥2,500, £27, uS$14.7)
 *   percent ×4 (88%) · ranges/scores ×11 (7-2, 1995-96, 2-3km) · signs (4×4, &amp;)
 *   initialisms ×102 (MRI, OHA, REM, ACMA, U.S., H5N1, A1GP) · degrees ×1 (30°C) · fractions ×1 (1/5)
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `1st`            → `ɡˈoː st`           the English ordinal suffix read as the bare word "st"
 *   `16th`           → `sˈapːo ˈe d͡ʒˈeːɡom th`   the suffix read as "th"
 *   `2,243`          → `ɗˈiɗi , …`         the comma-thousands became a pause
 *   `1:15 a.m.`      → `ɡˈoː , … ˈa . m .` the colon pause + [a.m.] letter-spelled
 *   `1000B.C.`       → `… b . tʃ .`        the era marker letter-spelled
 *   `160km/h`        → `… km h`            the rate raw
 *   `US$11,000`      → `ˈus … , mˈeːɾe`    the currency prefix swallowed, comma pause
 *   `30°C`           → `t͡ʃapːˈanɗe tˈati t͡ʃ`  the degree dropped
 *   `1/5 inch`       → `ɡˈoː d͡ʒˈoji ˈint͡ʃh`  the fraction read as two numbers
 *   `4×4`            → `nˈaji nˈaji`        the × dropped
 *   `&amp;`          → ``                 the HTML entity dropped
 *   `MRI`            → [mɾˈi]  `OHA` → [ˈoha]  `U.S.` → [ˈu . s .]  initialisms as words/clusters
 *   `H5N1`           → `h d͡ʒˈoji n ɡˈoː`   the digits inside the code read as words
 *
 * WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text
 * so the word path stresses them; the comma-thousands and dot-decimal stay DIGITS so the shared symbol
 * tier can still see the number adjacent to its unit/sign — the tier is composed AFTER this pass in
 * fula.ts, and the TOKEN swallows the separators (see fula.ts).
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Fula letter names — the standard Boko alphabet, per the UNESCO Bamako alphabet (a, ba, be, ci, da, …
 *  The letter names are the letter + -a (ba, ca, da, fa…), the conventional way Fula spells initials. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "ba", c: "ca", d: "da", e: "e", f: "fa", g: "ga", h: "ha", i: "i", j: "ja",
    k: "ka", l: "la", m: "ma", n: "na", o: "o", p: "pa", q: "ka", r: "ra", s: "sa", t: "ta",
    u: "u", v: "va", w: "wa", x: "eka", y: "ya", z: "za", "ɓ": "ɓa", "ɗ": "ɗa", "ŋ": "ŋa",
    "ɲ": "ɲa", "ƴ": "ƴa",
};

/** Fula phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableFula = makeUnreadableTest({
    vowels: /[aeiouɓɗŋɲƴ]/u,
    legalOnsets: new Set([
        "mb", "nd", "nj", "ng", "ny", "ƴ", "ɓ", "ɗ", "h", "j", "k", "l", "m", "n", "p", "r",
        "s", "t", "w", "y",
    ]),
    legalCodas: new Set([
        "b", "d", "f", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "w", "y", "mb", "nd",
        "ng", "nj", "ny",
    ]),
});

/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["nasa", "un", "una", "eu"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    acronymLetters: new Set([
        "mri", "oha", "acma", "rem", "us", "usa", "usaf", "fbi", "cia", "nsa", "faa", "bbc",
        "cnn", "cbs", "nba", "nfl", "nhl", "mlb", "mls", "gps", "dna", "hiv", "aids", "pdf", "dvd",
        "cd", "tv", "pc", "h5n1", "a1gp", "u.s.", "u.s",
    ]),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableFula,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE FULA ORDINAL
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ordinal 1–9: the cardinal stem + -aɓal (gootal is SUPPLETIVE for 1; ɗiɗaɓal/tataɓal/nayaɓal attested
 *  by Omniglot; the 5–9 quinary stems joy-/jeeg-/jeeɗiɗ-/jeetat-/jeenay- are the same stems as the
 *  cardinals minus their final vowel). The corpus's English ordinal digits (1st, 16th, 190th) read
 *  through this. */
const ORD_1_9: Readonly<Record<number, string>> = {
    1: "gootal", 2: "ɗiɗaɓal", 3: "tataɓal", 4: "nayaɓal", 5: "joyaɓal",
    6: "jeegaɓal", 7: "jeeɗiɗaɓal", 8: "jeetataɓal", 9: "jeenayaɓal",
};

/** The ordinal of a CARDINAL WORD when it ends a compound: the cardinal stem (final vowel dropped) +
 *  -aɓal. Table for the unit/tens words the compositor emits; anything else is left untouched. */
const STEM_ORD: Readonly<Record<string, string>> = {
    goo: "gootal", ɗiɗi: "ɗiɗaɓal", tati: "tataɓal", nayi: "nayaɓal", joyi: "joyaɓal",
    jeegom: "jeegaɓal", jeeɗiɗi: "jeeɗiɗaɓal", jeetati: "jeetataɓal", jeenayi: "jeenayaɓal",
    sappo: "sappaɓal", noogaas: "noogaasaɓal", cappanɗe: "cappanɗaɓal", teemedere: "teemederaɓal",
    teemedde: "teemeddaɓal", ujundere: "ujunderaɓal", ujunaaje: "ujunajaɓal",
    miliyon: "miliyonaɓal", milion: "milionaɓal",
};

/**
 * Integer → the Fula ordinal: the cardinal with the LAST element's ordinal (sappo e jeegaɓal = 16th,
 * teemedere e cappanɗe jeenayaɓal = 190th). gootal is the suppletive 1st. Anything with a digit (out of
 * the compositor's range) → undefined.
 */
export function ordinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1 || n >= 1e12) return undefined;
    if (n <= 9) return ORD_1_9[n];
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const words = card.split(" ");
    const last = words[words.length - 1]!;
    const ord = STEM_ORD[last];
    if (ord === undefined) return undefined;
    words[words.length - 1] = ord;
    return words.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Fula input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeFula(input: string): string {
    let s = input;

    // 1) HTML ENTITIES — the corpus's one `&amp;` reads "e" (and). FIRST, before the ampersand rule.
    s = s.replace(/&amp;/giu, " e ");

    // 1b) CURRENCY PREFIXES — `AUD$45`, `uS$14.7` (the corpus's Australian/US dollar glued forms). The
    //     bare `$` is the tier's; the glued prefix names the country. AFTER &amp;, BEFORE the number rules.
    s = s.replace(/(?<![\p{L}\p{M}])AUD\$?(?=\s?\d)/giu, "dollar Awstraliya ");
    s = s.replace(/(?<![\p{L}\p{M}])(?:US|uS)\$?(?=\s?\d)/giu, "dollar Amerik ");
    s = s.replace(/(?<![\p{L}\p{M}])US\$?(?=\s?\d)/giu, "dollar Amerik ");

    // 2) ERA MARKERS — `1000B.C.` (before Christ). The corpus's B.C. is attached to the year. Read the
    //    year, then "ɓawo jibineede Iisaa" (before the birth of Christ) — or the simpler Fula "ɓawo".
    //    The referee lacks an era word; "ɓawo" (before) is corpus-attested and unambiguous here.
    s = s.replace(/(?<!\d)(\d[\d,]*)B\.?C\.?(?![\p{L}\p{M}])/giu, "$1 ɓawo");

    // 3) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
    //    `George W. Bush` — the W. suffix dot is a break.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));
    s = s.replace(/(?<=[A-Z])\.(?=\s+[A-Z])/gu, "");

    // 4) ORDINALS — the `Nst`/`Nnd`/`Nrd`/`Nth` English ordinal form (the corpus's dates/centuries).
    //    Read the Fula ordinal. BEFORE the clock rule so a digit run is not first claimed as a time.
    s = s.replace(/(?<![\d.,])(\d[\d,]*)(st|nd|rd|th)(?![\p{L}\p{M}])/giu, (m0, d: string, sfx: string) => {
        const n = Number(d.replace(/,/gu, ""));
        if (!Number.isFinite(n) || n < 1) return m0;
        const ord = ordinalWords(n);
        return ord === undefined ? m0 : ord;
    });

    // 5) RANGES and SCORES — `7-2`, `5-3`, `1995-96`, `1644-1912`, `2-3km`. Fula reads these with
    //    "hakkunde" (between) — corpus-attested. A leading minus stays a sign (handled later).
    s = s.replace(/(?<![\d.,])(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)(?![\d.])/gu, "$1 hakkunde $2");

    // 5b) GLUED CLOCK SUFFIX — `11:00nje` (the Fula locative -nje "at"). The suffix is a separate word,
    //     not glued to the time; spaced out so the clock rule reads the time, then "nje" follows.
    s = s.replace(/(?<![\d.,])(\d{1,2}):(\d{2})(nje|nde|ni|na)(?![\p{L}\p{M}])/giu, "$1:$2 $3");

    // 6) CLOCK, in the COLON form. `1:15 a.m.` → goo e sappo e joyi a.m.; `9:30 fajiri` → … fajiri.
    //    The 24h `0230 UTC` is handled here too (a leading 0 makes it a 4-digit time). The a.m./p.m.
    //    marker expands to the Fula time-of-day (fajiri = morning, kikiiɗe = evening). NOT a sports
    //    time: a THIRD `\d.\d\d` field (4:41.30) means a pace. The trailing marker is captured WITHOUT
    //    eating the space before a following word (trap: a bare `\s*` glued "tati fajiri" → "tatifajiri").
    s = s.replace(/(?<![\d:,])(\d{1,2}):(\d{2})(?![:.\d])(?:\s*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?))?/giu,
        (m0, h: string, min: string, ap: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 23 || mv > 59) return m0;
            const head = mv === 0 ? numberToWords(hv) : `${numberToWords(hv)} e ${numberToWords(mv)}`;
            const apLower = (ap ?? "").toLowerCase();
            const suffix = apLower.startsWith("p") ? " kikiiɗe" : apLower.startsWith("a") ? " fajiri" : "";
            return `${head}${suffix}`;
        });

    // 6b) CLOCK, in the DOT form before a timezone — `15.00 UTC`. The dot is otherwise a decimal;
    //     a timezone after the two-digit minutes marks a clock.
    s = s.replace(/(?<![\d.,])(\d{1,2})\.(\d{2})\s*(UTC|GMT)/giu,
        (m0, h: string, min: string, tz: string) => {
            const hv = Number(h), mv = Number(min);
            const head = mv === 0 ? numberToWords(hv) : `${numberToWords(hv)} e ${numberToWords(mv)}`;
            return `${head} ${tz}`;
        });

    // 7) VERSION DOTS and DOT DECIMALS — `1.5 million`, `3.50`, `2.3`, `12.8km`, `802.11n`. The dot is
    //    a DECIMAL (the corpus follows English; thousands use COMMAS). Read "tere" (point — the Fula
    //    word for a point/spot), the fraction digit-by-digit. AFTER the clock.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)\s?(km|m|kg|mm|cm|mph|kph)(?![\p{L}\p{M}])/giu,
        (m0, i: string, f: string, u: string) =>
            `${i} tere ${[...f].map((d) => numberToWords(Number(d))).join(" ")} ${({ km: "kilometre", m: "metre", kg: "kilogram", mm: "milimeta", cm: "santimeta", mph: "miles e wakkati gootel", kph: "kilometre e wakkati gootel" } as Record<string, string>)[u.toLowerCase()]!}`);
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d.])/giu, (m0, i: string, f: string) =>
        `${i} tere ${[...f].map((d) => numberToWords(Number(d))).join(" ")}`);

    // 7c) COMMA-DECIMALS — `12,5`. Fula follows English (comma = thousands, dot = decimal), so a
    //     comma-decimal is corpus-absent — but it must not LEAK the comma as a clause pause. A comma
    //     followed by a THREE-digit group is thousands (2,243) and stays for the TOKEN; this claims
    //     only 1-2 digit fractions.
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (m0, i: string, f: string) =>
        `${i} tere ${[...f].map((d) => numberToWords(Number(d))).join(" ")}`);

    // 8) FRACTIONS. `1/5 inch` → *goo e joyi* (the corpus's one fraction, read as a ratio). ¾/½ after
    //    a whole read "e teemedere"/"e hecci". The corpus's only fraction is 1/5.
    s = s.replace(/(\d+)¾/gu, "$1 e teemedere");
    s = s.replace(/(\d+)½/gu, "$1 e hecci");
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) =>
        `${numberToWords(Number(a))} e ${numberToWords(Number(b))}`);

    // 9) DEGREES. `30°C` came out as the bare consonant [tʃ]. `digiri` is the degree word.
    s = s.replace(/(\d)\s?[°º]\s?C(?![\p{L}\p{M}])/giu, "$1 digiri Celsius");
    s = s.replace(/(\d)\s?[°º]\s?F(?![\p{L}\p{M}])/giu, "$1 digiri Fahrenheit");
    s = s.replace(/(\d)\s?[°º](?![\p{L}\p{M}])/gu, "$1 digiri");

    // 10) RATES — `160km/h`, `133m/s`, `480 km/h`, `300mph`, `64kph`. The corpus's "miles per hour"
    //     is already text; the unit/unit forms need "e wakkati gootel" (in one hour). The corpus also
    //     writes the TYPO `16okm/h` for 160km/h (the "o" is a stray 0-letter). mph/kph are handled here
    //     (glued to the number). AFTER the version-dot rule (12.8km has already been claimed), BEFORE
    //     the tier.
    s = s.replace(/(?<!\d)(\d+)\s?(km|m|kg|mm|cm)\s*\/\s*(h|s)(?![\p{L}\p{M}])/giu,
        (m0, n: string, u: string, d: string) =>
            `${numberToWords(Number(n))} ${({ km: "kilometre", m: "metre", kg: "kilogram", mm: "milimeta", cm: "santimeta" } as Record<string, string>)[u.toLowerCase()]!} e wakkati ${d.toLowerCase() === "h" ? "gootel" : "gootel"}`);
    s = s.replace(/(?<!\d)(\d+)\s?(mph|kph)(?![\p{L}\p{M}])/giu,
        (m0, n: string, u: string) =>
            `${numberToWords(Number(n))} ${u.toLowerCase() === "mph" ? "miles e wakkati gootel" : "kilometre e wakkati gootel"}`);
    s = s.replace(/(?<!\d)(\d+)o\s?(km\/h)(?![\p{L}\p{M}])/giu,
        (m0, n: string, u: string) =>
            `${numberToWords(Number(n))} kilometre e wakkati gootel`);

    // 11) GIGAHERTZ — `2.4Ghz`. The version-dot rule has already split it; the Ghz reads gigahertz.
    s = s.replace(/(\d+(?: tere \d[\d ]*)?)\s?Ghz?(?![\p{L}\p{M}])/giu, "$1 gigahertz");

    // 12) SIGNS. `4×4` — the × reads "je" (by). `&` → *e* (and). A TRUE minus (`-5`) reads "leɓɓa";
    //     the corpus's `-\d` are all ranges/scores, now handled above. `%` → *tere*.
    s = s.replace(/\+\s?(?=\d)/gu, " e gooto ");
    s = s.replace(/(?<![\p{L}\p{Nd}])-(\d+)(?!\s*[-\d])/gu, "leɓɓa $1");
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])/gu,
        (_m, a: string, b: string, pl: string) =>
            `${LETTER_NAME[a.toLowerCase()] ?? a} e ${LETTER_NAME[b.toLowerCase()] ?? b}${pl}`);
    s = s.replace(/\s&\s/gu, " e ");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 je $2");
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 fotoo $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 famɗi $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 ɓuri $2");
    s = s.replace(/(\d)\s*%\s*(?![\p{L}\p{M}])/gu, "$1 tere");

    // 13) INITIALISMS, LAST of the letter rules: it must run after the era markers (else B.C. → *ba.
    //     ca.*) and after the dotted-capital rule.
    s = normalizeInitialisms(s);

    return s;
}
