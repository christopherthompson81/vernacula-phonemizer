/**
 * Norwegian Bokmål (nb) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the
 * Norwegian g2p cannot already read into Norwegian words the existing pipeline speaks. Pure text→text,
 * no IPA. Runs inside norwegian.ts's `text()`, before the tokenizer.
 *
 * MEASURED OVER THE FLEURS nb_no CORPUS, column 3 (the ORIGINAL cased text):
 *   ordinal dot   N.       278 total, 134 before a lowercase word   ← the largest defect
 *   clock         HH:MM     45 (colon) + 24 (period — NOT a clock, see below)
 *   space-grouped N NNN     42        ranges N–N              40
 *   decimal comma N,N       34 (+ 5 English-grouped, see below)
 *   percent       N %       15        squared units  km²       8
 *   degrees       N °        2
 *
 * EVERY WORD EMITTED BELOW IS IN THE NST LEXICON at reference quality — komma, prosent, grader, celsius,
 * kvadratkilometer, klokka, minus, til — so each phonemizes like any other word rather than through the
 * rule fallback. Checked before authoring, not assumed.
 *
 * ⚠ THREE MEASURED DISAMBIGUATIONS, each of which a plausible rule gets wrong:
 *
 *   1. THE PERIOD FORM IS NOT A CLOCK. `HH.MM` looks like the Norwegian written clock and 24 instances
 *      occur, but reading them shows they are DATES (`24.08.2021`, `17.09.1939`, `10.06.1940`), technical
 *      strings (`802.11n`), a duration (`1:09.02`) and an English-style decimal (`9.174 mi²`). Exactly one
 *      is a clock. So only the COLON form is claimed here; a period between digits is left alone.
 *
 *   2. A COMMA IS THE DECIMAL SEPARATOR — except where it is not. 34 instances are decimals (1,2 · 12,8 ·
 *      14,5), and 5 are English-style THOUSANDS grouping that survived translation (23,764 · 291,773 ·
 *      755,688 — all large, all exactly three digits after the comma). Splitting on that shape gets both
 *      right. The residual risk is a genuine Norwegian decimal with exactly three places, which would be
 *      de-grouped; the corpus contains none, and the trade is 5 correct against 0 broken.
 *
 *   3. THE ORDINAL DOT NEEDS A FOLLOWING LOWERCASE WORD. `N.` is an ordinal (15. århundre, 9. august,
 *      6. plass) but is also how a sentence ends after a year. Counted: 134 before a lowercase word,
 *      13 before a capital. Norwegian month names are LOWERCASE, so every date is caught by the lowercase
 *      guard while sentence ends — which are followed by a capital — are not.
 *
 * ORDERING, each constraint a bug that happened:
 *   · DE-GROUPING FIRST (both space and comma forms), before anything reads a bare number — `5 000 000`
 *     read as "fem null null" and `1 250` as "en to hundre femti", i.e. one numeral spoken as two.
 *   · THE COMMA-GROUPED form before the DECIMAL rule, or `23,764` becomes "tjuetre komma sju seks fire".
 *   · DEGREES before the unit rule, or the C of `20 °C` is read as the English letter name [seː].
 */
import { MANIFEST } from "./manifest.ts";

import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { tr } from "../../core/provenance.ts";

