/**
 * Irish (ga) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE ORDINAL IS A NUMERAL PLUS `ú` (7ú, 11ú, 190ú), which unhandled reads as the bare vowel — `1ú` comes
 * out *ˈa hˈeːn̪ˠ ˈuː*. The prose spells the low ordinals out instead ("an chéad", "an dara", "an tríú").
 *
 * ⚠ THE CLOCK AND ERA MARKERS ARE IRISH ABBREVIATIONS, not English ones: `i.n.` / `r.n.` are iarnóin and
 * réamhnóin (p.m. / a.m.), `A.D.` is tar éis Chríost and `R.C.` roimh Chríost. Left alone they letter-spell
 * or collapse to a cluster — `1000 R.C.` reads [bk].
 *
 * ⚠ THE RATE DENOMINATORS ARE IRISH TOO: `km/u` is the Irish spelling of km/h (uair = hour), and `msu` is
 * míle san uair, i.e. mph. A rule keyed on the English abbreviations alone misses both.
 *
 * ⚠ WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text so
 * the word path stresses them; the comma-thousands and dot-decimal stay DIGITS so the shared symbol tier can
 * still see the number adjacent to its unit or sign. The tier is composed AFTER this pass in irish.ts, and
 * the TOKEN swallows the separators.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords as irishNumber } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Irish letter names — the standard alphabet (a, bé, cé, dé, e, eif, gé, héis, í, jé, cá, eil, eim,
 *  ein, ó, pé, cú, ear, eas, té, ú, vé, wae, eics, yé, zae). */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "bé", c: "cé", d: "dé", e: "e", f: "eif", g: "gé", h: "héis", i: "í", j: "jé",
    k: "cá", l: "eil", m: "eim", n: "ein", o: "ó", p: "pé", q: "cú", r: "ear", s: "eas", t: "té",
    u: "ú", v: "vé", w: "wae", x: "eics", y: "yé", z: "zae",
};

/** Irish phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableIrish = makeUnreadableTest({
    vowels: /[aeiouáéíóú]/u,
    legalOnsets: new Set([
        "bh", "ch", "dh", "fh", "gh", "mh", "ph", "sh", "th", "bhf", "gc", "bp", "dt", "nd",
        "mb", "ng", "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "sc", "sk",
        "sl", "sm", "sn", "sp", "st", "tr", "ts",
    ]),
    legalCodas: new Set([
        "b", "d", "f", "g", "l", "m", "n", "p", "r", "s", "t", "v", "x", "bh", "ch", "dh", "fh",
        "gh", "mh", "ph", "sh", "th", "cht", "rt", "rd", "st", "nd", "nc", "nt", "mp", "mb", "ng",
        "lth", "rth", "nn", "ll", "rr", "nn",
    ]),
});

/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["nato", "covid", "fifa", "opec", "unesco", "aids", "laser", "gaa", "rte", "ira", "nasa"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    acronymLetters: new Set([
        // broadcasters and orgs said as letters
        "bbc", "cnn", "cbs", "nbc", "rté", "itv", "csi", "fbi", "cia", "nsa", "faa", "nhk",
        // codes
        "xdr-tb", "h5n1", "a1gp", "pstn", "dna", "hiv", "dvd", "cd", "tv", "pc", "pdf", "gps",
        "mri", "ms", "ir",
    ]),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableIrish,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE IRISH ORDINAL
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Ordinal words 1–10, WITHOUT the article. The corpus supplies its own — `an 15ú haois`, `sa 10ú haois`,
 * `ón 8ú haois` — so 27 of the 36 `Nú` instances are preceded by an article or a contraction of one, and
 * a table that carried "an" read them all twice: *an an cúigiú … *, *sa an deichiú …*. The corpus's own
 * prose is the register to match, and it writes the bare ordinal: "sa tríú haois", "an cúigiú huair",
 * "sa naoú háit", "sa deichiú háit", "san aonú háit déag", "an fichiú haois".
 *
 * ELEVEN IS `aonú`, NOT `chéad`. Composing 11 as ORD_1_10[1] + déag gave *an chéad déag*; the corpus
 * writes "san aonú háit déag", and `chéad` is only ever the standalone first. So the teens take their own
 * unit series, where 1 → aonú.
 */
