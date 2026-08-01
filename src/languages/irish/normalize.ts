/**
 * Irish (ga) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the 1,944 unique cased ga_ie FLEURS utterances (column 3):
 *   `Nú` ordinals ×~40 (7ú, 11ú, 12ú, 13ú, 15ú, 18ú, 20ú, 60ú, 25ú — the corpus's own ordinal digits;
 *     the prose spells "an chéad"/"an dara"/"an tríú")
 *   comma-thousands ×32 (1,400, 400,000, 19,500, 5,000,000) + dot-decimals (1.5, 4.2-3.9)
 *   clocks ×19 (11:35 i.n., 8:30 p.m., 1:15 r.n. — i.n./r.n. = iarnóin/réamhnóin p.m./a.m.)
 *   era markers ×8 (400 A.D., 1000 R.C. — A.D. = tar éis Chríost, R.C. = roimh Chríost)
 *   rates ×8 (70km/h, 160km/u, 35-40 msu — msu = míle san uair mph, km/u = km/h)
 *   currency ×7 (US$14.7, ¥2,500, £27) · percent ×3 (faoin gcéad — the tier owns it)
 *   degrees ×2 (30°C, 35°W longitude) · fractions ×2 (29¾, 24½, 1/5)
 *   abbrev (N.A. = Náisiúin Aontaithe UN, S.A. = Stáit Aontaithe USA, Dr., etc.)
 *   initialisms ×128 (NHK, APS, KNP, PA, FIC, MS, XDR-TB, PSTN) · ranges ×14 · &amp; ×3
 *   zero-width ×18 (U+200B characters in the corpus)
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `1ú`           → `ˈa hˈeːn̪ˠ ˈuː`       the ordinal suffix read as the bare vowel "ú"
 *   `190ú`         → `cˈeːd̪ˠ n̪ˠˈoːxə ˈuː`   the ordinal suffix read as "ú"
 *   `1,400`        → `ˈa hˈeːn̪ˠ , cˈɛhɾʲə çˈeːd̪ˠ`  the comma-thousands became a pause
 *   `11:35 i.n.`   → `… pˠ . mˠ .`          the colon pause + [i.n.] letter-spelled
 *   `400 A.D.`     → `… ˈad̪ˠ`               the era marker read as "ad"
 *   `1000 R.C.`    → `… bˠk`                the era marker read as the cluster [bk]
 *   `1.5 million`  → `ˈa hˈeːn̪ˠ . ˈa kˈuːɟ`  the dot-decimal became a pause
 *   `160km/h`      → `… cˈɪlʲəmʲeːd̪ˠəɾˠ h`   the rate read the /h as a letter
 *   `30°C`         → `tʲɾʲˈiːxə k`          the degree dropped to [k]
 *   `B&Banna`      → the & dropped
 *   `BBC`          → [bˠk]  `IRL` → [ˈɪɾʲl̪ˠ]  `GAA` → [ɡˈaə]  initialisms as clusters
 *
 * WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text
 * so the word path stresses them; the comma-thousands and dot-decimal stay DIGITS so the shared symbol
 * tier can still see the number adjacent to its unit/sign — the tier is composed AFTER this pass in
 * irish.ts, and the TOKEN swallows the separators (see irish.ts).
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

/** Ordinal words 1–10 (with the article "an" that the corpus's prose uses: "an chéad", "an dara").
 *  1–4 are irregular; 5–10 are the cardinal stem + -ú. Referee-attested through séú. */
const ORD_1_10: Readonly<Record<number, string>> = {
    1: "an chéad", 2: "an dara", 3: "an tríú", 4: "an ceathrú", 5: "an cúigiú",
    6: "an séú", 7: "an seachtú", 8: "an t-ochtú", 9: "an naoú", 10: "an deichiú",
};

/** Integer → the Irish ordinal (the corpus's `Nú` digit form). Below 10 the table; from 10 up the
 *  cardinal's last element takes the -ú ordinal ending (an fichiú = 20th, an seascadú = 60th,
 *  an cúigiú déag = 15th). Anything outside the compositor's range → undefined. */
export function ordinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1 || n >= 1e12) return undefined;
    if (n <= 10) return ORD_1_10[n];
    // 11–19: the unit ordinal + "déag" (an cúigiú déag = 15th, per the corpus's prose "aoinú háit déag").
    if (n < 20) return `${ORD_1_10[n - 10]} déag`;
    // 20+: the cardinal, with the LAST element ordinalised. Tens take the stem + -ú (fiche → fichiú,
    // seasca → seascadú); a compound keeps the unit ordinal on the last word.
    const card = irishNumber(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const words = card.split(" ");
    const last = words[words.length - 1]!;
    const ord = UNIT_ORD[last] ?? TENS_ORD[last];
    if (ord === undefined) return undefined;
    words[words.length - 1] = ord;
    return `an ${words.join(" ")}`;
}

/** The ordinal of a CARDINAL WORD when it ends a compound (from numbers.ts's emitted words). */
const UNIT_ORD: Readonly<Record<string, string>> = {
    aon: "aonú", dó: "dara", trí: "tríú", ceathair: "ceathrú", cúig: "cúigiú",
    sé: "séú", seacht: "seachtú", ocht: "ochtú", naoi: "naoú", deich: "deichiú",
};
const TENS_ORD: Readonly<Record<string, string>> = {
    fiche: "fichiú", tríocha: "tríochadú", daichead: "daicheadú", caoga: "caogadú",
    seasca: "seascadú", seachtó: "seachtódú", ochtó: "ochtódú", nócha: "nóchadú",
    céad: "céadú", míle: "míliú", milliún: "milliúna", billiún: "billiúna",
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
    s = s.replace(/(?<![\d.,])(\d[\d,]*)(ú)(?![\p{L}\p{M}])/giu, (m0, d: string, sfx: string) => {
        const n = Number(d.replace(/,/gu, ""));
        if (!Number.isFinite(n) || n < 1) return m0;
        const ord = ordinalWords(n);
        return ord === undefined ? m0 : ord;
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
        // A unit fraction (1/N) is the ordinal noun: 1/5 orlach → cúigiú orlach (a fifth of an inch).
        // A non-unit fraction (M/N) is "M N-ú" (two fifths = dhá chúigiú).
        return Number(a) === 1 ? ord : `${irishNumber(Number(a))} ${ord}`;
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
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 níos lú ná $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 níos mó ná $2");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 faoi $2");

    // 12) INITIALISMS, LAST of the letter rules: it must run after the era markers (else A.D. → *a.
    //     dé.*) and after the dotted-capital rule.
    s = normalizeInitialisms(s);

    return s;
}