/**
 * THE SHARED SYMBOL TIER, adopted for UNITS AND RATES only.
 *
 * WHY THIS LANGUAGE HAD NONE. Norwegian predates the tier and reads its unit abbreviations from the LEXICON,
 * which handles a TOKEN and can never compose across a slash — so `5 km` was right while a rate's denominator
 * reached the IPA as an ENGLISH LETTER NAME (`133 m/s` → …ˈɛm ˈɛs, both letters).
 *
 * DECLARED: km/m for the numerator, the two denominators, and `mm`. Every word is the corpus's own —
 * kilometer ×15, meter ×9, `i timen` ×9 ("35–40 amerikanske mil i timen (56–64 km/t)"), `i sekundet` ×2 —
 * and `km`/`kilometer` phonemize IDENTICALLY, so the plain reading is untouched.
 *
 * `mm` IS DECLARED TO FIX A DEFECT, not to add a reading: the lexicon reads the bare abbreviation as the
 * GEMINATE [mː], and this corpus writes `mm` ×10 (`35 mm`, `36 mm`). The word `millimeter` is ×0 here, so the
 * justification is not frequency — it is that this engine ALREADY pronounces `millimeter` correctly
 * (ˈmɪlɪˌmeːtəɾ) and [mː] is not a reading of anything. `cm` is already right from the lexicon and stays
 * there; `kg` → ˈçiːlʊ ("kilo") is ordinary Norwegian and is left alone.
 *
 * ⚠ THE ABBREVIATION IS `km/t` — Norwegian `t` is *time* (hour) — and the corpus writes it that way. Both
 * `t` and `h` are declared, for the same reason Danish declares both.
 */
const SYMBOLS = makeSymbolNormalizer({
    // `multiply` — this language's OWN word, harvested from its existing `×` rule, so nothing new is
    // sourced. Declaring it here is what makes ASCII `x` read like `×`: `6x6 cm` read the `x` as a LETTER NAME,
    // and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` defaults to it.
    multiply: { times: "ganger" },
    // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
    // `og` ×1135 in this corpus. The tier spaces it on both sides, because `B&B` is two
    // initialisms and joining them would make one token.
    ampersand: "og",
    // `percent` is REQUIRED by SymbolData. The local rule above already claims every `%`, so this
    // never fires — but it is the corpus's own word and declaring it lets review.ts's sourcing check
    // see it, which it cannot do for a word that only exists inside a `.replace()`.
    percent: ["prosent"],
    units: { km: ["kilometer"], m: ["meter"], mm: ["millimeter"] },
    unitPer: "i",
    rateDenominators: { t: "timen", h: "timen", s: "sekundet" },
});

/** Read from the manifest — see the jsonc, where the evidence lives. */
const ORDINALS = MANIFEST.ordinals;

/** Month names, 1-indexed. All twelve are ordinary Norwegian words and lowercase — which is also what
 *  makes the ordinal-dot guard in step 10 catch every written date. */
const MONTHS: readonly (string | undefined)[] = [
    undefined, "januar", "februar", "mars", "april", "mai", "juni",
    "juli", "august", "september", "oktober", "november", "desember",
];

/**
 * Dotted abbreviations that occur, longest first. The dot is CONSUMED — it is an abbreviation dot, not a
 * sentence end, and it was reaching clausePunctuation as a full stop mid-phrase.
 *
 * ⚠ `ca.` IS THE MOST FREQUENT MEMBER OF THIS TABLE AND WAS THE ONE MISSING FROM IT. 21 instances in
 * nb_no against `osv.` 10, `kl.` 10, `nr.` 5, `dr.` 3, `bl.a.` 2, `dvs.` 1 — every one of which was
 * already here. The word itself read fine (the lexicon maps the token `ca` to [ˈsɪɾkɑ]); it was the DOT
 * that survived, so `ca. én amerikansk cent` — a line of the parity golden — read *ˈsɪɾkɑ . ˈeːn*, the
 * mid-phrase full stop this table exists to remove. `cirka` and `ca` are the same reading in the lexicon.
 *
 * ⚠ AND THE ERA MARKER, which was not merely unread but read as MONEY. `f.Kr.` tokenized as `f` + `Kr`,
 * and `kr` is the lexicon's currency abbreviation — so `323 f.Kr. etter at…` read *ˈɛf . ˈkɾuːnəɾ .*,
 * "eff kroner" plus two spurious clause breaks. 12 instances across nb_no in four spellings (`f.Kr.`,
 * `f.Kr`, `f.kr`, and once `f.Kr!` where the sentence ends in an exclamation), with `e.Kr.`/`e.kr` for the
 * common era. The trailing dot is OPTIONAL and a trailing LETTER is refused, or `f. Kristian` would be
 * claimed; both words of each expansion are in the NST lexicon (før, etter, Kristus).
 */