const ORD_1_10: Readonly<Record<number, string>> = {
    1: "chéad", 2: "dara", 3: "tríú", 4: "ceathrú", 5: "cúigiú",
    6: "séú", 7: "seachtú", 8: "ochtú", 9: "naoú", 10: "deichiú",
};
/**
 * The unit series used INSIDE a compound (teens and 21+): 1 is `aonú`, not `chéad`, and 2 is `dóú`, not
 * `dara`. The corpus evidences the split for 1 — "san aonú háit déag" — and neither `dara déag` nor
 * `dóú déag` appears in the corpus or the referee, so 2 follows the same analogy rather than reusing the
 * standalone form (`dara` is attested, but only standing alone: "an Dara Cogadh Domhanda"). Stated as an
 * inference, not an attestation.
 */
const ORD_UNIT_IN_COMPOUND: Readonly<Record<number, string>> = { ...ORD_1_10, 1: "aonú", 2: "dóú" };

/** Words that are NOT the noun a compound ordinal encloses. The corpus writes a LIST — "sna 11ú, 12ú agus
 *  13ú haoiseanna" — where the noun comes once at the end, so pulling the next token inside gave
 *  *dara agus déag*: the conjunction swallowed as if it were the head noun. */
const NOT_A_NOUN: ReadonlySet<string> = new Set([
    "agus", "is", "nó", "ná", "ach", "mar", "féin", "seo", "sin", "siúd",
    "a", "an", "na", "ag", "ar", "as", "chun", "de", "do", "faoi", "go", "i", "in", "le", "ó", "roimh",
    "sa", "san", "sna", "tar", "thar", "um",
]);

/** Integer → the Irish ordinal (the corpus's `Nú` digit form). Below 10 the table; from 10 up the
 *  cardinal's last element takes the -ú ordinal ending (an fichiú = 20th, an seascadú = 60th,
 *  an cúigiú déag = 15th). Anything outside the compositor's range → undefined. */
export function ordinalWords(n: number, noun = ""): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1 || n >= 1e12) return undefined;
    if (n <= 10) return ORD_1_10[n];
    // THE NOUN GOES INSIDE A COMPOUND ORDINAL, which is why this takes it as an argument. Irish writes
    // "an naoú haois déag" (the 19th century — lit. ninth century tenth) and "an séú háit déag", never
    // *an naoú déag haois*: the tens element follows the NOUN. Six of the corpus's teens are of exactly
    // that shape (`15ú haois`, `17ú haois`, `18ú haois`, `10ú - 11ú haois`, `16ú haois`), and the caller
    // hands the following word over so it can be placed. With no noun to place, the bare compound is
    // still the best available reading.
    const tail = noun === "" ? "" : `${noun} `;
    if (n < 20) return `${ORD_UNIT_IN_COMPOUND[n - 10]} ${tail}déag`.trim();
    // 20+: a round ten is the stem + -ú (fiche → fichiú, seasca → seascadú). A compound is the UNIT
    // ordinal first and the tens last, joined by "is" — the same order as the teens: "an t-aonú lá is
    // fiche" (the 21st day). The corpus's one compound is `37ú tír` → seachtú tír is tríocha.
    const card = irishNumber(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const words = card.split(" ").filter((w) => w !== "a"); // the counting particle is not part of an ordinal
    if (words.length === 1) {
        const ord = TENS_ORD[words[0]!] ?? UNIT_ORD[words[0]!];
        return ord === undefined ? undefined : `${ord}${noun === "" ? "" : ` ${noun}`}`;
    }
    // A compound ending in a TENS word ordinalises IN PLACE and keeps its order — 190 is "céad nóchadú"
    // (hundred ninetieth), not *nóchadú is céad*. Only a UNIT-final compound takes the "is" inversion.
    const lastWord = words[words.length - 1]!;
    if (TENS_ORD[lastWord] !== undefined) {
        const head = [...words.slice(0, -1), TENS_ORD[lastWord]!].join(" ");
        return noun === "" ? head : `${head} ${noun}`;
    }
    const unit = UNIT_ORD[lastWord];
    const tens = words.slice(0, -1).join(" ");
    if (unit === undefined || tens === "") return undefined;
    return `${unit} ${tail}is ${tens}`.replace(/\s+/gu, " ").trim();
}

