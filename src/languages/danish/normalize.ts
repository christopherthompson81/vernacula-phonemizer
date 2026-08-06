/**
 * Danish (da) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Danish g2p
 * cannot already read into Danish words the existing pipeline speaks. Pure text→text, no IPA. Runs inside
 * danish.ts's `text()`, before the tokenizer.
 *
 * MEASURED OVER THE FLEURS da_dk CORPUS, column 3 (the ORIGINAL cased text):
 *   ordinal dot     N.      112 before a lowercase word (8 before a capital)   ← the largest defect
 *   period-grouped  N.NNN    99      decimal comma  N,N   35      colon clock  HH:MM  33
 *   ranges          N–N      16      percent        N %   27 (as the word)
 *   abbreviations           84      km²                    3      degrees             3
 *
 * EVERY WORD EMITTED BELOW IS IN THE da-lexicon at reference quality — procent, komma, grader, celsius,
 * kvadratkilometer, klokken, minus, plus, lig, med, og, til — and the four ordinals it lacks (sekstende,
 * syttende, attende, nittende) were PROBED through the rule g2p rather than assumed: [sˈekstenə],
 * [sˈytenə], [ˈatenə], [nˈitenə].
 *
 * ⚠ DANISH IS NOT NORWEGIAN, and the differences are the whole reason this file was measured separately
 * rather than adapted from nb/normalize.ts written hours earlier:
 *
 *   1. THE PERIOD IS A THOUSANDS SEPARATOR (99 instances: 330.000 · 7.000 · 24.000) — the German
 *      convention. In Norwegian the same shape was a DATE (24.08.2021) and got a date rule; here a date
 *      rule would corrupt every large number. Danish writes NO `D.M.YYYY` dates at all in this corpus.
 *   2. THERE IS NO SPACE GROUPING. Norwegian's largest numeric defect was `5 000 000` read as three
 *      numerals (42 instances); Danish has ZERO, so that rule is absent here rather than copied.
 *   3. THE COMMA IS PURELY DECIMAL. Norwegian carried 5 English-style thousands groupings that survived
 *      translation and needed a guard; Danish has 35 decimals and none of those, so no guard is needed.
 *
 *   What DOES transfer is the ordinal-dot guard: 112 before a lowercase word against 8 before a capital,
 *   the same ratio and the same reason (Danish month names are lowercase, so every date is caught while
 *   a sentence ending in a year is not).
 *
 * ⚠ NO PERIOD-CLOCK RULE. `HH.MM` is the Danish written clock and 17 instances of the shape occur — but
 * they are `802.11a`, `802.11b`, `802.11g`, `802.11n`, i.e. one technical identifier repeated, plus a
 * single genuine `15.00 UTC`. Claiming the shape would rewrite the standard's name four times to fix one
 * clock. The colon form (33) carries the real clocks and is claimed instead. Same conclusion as Norwegian
 * for a completely different reason — there the shape was dates, here it is a Wi-Fi standard.
 */

import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * THE SHARED SYMBOL TIER, adopted for UNITS AND RATES only.
 *
 * WHY THIS LANGUAGE HAD NONE. Danish predates the tier and reads its unit abbreviations from the LEXICON
 * (`da-lexicon.tsv` maps `km` → kiloˈmeːˀdɐ). That works for a TOKEN and can never compose across a slash,
 * which is why `5 km` was right while the denominator of a rate reached the IPA as an ENGLISH LETTER NAME:
 *   120 km/h → …kiloˈmeːˀdɐ + `h` as a letter      133 m/s → …ˈɛm ˈɛs, BOTH as letters
 * A hand-written table covers the single substitutions and omits the COMPOSED ones; the tier matches
 * number + unit + denominator in one pass, which is the whole reason to reach for it here.
 *
 * DECLARED, and no more: km/m for the numerator plus the two denominators. Every word is the corpus's own —
 * kilometer ×8, meter ×4, `i timen` ×7 ("3000 mil i timen"), `i sekundet` ×3 ("1,5 kilometer i sekundet") —
 * and `km`/`kilometer` phonemize IDENTICALLY here, so declaring the numerator leaves the plain reading
 * untouched while making the rate reachable.
 *
 * ⚠ `cm`, `mm` and `kg` ARE LEFT TO THE LEXICON on purpose. Their words are ×0 in this corpus, the lexicon
 * already reads cm and mm correctly, and routing `cm` through the word path would MOVE ITS STRESS
 * (ˈsɛntiˌmeːˀdɐ → sɛntiˈmeːˀdɐ) for no gain. `kg` → ˈkilo is the lexicon's too, and "kilo" for a kilogram is
 * ordinary Danish, so it is left alone rather than "corrected" on no evidence.
 *
 * ⚠ THE ABBREVIATION IS `km/t`, NOT `km/h` — Danish `t` is *time* (hour), and this corpus writes `km/t` ×8
 * against `km/h` ×0. Both are declared: `t` is what the language writes, `h` is what foreign-sourced text
 * hands it, and the reading is the same either way.
 */
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — this language's OWN word, harvested from its existing `×` rule, so nothing new is
    // sourced. Declaring it here is what makes ASCII `x` read like `×`: `6x6 cm` read the `x` as a LETTER NAME,
    // and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` defaults to it.
    multiply: { times: "gange" },
    // `percent` is REQUIRED by SymbolData. The local rule above already claims every `%`, so this
    // never fires — but it is the corpus's own word and declaring it lets review.ts's sourcing check
    // see it, which it cannot do for a word that only exists inside a `.replace()`.
    percent: ["procent"],
    units: { km: ["kilometer"], m: ["meter"] },
    unitPer: "i",
    rateDenominators: { t: "timen", h: "timen", s: "sekundet" },
});