const ABBREV: [RegExp, string][] = [
    [/\bf\.kr\.?(?![\p{L}\p{M}])/giu, "før Kristus"],
    [/\be\.kr\.?(?![\p{L}\p{M}])/giu, "etter Kristus"],
    [/\bca\./giu, "cirka"],
    [/\bkl\./giu, "klokka"],
    [/\bdvs\./giu, "det vil si"],
    [/\bbl\.a\./giu, "blant annet"],
    [/\bf\.eks\./giu, "for eksempel"],
    [/\bosv\./giu, "og så videre"],
    [/\bnr\./giu, "nummer"],
    [/\bdr\./giu, "doktor"],
    // ⚠ `jr.` READ AS A BARE ONSET CLUSTER, *jɾ*, plus the stranded stop — no vowel, so not even a word. ×3
    // in nb_no, every one the name suffix (`Piquet jr.`, `Truex, jr.`, `n. wayne hale jr.`), and `junior` is
    // in the NST lexicon. ⚠ `sr.` is NOT added beside it: ×0 here, and `senior` on zero attestation is the
    // #955 invention. `m.` (×2, `James m. flere` = *med flere*) stays out for the opposite reason — it is
    // genuinely ambiguous with a lone initial and with the metre abbreviation.
    [/\bjr\./giu, "junior"],
];

/**
 * Currency SIGN → the Norwegian word. Every word is in the NST lexicon.
 *
 * `kr` is deliberately ABSENT. Norwegian postposes it (`10 kr`), so a sign-before-amount rule could never
 * fire on it — and it already reads correctly, because the lexicon maps the token `kr` straight to
 * [ˈkɾuːnəɾ]. An entry that can never match is worse than no entry: it reads as coverage.
 */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "dollar", "€": "euro", "£": "pund", "¥": "yen",
};

/** Squared / cubed units. Norwegian compounds them into ONE word — kvadratkilometer, not "kvadrat
 *  kilometer" — and the modifier PRECEDES the unit, like the Burmese case and unlike the percent word. */
const SQUARED: [RegExp, string][] = [
    [/\bkm\s*²/giu, "kvadratkilometer"],
    [/\bm\s*²/giu, "kvadratmeter"],
    [/\bcm\s*²/giu, "kvadratcentimeter"],
    [/\bm\s*³/giu, "kubikkmeter"],
];