/** The ordinal of a CARDINAL WORD when it ends a compound (from numbers.ts's emitted words). The
 *  counting series prefixes `h` to the vowel-initial aon/ocht (a haon, a hocht), so both forms are
 *  keyed — 21ú = fiche a haon → "an fiche a h-aonú" would be wrong, so haon maps to aonú and the h is
 *  dropped (the ordinal is "an t-aonú" for first-of-something, but in a compound "fiche a haonú"). */
const UNIT_ORD: Readonly<Record<string, string>> = {
    aon: "aonú", haon: "aonú", dó: "dara", trí: "tríú", ceathair: "ceathrú", cúig: "cúigiú",
    sé: "séú", seacht: "seachtú", ocht: "ochtú", hocht: "ochtú", naoi: "naoú", deich: "deichiú",
};
const TENS_ORD: Readonly<Record<string, string>> = {
    fiche: "fichiú", tríocha: "tríochadú", daichead: "daicheadú", caoga: "caogadú",
    seasca: "seascadú", seachtó: "seachtódú", ochtó: "ochtódú", nócha: "nóchadú",
    céad: "céadú", chéad: "chéadú", míle: "míliú", milliún: "milliúna", billiún: "billiúna",
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Irish input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeIrish(input: string): string {
    let s = input;

    // 0) ZERO-WIDTH — the corpus has U+200B ZERO WIDTH SPACE ×18. Invisible, but they split tokens.
    //    Remove them outright (they are not text).
    s = s.replace(/[\u200B\u200C\u200D\uFEFF]/gu, "");

    // 1) ERA MARKERS and MULTI-DOT ABBREVIATIONS — `A.D.` (tar éis Chríost), `R.C.` (roimh Chríost),
    //    the undotted `AD`, and the Irish `N.A.`/`S.A.` (Náisiúin Aontaithe / Stáit Aontaithe). FIRST,
    //    before the dotted-capital rule: otherwise the interior dot becomes a break.
    s = s.replace(/(?<![\p{L}\p{M}])A\.D\.(?![\p{L}\p{M}])/giu, "tar éis Chríost");
    s = s.replace(/(?<![\p{L}\p{M}])R\.C\.(?![\p{L}\p{M}])/giu, "roimh Chríost");
    s = s.replace(/(?<![\p{L}\p{M}])AD(?=\s*\d+)/giu, "tar éis Chríost");
    s = s.replace(/(?<![\p{L}\p{M}])\d[\d,]*\s+AD(?![\p{L}\p{M}])/giu, (m0) => m0.replace(/AD/giu, "tar éis Chríost"));
    s = s.replace(/(?<![\p{L}\p{M}])BC(?=\s*\d+)/giu, "roimh Chríost");
    s = s.replace(/(?<![\p{L}\p{M}])\d[\d,]*\s+BC(?![\p{L}\p{M}])/giu, (m0) => m0.replace(/BC/giu, "roimh Chríost"));
    s = s.replace(/(?<![\p{L}\p{M}])N\.A\.(?![\p{L}\p{M}])/giu, "Náisiúin Aontaithe");
    s = s.replace(/(?<![\p{L}\p{M}])S\.A\.(?![\p{L}\p{M}])/giu, "Stáit Aontaithe");

    // 1b) CURRENCY PREFIXES — `US$14.7`, `US$11,000`, `US$30`. The corpus's glued US$ names the
    //     currency (dollar); the bare `$` is the tier's. The `$` is REQUIRED so `US` alone (without a
    //     sign) does not expand — that keeps the with-`$` and without-`$` readings different, which is
    //     how the scan's DROP test sees the contribution. AFTER the era markers, BEFORE the number rules.
    s = s.replace(/(?<![\p{L}\p{M}])(?:US|uS)\$(?=\s?\d)/giu, "dollar na Stát Aontaithe ");

    // 2) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
    //    `George W. Bush` — the W. suffix dot is a break.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));
    s = s.replace(/(?<=[A-Z])\.(?=\s+[A-Z])/gu, "");

    // 3) SINGLE-DOT ABBREVIATIONS. `Dr.` → "dochtúir", `etc.` → "srl", `Mrs.` → "bean Uí".
    s = s.replace(/(?<![\p{L}\p{M}])Dr\.(\s+)(?=[\p{L}\d])/giu, "Dochtúir$1");
    s = s.replace(/(?<![\p{L}\p{M}])Dr\.(?=\s*(?:[.,;:!?»)]|$))/giu, "Dochtúir.");
    s = s.replace(/(?<![\p{L}\p{M}])etc\.(\s+)(?=[\p{L}\d])/giu, "srl$1");
    s = s.replace(/(?<![\p{L}\p{M}])etc\.(?=\s*(?:[.,;:!?»)]|$))/giu, "srl.");

    // 4) ORDINALS — the `Nú` form (the corpus's own ordinal digits). The suffix is the Irish ordinal
    //    ending; the READING is the ordinal word (an chéad, an dara, an tríú …). The digit run may
    //    include a comma-thousands separator (1,000ú). BEFORE the clock rule.
    //    THE FOLLOWING NOUN is captured, because a compound ordinal encloses it (see `ordinalWords`), and
    //    the PRECEDING word is inspected: a vowel-initial ordinal takes the t- prefix after a bare "an"
    //    (an t-ochtú, an t-aonú), which is the one piece of the article's morphology that belongs to us
    //    rather than to the corpus text.
    s = s.replace(/(\ban )?(?<![\d.,])(\d[\d,]*)ú(?![\p{L}\p{M}])([  ]+([\p{L}\p{M}]+))?/giu,
        (m0, art: string | undefined, d: string, spaced: string | undefined, noun: string | undefined) => {
            const n = Number(d.replace(/,/gu, ""));
            if (!Number.isFinite(n) || n < 1) return m0;
            // A noun is only pulled INSIDE for the compounds that enclose one; elsewhere it stays put.
            const encloses = n > 10 && (n < 20 || n % 10 !== 0)
                && (noun === undefined || !NOT_A_NOUN.has(noun.toLowerCase()));
            const ord = ordinalWords(n, encloses ? (noun ?? "") : "");
            if (ord === undefined) return m0;
            const tPrefix = art !== undefined && /^[aeiouáéíóú]/u.test(ord) ? "t-" : "";
            const head = `${art ?? ""}${tPrefix}${ord}`;
            return encloses && noun !== undefined ? head : `${head}${spaced ?? ""}`;
        });

    // 5) RANGES and SCORES — `10-60 nóiméad`, `6-6`, `4.2-3.9 milliún`, `AD 1000-1300`. Irish reads
    //    these with "go dtí" (to) or the range just as two numbers. The corpus's prose uses "idir X
    //    agus Y" (between X and Y). A leading minus stays a sign (handled later).
    s = s.replace(/(?<![\d.,])(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)(?![\d.])/gu, "$1 go dtí $2");

    // 6) CLOCK, in the COLON form. `11:35 i.n.` → aon déag tríocha a cúig iarnóin; `8:30 p.m.` →
    //    ocht tríocha p.m. The i.n./r.n./p.m./a.m. marker (WITH the dots) expands to the Irish
    //    time-of-day (iarnóin = afternoon/p.m., réamhnóin = morning/a.m.). NOT a sports time: a THIRD
    //    `\d.\d\d` field (4:41.30) means a pace. The marker is captured WITHOUT eating the space before
    //    it (the clock-glue trap).
    s = s.replace(/(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?:\s*(i\.?n\.?|r\.?n\.?|[Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?))?/giu,
        (m0, h: string, min: string, ap: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 23 || mv > 59) return m0;
            const head = mv === 0 ? irishNumber(hv) : `${irishNumber(hv)} ${irishNumber(mv)}`;
            const apLower = (ap ?? "").toLowerCase();
            const suffix = /^i/.test(apLower) ? " iarnóin"
                : /^r/.test(apLower) ? " réamhnóin"
                : /^p/.test(apLower) ? " iarnóin" : /^a/.test(apLower) ? " réamhnóin" : "";
            return `${head}${suffix}`;
        });

    // 7) VERSION DOTS and DOT DECIMALS — `1.5 million`, `4.2-3.9`, `12.8 km`, `802.11n`, `2.4Ghz`. The
    //    dot is a DECIMAL (the corpus follows English; thousands use COMMAS). Read "pointe" (point),
    //    the fraction digit-by-digit. GIGAHERTZ is claimed FIRST on the raw digits. AFTER the clock.
    s = s.replace(/(?<![\d.,])(\d+\.\d+)\s?Ghz?(?![\p{L}\p{M}])/giu, "$1 gigahertz");
    // A VERSION LETTER after the fraction (802.11n) is a separate letter, not glued to the last digit —
    // emit it spaced so it reads as the letter name n (the corpus's 802.11n/a/b/g).
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?=[a-z](?![\p{L}\p{M}]))/giu,
        (m0, i: string, f: string) =>
            `${i} pointe ${[...f].map((d) => irishNumber(Number(d))).join(" ")} `);
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)\s?(km|m|kg|mm|cm|msu|km\/u)(?![\p{L}\p{M}])/giu,
        (m0, i: string, f: string, u: string) =>
            `${i} pointe ${[...f].map((d) => irishNumber(Number(d))).join(" ")} ${({ km: "ciliméadar", m: "méadar", kg: "cileagram", mm: "milliméadar", cm: "ceintiméadar", msu: "míle san uair", "km/u": "ciliméadar san uair" } as Record<string, string>)[u.toLowerCase()]!}`);
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d.])/giu, (m0, i: string, f: string) =>
        `${i} pointe ${[...f].map((d) => irishNumber(Number(d))).join(" ")}`);

    // 7c) COMMA-DECIMALS — `12,5`. Irish follows English (comma = thousands, dot = decimal), so a
    //     comma-decimal is corpus-absent — but it must not LEAK the comma as a clause pause. A comma
    //     followed by a THREE-digit group is thousands (2,243) and stays for the TOKEN; this claims
    //     only 1-2 digit fractions.
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (m0, i: string, f: string) =>
        `${i} pointe ${[...f].map((d) => irishNumber(Number(d))).join(" ")}`);

    // 8) FRACTIONS. `29¾ orlach` → *fiche a naoi agus trí cheathrú orlach*; `1/5 orlach` → *aonú
    //    cúigiú*? No — the corpus's `1/5 orlach` is "one fifth of an inch" → *cúigiú orlach*.
    s = s.replace(/(\d+)¾/gu, "$1 agus trí cheathrú");
    s = s.replace(/(\d+)½/gu, "$1 agus leath");
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
        const ord = ordinalWords(Number(b));
        if (ord === undefined) return m0;
        // THE ARTICLE BELONGS HERE, not in the ordinal table. A `Nú` digit is preceded by the corpus's own
        // article ("an 15ú haois"), so the table must not carry one — but a FRACTION supplies its own: 1/5
        // orlach is "an cúigiú orlach" (the fifth of an inch), and a vowel-initial ordinal takes the
        // t- prefix after it (1/8 → an t-ochtú).
        const article = /^[aeiouáéíóú]/u.test(ord) ? "an t-" : "an ";
        // A unit fraction (1/N) is the ordinal noun; a non-unit fraction (M/N) is "M N-ú" (dhá chúigiú).
        return Number(a) === 1 ? `${article}${ord}` : `${irishNumber(Number(a))} ${ord}`;
    });

    // 9) DEGREES. `30°C` came out as the bare consonant [k]; `35°W` is a LONGITUDE. `céim` is the
    //    degree word. The compass letters N/S/E/W read their Irish words.
    s = s.replace(/(\d)\s?[°º]\s?C(?![\p{L}\p{M}])/giu, "$1 céim Celsius");
    s = s.replace(/(\d)\s?[°º]\s?F(?![\p{L}\p{M}])/giu, "$1 céim Fahrenheit");
    s = s.replace(/(\d)\s?[°º]\s?([NSEW])(?![\p{L}\p{M}])/giu,
        (_m, d: string, c: string) =>
            `${d} céim ${({ N: "ó thuaidh", S: "ó dheas", E: "soir", W: "siar" } as Record<string, string>)[c.toUpperCase()]!}`);
    s = s.replace(/(\d)\s?[°º](?![\p{L}\p{M}])/gu, "$1 céim");

    // 10) RATES — `70km/h`, `160km/u`, `35-40 msu`. The corpus's own prose "míle san uair" is text;
    //     the msu (míle san uair = mph) and km/u (ciliméadar san uair) forms need the words. AFTER the
    //     version-dot rule (12.8km has been claimed), BEFORE the tier.
    s = s.replace(/(?<!\d)(\d+)\s?(km|m|kg|mm|cm)\s*\/\s*(h|u)(?![\p{L}\p{M}])/giu,
        (m0, n: string, u: string, d: string) =>
            `${irishNumber(Number(n))} ${({ km: "ciliméadar", m: "méadar", kg: "cileagram", mm: "milliméadar", cm: "ceintiméadar" } as Record<string, string>)[u.toLowerCase()]!} san uair`);
    s = s.replace(/(?<!\d)(\d+)\s?msu(?![\p{L}\p{M}])/giu, (m0, n: string) =>
        `${irishNumber(Number(n))} míle san uair`);

    // 11) SIGNS. `+30°C` — the plus was dropped. `&` → *agus* (and). A TRUE minus (`-5`) reads "lúide";
    //     the corpus's `-\d` are all ranges/scores, now handled above. `%` → *faoin gcéad* (the tier).
    //     ⚠ ± TAKES THE CONJUNCTION, unlike most of the fleet, and that is a fact about what these two words
    //     ARE. `móide` and `lúide` are prepositional forms — "the more by", "the less by" — so juxtaposing them
    //     bare reads as two successive operations rather than one tolerance. Irish joins them with `nó`, which is
    //     this corpus's ×490-TOKEN word for "or", so the whole reading is built from vocabulary already here.
    //     `en` is the other language that needs the conjunction ("plus or minus"), and for the same reason:
    //     where the two halves are not sign NAMES, something has to mark them as alternatives.
    s = s.replace(/±/gu, " móide nó lúide ");
    s = s.replace(/\+\s?(?=\d)/gu, " móide ");
    s = s.replace(/(?<![\p{L}\p{Nd}])-(\d+)(?!\s*[-\d])/gu, "lúide $1");
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])/gu,
        (_m, a: string, b: string, pl: string) =>
            `${LETTER_NAME[a.toLowerCase()] ?? a} agus ${LETTER_NAME[b.toLowerCase()] ?? b}${pl}`);
    s = s.replace(/\s&\s/gu, " agus ");
    // The corpus's `B&Banna` (B&B + the -anna plural): the & between two caps with a following vowel run.
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(\p{Ll}+)(?![\p{L}\p{M}])/gu,
        (_m, a: string, b: string, tail: string) =>
            `${LETTER_NAME[a.toLowerCase()] ?? a} agus ${LETTER_NAME[b.toLowerCase()] ?? b}${tail}`);
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 ionann is $2");
    // THE DIVISION SIGN, the one sign this file still dropped. Sourced from FLEURS's parallel
    // aspect-ratio sentence, which performs a division aloud in 57 of its 67 languages — the Irish translator
    // wrote "roinnt ar a dó dhéag" ("divided by twelve"), i.e. a recording of a human reading the operation
    // with a numeral operand. ga.wikipedia corroborates the same form (x1); the participle `roinnte ar` is x0,
    // so the attested shape is the one shipped rather than the tidier-looking one.
    s = s.replace(/(\S)\s*÷\s*(\S)/gu, "$1 roinnt ar $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 níos lú ná $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 níos mó ná $2");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 faoi $2");
    // A PERCENT after a DECIMAL — `3.5%`. The dot rule has converted the number to words by now, so the
    // tier's digit-adjacent % would miss it; claim the word-form percent here (the Fula decimal-percent
    // leak). The bare-digit `%` is the tier's.
    s = s.replace(/([\p{L}\p{M}\d]+ pointe [\p{L}\p{M} ]+?)\s*%\s*(?![\p{L}\p{M}])/gu, "$1 faoin gcéad");

    // 12) INITIALISMS, LAST of the letter rules: it must run after the era markers (else A.D. → *a.
    //     dé.*) and after the dotted-capital rule.
    s = normalizeInitialisms(s);

    return s;
}
