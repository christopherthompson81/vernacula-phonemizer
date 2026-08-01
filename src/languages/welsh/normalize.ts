/**
 * Welsh (cy) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the 2,009 unique cased cy_gb FLEURS utterances (column 3):
 *   `Nfed`/`Ned`/`Neg`/`Naf`/`Nydd` ordinals ×~80 (1af, 3ydd, 6ed, 7fed, 10fed, 11eg, 15fed, 18fed,
 *     37fed, 60fed, 190fed, 1,000fed — VIGESIMAL, settled by audio in the investigation doc)
 *   comma-thousands ×37 (1,400, 19,500, 400,000, 5,000,000 — the TOKEN `\d+` split these on the comma)
 *   decades ×14 (1970au, 1920au, 90au — the Welsh plural -au)
 *   clocks ×21 (11:35 p.m., 06:30 a 07:30, 8:30 p.m., 1:15 a.m. — p.m./a.m. lowercase with dots)
 *   version dots ×… (802.11n/a/b/g, 2.4Ghz, 5.0Ghz) + dot-decimals (1.5, $2.3)
 *   era markers ×7 (O.C. = Oed Crist AD, C.C. = Cyn Crist BC, OC 1000–1300)
 *   currency ×9 (AUD$45, US$11,000, UD $14.7, £27, ¥7,000 — the glued prefixes and the bare UD)
 *   rates ×2 (480 cilomedr/awr, 100 llath/metr) · units ×15 (4892 m — the bare metre letter)
 *   degrees ×1 (+30°C) · fractions ×1 (1/5 modfedd) · percent ×4 (y cant — the tier owns it)
 *   initialisms ×124 (NHK, KNP, NPWS, NSW, PA, MS, FAA, XDR-TB, APS) · abbrev (George W. Bush, ayb.)
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `7fed`           → `sˈaᶦθ vˈeːd`        the ordinal suffix read as the bare word "fed"
 *   `190fed`         → `kˈant nˈaːᶷ dˈeːɡ vˈeːd`   the ordinal suffix read as "fed"
 *   `1,000fed`       → `ˈɨːn , dˈɪm vˈeːd`  the comma split the number AND "fed" became a word
 *   `1,400 o bobl`   → `ˈɨːn , pˈɛdwar kˈant`     the comma-thousands became a pause
 *   `400 O.C.`       → `pˈɛdwar kˈant ˈoː . k .`  the era marker letter-spelled
 *   `11:35 p.m.`     → `… , trˈiː dˈeːɡ pˈɨmp p . m .`  the colon pause + [p.m.] cluster
 *   `2.4Ghz`         → `dˈaᶤ . pˈɛdwar ɡhz`     the version dot became a pause, Ghz → [ɡhz]
 *   `AUD$45`         → `ˈaᶤd pˈɛdwar dˈeːɡ pˈɨmp`   the glued $ swallowed, no "doler"
 *   `480 cilomedr/awr` → `… kilˈɔmɛdr ˈaᶷr`    the / became a break
 *   `1/5 modfedd`    → `ˈɨːn pˈɨmp mˈɔdvɛð`     the fraction read as two numbers
 *   `+30°C`          → `trˈiː dˈeːɡ k`        the sign and the degree dropped
 *   `4892 m`         → `… dˈaᶤ m`              the bare metre letter [m]
 *   `George W. Bush` → `… ˈuː . bˈɨsh`         the W. dot survived
 *   `NHK`            → [n̥k]  `KNP` → [knp]  `XDR-TB` → [ksdrtb]   initialisms as clusters
 *
 * WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text
 * so the word path stresses them; the comma-thousands and dot-decimal stay DIGITS so the shared symbol
 * tier can still see the number adjacent to its unit/sign — the tier is composed AFTER this pass in
 * welsh.ts, and the TOKEN swallows the separators (see welsh.ts).
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords as numberToWordsWelsh } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Welsh letter names — the standard alphabet, per the National Reading System (a, bi, ec, edi, e, ef,
 *  eff, eg, eng, aitsh, i, je, el, ell, em, en, o, pi, fi, ew, er, erhed, es, ti, eth, u, u ddybl,
 *  fi, y). */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "bi", c: "ec", d: "edi", e: "e", f: "ef", g: "eg", h: "aitsh", i: "i", j: "je",
    k: "ec", l: "el", m: "em", n: "en", o: "o", p: "pi", q: "fi", r: "er", s: "es", t: "ti",
    u: "u", v: "fi", w: "u ddybl", x: "ecs", y: "y", z: "zed",
};