/**
 * ORDINALS 1–31. Danish builds 21–29 units-first (enogtyvende, "one-and-twentieth"), matching the
 * cardinal system in unitsFirstNumbers.ts.
 */
const ORDINALS: Readonly<Record<string, string>> = {
    "1": "første", "2": "anden", "3": "tredje", "4": "fjerde", "5": "femte",
    "6": "sjette", "7": "syvende", "8": "ottende", "9": "niende", "10": "tiende",
    "11": "ellevte", "12": "tolvte", "13": "trettende", "14": "fjortende", "15": "femtende",
    "16": "sekstende", "17": "syttende", "18": "attende", "19": "nittende", "20": "tyvende",
    "21": "enogtyvende", "22": "toogtyvende", "23": "treogtyvende", "24": "fireogtyvende",
    "25": "femogtyvende", "26": "seksogtyvende", "27": "syvogtyvende", "28": "otteogtyvende",
    "29": "niogtyvende", "30": "tredivte", "31": "enogtredivte",
};

/** Dotted abbreviations (84 in the corpus). The dot is CONSUMED — it is an abbreviation dot, not a
 *  sentence end, and it was reaching clausePunctuation as a full stop mid-phrase. */
const ABBREV: [RegExp, string][] = [
    [/\bkl\./giu, "klokken"],
    [/\bbl\.a\./giu, "blandt andet"],
    [/\bf\.eks\./giu, "for eksempel"],
    [/\bdvs\./giu, "det vil sige"],
    [/\bosv\./giu, "og så videre"],
    [/\bnr\./giu, "nummer"],
    [/\bdr\./giu, "doktor"],
];

/** Squared / cubed units. Danish compounds them into ONE word, modifier first. */
const SQUARED: [RegExp, string][] = [
    [/\bkm\s*²/giu, "kvadratkilometer"],
    [/\bm\s*²/giu, "kvadratmeter"],
    [/\bcm\s*²/giu, "kvadratcentimeter"],
    [/\bm\s*³/giu, "kubikmeter"],
];

/**
 * Currency SIGN → the Danish word.
 *
 * ⚠ DANISH POSTPOSES THE SIGN — `1000$`, `5$ og 100$`, `11.000 US$` — 8 postposed against 2 preposed,
 * the opposite of English. A sign-before-amount rule alone (which is what Norwegian needed) fires on the
 * minority and leaves the majority silent, so both positions are claimed. `kr` is still absent: it is a
 * WORD the lexicon already reads, not a sign.
 */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "dollar", "€": "euro", "£": "pund", "¥": "yen",
};

/** Relational and operator signs. Read in every position — a dropped sign is inaudible, which is the one
 *  outcome that cannot be right; see the equivalent note in norwegian/normalize.ts. */
const RELATIONAL: [RegExp, string][] = [
    [/±/gu, " plus minus "],
    [/≈/gu, " cirka lig med "],
    [/≤/gu, " mindre end eller lig med "],
    [/≥/gu, " større end eller lig med "],
    [/=/gu, " lig med "],
    [/</gu, " mindre end "],
    [/>/gu, " større end "],
    [/×/gu, " gange "],
    [/÷/gu, " divideret med "],
];