export function normalizeNorwegian(input: string): string {
    let t = input;

    // 1) SPACE-GROUPED THOUSANDS (42), FIRST. A space is a token boundary, so `5 000 000` reached the
    //    number path as three separate numerals and read "fem null null". Includes NBSP and the narrow
    //    NBSP, which is what a typesetter actually emits.
    let prev: string;
    do {
        prev = t;
        t = tr(t, /(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))/gu, "");  // space, NBSP, NNBSP, thin space
    } while (t !== prev);

    // 2) ENGLISH-STYLE COMMA GROUPING (5) — before the decimal rule, which would otherwise read 23,764 as
    //    "tjuetre komma sju seks fire". Exactly three digits and no more; see disambiguation 2 in the header.
    do {
        prev = t;
        t = tr(t, /(?<=\d)(?<!(?<![\d\.,])0)[,](?=\d{3}(?!\d))/gu, "");
    } while (t !== prev);

    // 3) DECIMAL COMMA (34). The comma is clause punctuation, so `12,5` read as "tolv , fem" — a PAUSE
    //    inside a number. The fractional part is spoken digit by digit.
    t = tr(t, /(\d+),(\d+)/gu, (_m, whole: string, frac: string) =>
        `${whole} komma ${[...frac].join(" ")}`);

    // 4) CLOCK, COLON FORM ONLY (45). The colon is not in clausePunctuation, so it vanished and `14:30`
    //    read as two unrelated numerals. The period form is left alone — disambiguation 1 in the header.
    t = tr(t, /(\d{1,2}):(\d{2})(?!\d)/gu, "$1 $2");

    // 5) ABBREVIATIONS, dot consumed. After the clock so `kl. 14:30` still has its time intact.
    for (const [re, word] of ABBREV) t = tr(t, re, word);

    // 6) PERCENT (15). Norwegian postposes the word, and the sign was dropped outright.
    t = tr(t, /(\d+)\s*%/gu, "$1 prosent");

    // 7) DEGREES (2), BEFORE the unit rules — the C of `20 °C` was falling through to the English letter
    //    name [seː]. Case-insensitive on the scale letter; the bare sign is read too.
    t = tr(t, /℃/gu, "°C").replace(/℉/gu, "°F");
    t = tr(t, /(\d)\s*°\s*C(?![\p{L}])/giu, "$1 grader celsius");
    t = tr(t, /(\d)\s*°\s*F(?![\p{L}])/giu, "$1 grader fahrenheit");
    t = tr(t, /(\d)\s*°/gu, "$1 grader");

    // 8) SQUARED / CUBED UNITS (8). The exponent was dropped outright, so `23 764 km²` lost its area.
    for (const [re, word] of SQUARED) t = tr(t, re, word);

    // 9) NUMERIC DATES `D.M.YYYY` (7 distinct: 05.09.2021, 10.06.1940, 17.09.1939, 24.08.2021). Read as
    //    ordinal day + month NAME + year, which is how the date is spoken — the digits alone gave
    //    "tjuefire . åtte . to tusen tjueen", three numerals separated by two sentence breaks. This must
    //    run BEFORE the ordinal-dot rule below, which would otherwise claim the day and leave `.08.2021`
    //    stranded, and it is the reason the period form was excluded from the clock rule in step 4.
    t = tr(t, /(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/gu, (m, d: string, mo: string, y: string) => {
        const day = ORDINALS[String(Number(d))], month = MONTHS[Number(mo)];
        return day !== undefined && month !== undefined ? `${day} ${month} ${y}` : m;
    });

    // 10) ORDINAL RANGES — `10.–11. århundre`, a range whose ENDS are ordinals. BEFORE the ordinal-dot
    //     rule, which would otherwise claim `10.` (its lookahead sees the dash, not a lowercase word, so
    //     in fact it declines) and before the cardinal range rule, which sees `10.` and `11.` as
    //     malformed numbers and matched neither. So the pattern fell between two rules and was read as
    //     "ti . ellevte" — a bare cardinal, a sentence break, then an ordinal.
    //     Not a Norwegian quirk: attested in every ordinal-dot orthography checked (nb 2, da 2, de 1,
    //     cs 1), which is why it also became a cell in the miner.
    t = tr(t, /(?<!\d)(\d{1,2})\.\s*[-–—]\s*(\d{1,2})\.(?=\s+\p{Ll})/gu, (m, a: string, b: string) => {
        const first = ORDINALS[String(Number(a))], second = ORDINALS[String(Number(b))];
        return first !== undefined && second !== undefined ? `${first} til ${second}` : m;
    });

    // 11) ORDINAL DOT (134) — the largest defect in the language. `3. mai` read as "tre" + a SENTENCE
    //    BREAK + "mai". The following-lowercase guard is what separates it from a sentence ending in a
    //    year; see disambiguation 3 in the header.
    t = tr(t, /(?<!\d)(\d{1,2})\.(?=\s+\p{Ll})/gu, (m, n: string) => ORDINALS[n] ?? m);

    // 12) RANGES (40). A dash between numerals is spoken `til`. After the clock and the ordinal rules so
    //     it cannot claim their separators.
    t = tr(t, /(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)/gu, "$1 til $2");

    // 13) CURRENCY. The sign PRECEDES the amount in writing and the word FOLLOWS it in speech, as in
    //     English. All five words are in the NST lexicon (kroner, dollar, euro, pund, yen); the corpus
    //     carries ¥ only (3 instances, all `¥N`), and the sign was dropped outright so the amount read as
    //     a bare number. The others are included because a phonemizer is handed arbitrary text, not only
    //     this corpus — a phonemizer is handed arbitrary text, not only a corpus.
    //     ⚠ THE AMOUNT MAY NOT END IN A SPACE. `(\d[\d ]*)` is greedy over spaces with nothing after it to
    //     force a backtrack, so it swallowed the space SEPARATING the amount from the next word — and the
    //     currency noun was then written where that space had been. The corpus's own sentence
    //     `mellom ¥2500 og ¥130 000` read *ˈyːənɔɡ*, "yenog" as ONE token (and, being no longer a lexicon
    //     word, with the wrong vowel too); the `¥130 000,` beside it was right only because a COMMA followed.
    //     All four signs had it. The amount now has to end in a digit.
    for (const [sign, word] of Object.entries(CURRENCY))
        t = tr(t, new RegExp(`${sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*(\\d(?:[\\d ]*\\d)?)`, "gu"), `$1 ${word}`);

    // 14) SIGNED NUMBERS. A bare `+` before a number is a POSITIVE sign and was dropped outright —
    //     `+30°C` read as plain "tretti grader" and `UTC +1` lost the offset entirely. Measured, the plus
    //     is the MORE common half of this category (5 in nb_no against 1 minus), which is why the miner's
    //     cell now covers both signs rather than the minus alone. Both words are in the NST lexicon.
    //     ⚠ Runs AFTER ranges, so a range's dash is already gone, and requires a boundary before the sign
    //     so a hyphenated compound is untouched. Norwegian does write a bare negative temperature, and
    //     `minus` is in the lexicon.
    t = tr(t, /(?<![\p{L}\d])([-−+])(\d+)/gu, (_m, sign: string, n: string) =>
        `${sign === "+" ? "pluss" : "minus"} ${n}`);

    // 15) ARITHMETIC AND RELATIONAL SIGNS — infix between digits, which is simply where arithmetic lives
    //     (`3+1 gassturbiner`). The signed-number rule in step 14 handles the OTHER position: a sign
    //     PREFIXED to a number (`+30°C`, `UTC +1`), which is a different meaning of the same character
    //     and needs a boundary before it so a hyphenated compound is left alone. Two positions, two
    //     rules; neither is an edge case.
    //
    //     `=` IS READ, INCLUDING IN A GLOSS, and this is applied in EVERY position rather than only
    //     between digits. The corpus's four instances are label expansions — IUCN Red List categories,
    //     `EX = Utryddet`, `DD = Mangelfullt datagrunnlag` — and the first instinct was to leave them, on
    //     the grounds that a reader does not say "er lik" there. That was wrong: the sign was being
    //     DROPPED, so the listener heard "EX Utryddet" with no separation at all. A slightly formal
    //     reading is strictly better than an inaudible one, and it is what every English TTS does with
    //     `=` regardless of context. The comparison signs get the same treatment for the same reason,
    //     though none occurs in this corpus — a phonemizer is handed arbitrary text, and silence is the
    //     one option that cannot be right. All the words are in the NST lexicon.
    const RELATIONAL: [RegExp, string][] = [
        [/±/gu, " pluss minus "],
        [/≈/gu, " omtrent lik "],
        [/≤/gu, " mindre enn eller lik "],
        [/≥/gu, " større enn eller lik "],
        [/=/gu, " er lik "],
        [/</gu, " mindre enn "],
        [/>/gu, " større enn "],
        [/×/gu, " ganger "],
        [/÷/gu, " delt på "],
    ];
    t = tr(t, /(\d)\s*\+\s*(\d)/gu, "$1 pluss $2");
    for (const [re, word] of RELATIONAL) t = tr(t, re, word);
    // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
    t = tr(t, /[ \t]{2,}/gu, " ");

    // THE SHARED TIER LAST, so every local rule above has already claimed its own text — the squared
    // compounds in particular, which the tier has no word for in this language.
    return SYMBOLS(t);
}