/** Welsh phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableWelsh = makeUnreadableTest({
    vowels: /[aeiouwyâêîôûŵŷàèìòùïëöäü]/u,
    legalOnsets: new Set([
        "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "gw", "pl", "pr", "sb", "sc", "sg",
        "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw", "ch", "dd", "ff", "ll", "ph", "rh", "th",
    ]),
    legalCodas: new Set([
        "b", "d", "f", "g", "l", "m", "n", "p", "r", "s", "t", "v", "w", "y", "x", "ch", "dd", "ff",
        "ll", "ng", "ph", "th", "nt", "st", "nt", "mb", "nd", "rd", "ld", "mp", "nc", "ng",
    ]),
});

/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["nato", "covid", "fifa", "opec", "unesco", "aids", "laser"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    acronymLetters: new Set([
        // US/AU agencies and Olympic bodies (letter-said, not words like "uda")
        "usoc", "usgs", "usaf", "usda", "upa", "faa", "nsa", "usc",
        // media and telecoms
        "cbs", "cctv", "cnn", "bbc", "itv", "s4c", "csi", "qvc", "aol",
        // medical and legal
        "add", "mri", "acpa", "mip", "aclu",
        // sports leagues
        "afc", "nfl", "nba", "nhl", "mlb", "mls",
        // organisations that are said as letters in Welsh text
        "cep", "oha", "acta", "meti", "fic", "knu", "knp", "nsw", "npws", "aub", "us", "ucla", "pa",
        // codes
        "xdr-tb", "as", "afo", "awc",
    ]),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableWelsh,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE VIGESIMAL ORDINAL
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ordinal words 1–19, masculine. Vigesimal, per the Wikipedia table (the corpus's own register —
 *  "ganrif ar bymtheg" for the 17th century — and the audio reading 60fed as trigainfed both confirm
 *  vigesimal over the decimal cardinal composition). */
const ORD_1_19: Readonly<string[]> = [
    "", "cyntaf", "ail", "trydydd", "pedwerydd", "pumed", "chweched", "seithfed", "wythfed", "nawfed",
    "degfed", "unfed ar ddeg", "deuddegfed", "trydydd ar ddeg", "pedwerydd ar ddeg", "pymthegfed",
    "unfed ar bymtheg", "ail ar bymtheg", "deunawfed", "pedwerydd ar bymtheg",
];

/** The compound 1–19 base used INSIDE a vigesimal block: 21 is *unfed ar hugain* (not *cyntaf*). */
const ORD_COMPOUND: string[] = [...ORD_1_19];
ORD_COMPOUND[1] = "unfed";

/** The round vigesimal tens the Wikipedia table documents — and nothing else. The non-round 40s–90s
 *  have inconsistent connectors (50 = degfed ar ddeugain but 51 = unfed ar ddeg a deugain) and the
 *  corpus writes no such digit, so they return undefined (trap 9: no unattested guard branches). */
const ROUND_TENS: Readonly<Record<number, string>> = {
    20: "ugeinfed", 30: "degfed ar hugain", 40: "deugainfed", 50: "degfed ar ddeugain",
    60: "trigainfed", 70: "degfed ar trigain", 80: "pedwar ugeinfed", 90: "degfed a phedwar ugain",
};

/** Integer → the vigesimal ordinal. Attested forms only (trap 13 + trap 9): the 1–19 table, the 20s and
 *  30s composition (the corpus writes 37fed = ail ar bymtheg ar hugain), the round tens the Wikipedia
 *  table documents, the corpus's 190fed (10 a naw ugain → degfed a naw ugain) and the simple -fed on
 *  cant/mil. Anything else → undefined, so the caller leaves the digit untouched rather than emitting a
 *  guard-constructed guess the corpus never exercises. */