export function normalizeDanish(input: string): string {
    let t = input;

    // 1) PERIOD-GROUPED THOUSANDS (99), FIRST — before anything reads a bare number, and before the
    //    ordinal-dot rule. The period is clause punctuation, so `330.000` read as "330" then a SENTENCE
    //    BREAK then "000". Exactly three digits and no more, which is what separates grouping from the
    //    `802.11` technical shape.
    let prev: string;
    do {
        prev = t;
        t = t.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");
    } while (t !== prev);

    // 2) DECIMAL COMMA (35). The comma is clause punctuation too, so `12,5` read as "tolv , fem" — a
    //    PAUSE inside a number. Fractional part spoken digit by digit. No English-grouping guard is
    //    needed here, unlike Norwegian; see difference 3 in the header.
    t = t.replace(/(\d+),(\d+)/gu, (_m, whole: string, frac: string) =>
        `${whole} komma ${[...frac].join(" ")}`);

    // 3) CLOCK, COLON FORM ONLY (33). The period form is a Wi-Fi standard — see the header.
    t = t.replace(/(\d{1,2}):(\d{2})(?!\d)/gu, "$1 $2");

    // 4) ABBREVIATIONS (84), dot consumed. After the clock so `kl. 14:30` keeps its time.
    for (const [re, word] of ABBREV) t = t.replace(re, word);

    // 5) PERCENT. Postposed, and the sign was dropped outright.
    t = t.replace(/(\d+)\s*%/gu, "$1 procent");

    // 6) DEGREES (3), BEFORE the unit rules — the C of `20 °C` was falling through to the English letter
    //    name [seːˀ]. Case-insensitive on the scale letter; the bare sign is read too.
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(/(\d)\s*°\s*C(?![\p{L}])/giu, "$1 grader celsius");
    t = t.replace(/(\d)\s*°\s*F(?![\p{L}])/giu, "$1 grader fahrenheit");
    t = t.replace(/(\d)\s*°/gu, "$1 grader");

    // 7) SQUARED / CUBED UNITS (3). The exponent was dropped, losing the area.
    for (const [re, word] of SQUARED) t = t.replace(re, word);

    // 8) ORDINAL RANGES — `10.-11. århundrede`, a range whose ENDS are ordinals. BEFORE the ordinal-dot
    //    rule and before the cardinal range rule, neither of which claims it; the corpus has one, and it
    //    is the same construction found in nb, de and cs.
    t = t.replace(/(?<!\d)(\d{1,2})\.\s*[-–—]\s*(\d{1,2})\.(?=\s+\p{Ll})/gu, (m, a: string, b: string) => {
        const first = ORDINALS[String(Number(a))], second = ORDINALS[String(Number(b))];
        return first !== undefined && second !== undefined ? `${first} til ${second}` : m;
    });

    // 9) COORDINATED ORDINALS — `1. og 3. New Hampshire`. The lowercase guard below claims the first
    //    (followed by `og`) and declines the second (followed by a proper noun), which produced the
    //    inconsistent "første og 3.". A coordinator between two dotted numbers makes both ordinals
    //    regardless of what follows, so the pair is claimed together.
    t = t.replace(/(?<!\d)(\d{1,2})\.\s+(og|eller)\s+(\d{1,2})\./gu, (m, a: string, conj: string, b: string) => {
        const first = ORDINALS[a], second = ORDINALS[b];
        return first !== undefined && second !== undefined ? `${first} ${conj} ${second}` : m;
    });

    // 10) ORDINAL DOT (112) — the largest defect. `3. maj` read as "tre" + a SENTENCE BREAK + "maj". The
    //    following-lowercase guard separates it from a sentence ending in a year (8 such).
    t = t.replace(/(?<!\d)(\d{1,2})\.(?=\s+\p{Ll})/gu, (m, n: string) => ORDINALS[n] ?? m);

    // 11) RANGES (16). A dash between numerals is spoken `til`.
    t = t.replace(/(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)/gu, "$1 til $2");

    // 12) CURRENCY, in BOTH positions — Danish postposes the sign 8 times against 2 preposed. The digit
    //     group is `\d+` and not `\d[\d ]*`: the looser class ate the SPACE after the amount, so
    //     `¥2.500 og` became "2500 yenog" with the following word fused on.
    //     A CURRENCY CODE can carry the sign instead of a digit — `US$` (7), `AUD$` (1) — so the sign
    //     follows LETTERS and neither digit-anchored pattern fires. The code itself is left for the
    //     initialism pass to spell out; only the sign becomes a word.
    t = t.replace(/\b([A-Z]{2,3})\s*\$/gu, "$1 dollar");
    for (const [sign, word] of Object.entries(CURRENCY)) {
        const esc = sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        t = t.replace(new RegExp(`(\\d+)\\s*${esc}`, "gu"), `$1 ${word}`);
        t = t.replace(new RegExp(`${esc}\\s*(\\d+)`, "gu"), `$1 ${word}`);
    }

    // 13) SIGNED NUMBERS — a sign PREFIXED to a number (`+30 °C`, `-5 grader`). Needs a boundary before
    //     it so a hyphenated compound is untouched, and runs after ranges so a range's dash is gone.
    t = t.replace(/(?<![\p{L}\d])([-−+])(\d+)/gu, (_m, sign: string, n: string) =>
        `${sign === "+" ? "plus" : "minus"} ${n}`);

    // 14) ARITHMETIC AND RELATIONAL SIGNS — infix between digits is where arithmetic lives; the
    //     relational signs are read in every position, because a dropped sign is inaudible.
    t = t.replace(/(\d)\s*\+\s*(\d)/gu, "$1 plus $2");
    for (const [re, word] of RELATIONAL) t = t.replace(re, word);

    // 15) AMPERSAND → og. It was dropped outright, so `A&B` read as two unrelated letters.
    t = t.replace(/\s*[&＆]\s*/gu, " og ");

    // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
    t = t.replace(/[ \t]{2,}/gu, " ");

    // 16) THE SHARED TIER LAST, so every local rule above has already claimed its own text — the squared
    //     compounds in particular, which the tier has no word for in this language.
    return SYMBOLS(t);
}