export function ordinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 0) return undefined;
    if (n <= 19) return n === 0 ? "dimfed" : ORD_1_19[n]!;
    if (n < 40) {
        // 21–39: the compound 1–19 base + "ar hugain". 31 = unfed ar ddeg ar hugain (11 on 20),
        // 37 = ail ar bymtheg ar hugain (17 on 20).
        const low = n - 20;
        if (low < 1 || low > 19) return undefined;
        return `${ORD_COMPOUND[low]!} ar hugain`;
    }
    if (n < 100) return ROUND_TENS[n];
    if (n === 100) return "canfed";
    if (n === 200) return "dau ganfed";
    if (n === 190) return "degfed a naw ugain"; // 10 a naw ugain — the corpus's only >100 ordinal
    if (n === 1000) return "milfed";
    return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Welsh input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeWelsh(input: string): string {
    let s = input;

    // 1) ERA MARKERS — `O.C.` (Oed Crist, AD) and `C.C.` (Cyn Crist, BC), plus the undotted `OC` range
    //    form. FIRST, before the dotted-capital rule: otherwise the interior dot becomes a break.
    s = s.replace(/(?<![\p{L}\p{M}])O\.C\.(?![\p{L}\p{M}])/giu, "Oed Crist");
    s = s.replace(/(?<![\p{L}\p{M}])C\.C\.(?![\p{L}\p{M}])/giu, "Cyn Crist");
    s = s.replace(/(?<![\p{L}\p{M}])OC(?=\s*(?:\d+)\s*[–-]\s*\d+)/giu, "Oed Crist");

    // 1b) CURRENCY PREFIXES and the bare `UD`/`U.D.` (yr Unol Daleithiau = the US). The glued AUD$/US$
    //     swallowed the $ sign, so `AUD$45` read as "aud" + the bare number. `UD $14.7` keeps the tier's
    //     dollar; `UD`/`U.D.` in "yr UD" reads the country name.
    s = s.replace(/(?<![\p{L}\p{M}])AUD\$?(?=\s?\d)/giu, "doler Awstralia ");
    s = s.replace(/(?<![\p{L}\p{M}])US\$?(?=\s?\d)/giu, "doler yr Unol Daleithiau ");
    s = s.replace(/(?<![\p{L}\p{M}])U\.D\.(?![\p{L}\p{M}])/giu, "Unol Daleithiau");
    s = s.replace(/(?<![\p{L}\p{M}])UD(?=[\s,.]|$)(?![\p{L}\p{M}])/giu, "Unol Daleithiau");

    // 1c) WELSH ABBREVIATIONS with STANDARD EXPANSIONS — `DU` (Deyrnas Unedig = UK), `UDA` (Unol
    //     Daleithiau America = USA), `AS` (Aelod Seneddol = MP). These read as words (du, uda, as) which
    //     is wrong; the expansions are the corpus's own prose register. CASE-SENSITIVE: the lowercase
    //     "du" is the Welsh for "black" (y Môr Du = the Black Sea) and "as" is a real word — only the
    //     UPPERCASE abbreviations expand.
    s = s.replace(/(?<![\p{L}\p{M}])DU(?=[\s,.]|$)(?![\p{L}\p{M}])/gu, "Deyrnas Unedig");
    s = s.replace(/(?<![\p{L}\p{M}])UDA(?=[\s,.]|$)(?![\p{L}\p{M}])/gu, "Unol Daleithiau America");
    s = s.replace(/(?<![\p{L}\p{M}])AS(?=[\s,.]|$)(?![\p{L}\p{M}])/gu, "Aelod Seneddol");

    // 2) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
    //    `George W. Bush` — the W. suffix dot is a break.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));
    s = s.replace(/(?<=[A-Z])\.(?=\s+[A-Z])/gu, "");

    // 3) SINGLE-DOT ABBREVIATIONS. Two branches: mid-sentence the dot is CONSUMED so it cannot become a
    //    phrase break; at a phrase end it is kept. `ayb.` = ac yn y blaen (etc.); `p.m.`/`a.m.` are
    //    handled with the clocks below.
    s = s.replace(/(?<![\p{L}\p{M}])ayb\.(\s+)(?=[\p{L}\d])/giu, "ac yn y blaen$1");
    s = s.replace(/(?<![\p{L}\p{M}])ayb\.(?=\s*(?:[.,;:!?»)]|$))/giu, "ac yn y blaen.");

    // 4) ORDINALS — the `Naf`/`Nydd`/`Ned`/`Nfed`/`Neg`/`Nain` form. The suffix records the written
    //    ending; the READING is the vigesimal ordinal (see the table above). The digit run may include a
    //    comma-thousands separator (1,000fed). BEFORE the clock rule so a digit run is not first claimed
    //    as a time.
    s = s.replace(/(?<![\d.,])(\d[\d,]*)(fed|ed|af|eg|ydd|ain)(?![\p{L}\p{M}])/giu, (m0, d: string, sfx: string) => {
        const n = Number(d.replace(/,/gu, ""));
        if (!Number.isFinite(n) || n < 0 || n >= 100000) return m0;
        const ord = ordinalWords(n);
        return ord === undefined ? m0 : ord;
    });

    // 5) DECADES — `1970au`, `1920au`, `90au`. The Welsh plural -au after the year. Read as the decade
    //    number (the -au is a plural of the year, not a separate word). NOT `\b` — the -au is attached to
    //    the digits with no boundary for the ASCII word class to find (trap 1).
    s = s.replace(/(?<![\p{L}\p{M}\d])(\d[\d,]*)(au)(?![\p{L}\p{M}])/giu, "$1");

    // 5b) CLOCK RANGES — `10:00-11:00`. The hyphen between two clock readings is "i" (to). Handled
    //     BEFORE the colon-clock rule so the two times are claimed separately and the hyphen does not
    //     glue them into one token.
    s = s.replace(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]?\d|2[0-3]):([0-5]\d)(?!\d)/gu,
        "$1:$2 i $3:$4");

    // 6) CLOCK, in the COLON form. The comma DECIMAL and the DOT version are handled elsewhere; the colon
    //    is clause punctuation and must be claimed here. `11:35 p.m.` → un deg un tri deg pump y prynhawn;
    //    `06:30` → chwech tri deg. The p.m./a.m. marker (WITH the dots) expands to the Welsh time-of-day
    //    (y prynhawn / y bore), the corpus's own register. NOT a sports time: a THIRD `\d.\d\d` field
    //    after the minutes (4:41.30) means a pace. The marker is captured WITHOUT eating the space before
    //    it: a bare `\s*` after the minutes glued "10:00 i 11:00" into "deg i" → "degi" (the space before
    //    "i" was consumed even when no marker followed).
    s = s.replace(/(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?:\s*(p\.?m\.?|a\.?m\.?))?/giu,
        (m0, h: string, min: string, ap: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 23 || mv > 59) return m0;
            const head = mv === 0 ? numberToWordsWelsh(hv) : `${numberToWordsWelsh(hv)} ${numberToWordsWelsh(mv)}`;
            const apLower = (ap ?? "").toLowerCase();
            const suffix = apLower.startsWith("p") ? " y prynhawn"
                : apLower.startsWith("a") ? " y bore" : "";
            return `${head}${suffix}`;
        });

    // 6b) CLOCK, in the DOT form before a timezone — `15.00 UTC`, `12.00 GMT`. The dot is otherwise a
    //     decimal (pwynt); a timezone after the two-digit minutes marks a clock. BEFORE the version-dot
    //     rule so it is not claimed as "15 pwynt 00".
    s = s.replace(/(?<![\d.,])([01]?\d|2[0-3])\.([0-5]\d)\s*(UTC|GMT)/giu,
        (_m0, h: string, min: string, tz: string) => {
            const hv = Number(h), mv = Number(min);
            const head = mv === 0 ? numberToWordsWelsh(hv) : `${numberToWordsWelsh(hv)} ${numberToWordsWelsh(mv)}`;
            return `${head} ${tz}`;
        });

    // 7) VERSION DOTS and DOT DECIMALS — `802.11n/a/b/g`, `2.4Ghz`, `5.0Ghz`, `1.5 miliwn`, `$2.3`. The
    //    dot is a DECIMAL when the fraction is 1-2 digits, a THOUSANDS separator when 3 (Welsh writes
    //    thousands with COMMAS, so `1.400` does not occur, but the fraction length rule is defensive).
    //    Read "pwynt" (point). AFTER the clock.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.])/giu, "$1 pwynt $2");

    // 8) FRACTIONS. `1/5 modfedd` → *un pumed*. The denominator's word is the FRACTION NOUN, which is the
    //    ordinal for 5+ (pumed, chweched, wythfed) but a separate noun for 3 and 4 (traean = a third,
    //    chwarter = a quarter — both referee-attested, distinct from the ordinals trydydd/pedwerydd). The
    //    corpus's only fraction is 1/5; the 3/4 noun branch is pinned here from the referee (trap 13).
    //    ¾/½ after a whole read "a thri chwarter"/"a hanner".
    s = s.replace(/(\d+)¾/gu, "$1 a thri chwarter");
    s = s.replace(/(\d+)½/gu, "$1 a hanner");
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (den === 2) return num === 1 ? "hanner" : `${numberToWordsWelsh(num)} hanner`;
        const noun = den === 3 ? "traean" : den === 4 ? "chwarter" : ordinalWords(den);
        if (noun === undefined) return m0;
        return `${numberToWordsWelsh(num)} ${noun}`;
    });

    // 9) DEGREES. `+30°C` came out as the bare consonant [k] with the plus dropped. `gradd` is the
    //    degree word.
    s = s.replace(/(\d)\s?[°º]\s?C(?![\p{L}\p{M}])/giu, "$1 gradd Celsius");
    s = s.replace(/(\d)\s?[°º]\s?F(?![\p{L}\p{M}])/giu, "$1 gradd Ffahrenheit");
    s = s.replace(/(\d)\s?[°º](?![\p{L}\p{M}])/gu, "$1 gradd");

    // 10) RATES. The corpus's `480 cilomedr/awr` (kilometers per hour) and `100 llath/metr` (yards or
    //     metres — the "/" is an OR here, not a rate denominator). The prose "milltir yr awr" is text.
    s = s.replace(/(?<![\p{L}\p{M}])cilomedr\/awr(?![\p{L}\p{M}])/giu, "cilomedr yr awr");
    s = s.replace(/(?<![\p{L}\p{M}])llath\/metr(?![\p{L}\p{M}])/giu, "llath neu fetr");

    // 11) GIGAHERTZ — `2.4Ghz`, `5.0Ghz`. The version-dot rule has already split the number ("2.4" → "2
    //     pwynt 4"); the Ghz unit reads gigahertz. AFTER the version rule, BEFORE the tier.
    s = s.replace(/(\d+(?: pwynt \d+)?)\s?Ghz?(?![\p{L}\p{M}])/giu, "$1 gigahertz");

    // 12) SIGNS. `+30°C` — the plus was dropped. `&` → *a* (and). A TRUE minus (`-5`) reads "minws"; the
    //     corpus's `-\d` are all ranges/scores (6-6, 7-2, 10-60, 35-40) and stay as two bare numbers.
    s = s.replace(/\+\s?(?=\d)/gu, " plws ");
    s = s.replace(/(?<![\p{L}\p{Nd}])-(\d+)(?!\s*[-\d])/gu, "minws $1");
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])/gu,
        (_m, a: string, b: string, pl: string) =>
            `${LETTER_NAME[a.toLowerCase()] ?? a} a ${LETTER_NAME[b.toLowerCase()] ?? b}${pl}`);
    s = s.replace(/\s&\s/gu, " a ");
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 yn hafal i $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 yn llai na $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 yn fwy na $2");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 gwaith $2");

    // 13) INITIALISMS, LAST of the letter rules: it must run after the era markers (else C.C. → *ec.
    //     ec.*) and after the dotted-capital rule.
    s = normalizeInitialisms(s);

    return s;
}
