/**
 * Abkhaz (ab) TEXT NORMALIZATION — pure text→text, run inside the engine's `text()` before tokenization.
 * Rewrites what is not already a pronounceable word into words the existing g2p speaks.
 *
 * ⚠ EVERY RULE HERE IS CORPUS-EVIDENCED, and the counts are from `tools/corpus/mined/ab.jsonc` (an
 * ab.wikipedia dump, 17,209 paragraphs). Counts below are over the artifact's 208 excerpts / 81k chars,
 * which is the tier that carries real proportions because the artifact is dump-sourced.
 *
 * ⚠ WHAT THE ENGINE DID BEFORE, measured rather than assumed — this is the defect list the rules answer:
 *     11,3 км      → ʒʷejza , χpʰa kʼm     the decimal comma became a CLAUSE PAUSE mid-number
 *     125 000      → …χʷba anolʲ           the group split, and 000 read as the WORD zero
 *     2005-2011    → …χʷba …ʒʷejza         the range hyphen vanished, two bare numbers
 *     6-тәи        → fba tʷʼi              the ordinal suffix became a separate word
 *     1452ш.       → …ʂ .                  the abbreviation read as a bare letter, its dot a pause
 * Roman numerals already work through the shared `core/roman.ts` seam (XX → ҩажәа), so they are not here.
 *
 * ORDER IS LOAD-BEARING; each step states its coupling.
 *
 * ⚠ THE SYMBOL VOCABULARY (percent, degrees, currency, км², the clock) IS SOURCED FROM THE FULL
 * ab.wikipedia TEXT, not from the sampled corpus artifact — the artifact's 208 excerpts attest none of it,
 * which originally deferred all of these classes. The full-text search (2026-08-08) attests every word and
 * every frame the rules below emit; counts and verbatim snippets are in
 * docs/abkhaz_vocabulary_investigation.md, and the words live in the manifest's `symbols` block.
 *
 * ⚠ STILL DEFERRED — AND LOOKED UP, NOT ASSUMED. `tools/normalization/review.ts --lang ab` keeps
 * reporting these as DROPPED, and it is right to; they are blocked on VOCABULARY, not on code:
 *
 *   minus    ×13   минус ×0 on the full wiki (плюс too — its one hit is a Russian publisher's name);
 *                  Glosbe's "translation" is the "-" glyph itself. So −173 °C still reads without its sign.
 *   math     ×12   +, =, <, >, ×, ÷ — none of their words attested anywhere searched.
 *   cubic    —     куб ×0, so м³/см³/км³ keep their symbol (only ² has a spelled measure word). °F
 *                  likewise: no Fahrenheit attestation, so ⟨°F⟩ is left untouched by the degree rule.
 *   per      —     no word for the rate slash is sourceable. A rate whose denominator is a DECLARED
 *                  unit (⟨0,6км/км²⟩) is refused whole by the shared tier — no noun+connective, no half
 *                  reading (a first version half-rewrote the denominator, which LOOKED better on the
 *                  DROP count and read worse). ⚠ An UNKNOWN denominator (⟨19,2 км/с⟩, ⟨км/сааҭ⟩) is not
 *                  a rate the tier can see, so the numerator reads as a word and ⟨/с⟩ stays visible —
 *                  a quantity heard, a rate marker left where the leak gate can see it. Closing that
 *                  needs the per-word (unsourced) or a tier-level refusal, which is fleet policy, not
 *                  this file's.
 *   ampersand ×1   one instance, inside a Russian-language bibliographic citation.
 *
 * ⚠ ESPEAK CANNOT HELP HERE: it does not ship Abkhaz at all, so the fleet's usual fallback for numerals
 * and unit words is unavailable.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords, readDigits } from "./numbers.ts";

const ESC = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * The SHARED symbol tier carries percent and currency (with the magnitude hop), and this file uses it
 * rather than hand-rolling them — the tier's guards are the accumulated defect list of the fleet:
 * the "already said it" suppression (⟨95% процент⟩ and ⟨$1000 доллар⟩ each read their word TWICE in the
 * hand-rolled first version — the exact Malayalam/Nepali defects the tier was built for), the left
 * letter-boundary with longest-first compound keys (⟨US$30⟩ otherwise strands a raw "US"), and
 * count-form machinery Abkhaz doesn't need but costs nothing (1-element forms).
 * The magnitudes are the SPELLED words — step 3c expands млрд/млн before this runs, so the tier's
 * number→magnitude→currency order lands exactly the attested "8 миллиард доллар" frame.
 */
const symbolize = makeSymbolNormalizer({
    percent: [MANIFEST.symbols.percent],
    currency: Object.fromEntries(MANIFEST.symbols.currencies.map(([sym, word]) => [sym, [word]])),
    magnitudes: [MANIFEST.numbers.milliard, MANIFEST.numbers.million],
    // km/m — the corpus's own digit-adjacent spellings ("900 метра", "15-20 километра"; км ×58, м ×21).
    // The tier also composes км² → "километра квадрат" (the attested order) and, with no cubed word
    // sourceable (куб ×0), re-emits a ³ where the leak gate can see it. мм/кг/г/т stay undeclared — no
    // spelled singular is attested — and an undeclared unit is left untouched.
    units: Object.fromEntries(MANIFEST.symbols.units.map(([sym, word]) => [sym, [word]])),
    exponentWords: { squared: [MANIFEST.symbols.squared], position: "after" },
});

/**
 * The clock word's "already said" lookback — PRECOMPILED (the first version compiled per match, against
 * an unbounded prefix slice, with the manifest word unescaped), and ⚠ LEFT-BOUNDED: the и- prefix is
 * productive in Abkhaz (the manifest's own ⟨Цельси иградус⟩), so a word merely ENDING in асааҭ must not
 * suppress the frame word — ⟨иасааҭ 22:30⟩ still needs its own асааҭ.
 */
const HOUR_SAID = new RegExp(`(?<![\\p{L}])${ESC(MANIFEST.symbols.hour)}\\s*$`, "u");
const saidHour = (whole: string, off: number): boolean =>
    HOUR_SAID.test(whole.slice(Math.max(0, off - MANIFEST.symbols.hour.length - 4), off));

/**
 * One H:MM(:SS) as spoken digits, or undefined for a shape no wall clock shows (25:99 stays text —
 * bounds per the shared house rule, swedish/normalize.ts's isClock).
 * ⚠ ONLY TRAILING zero components are dropped. The first version dropped zero components ANYWHERE,
 * so 10:00:30 collapsed to the same output as the DIFFERENT time 10:30 — the seconds slid into the
 * minutes slot. The corpus justification ("асааҭ 10.00") covers dead TAIL zeros and nothing more.
 */
function clockParts(h: string, mm: string, ss: string | undefined): string | undefined {
    if (Number(h) >= 24 || Number(mm) >= 60 || (ss !== undefined && Number(ss) >= 60)) return undefined;
    const parts = [h, String(Number(mm))];
    if (ss !== undefined) parts.push(String(Number(ss)));
    while (parts.length > 1 && parts[parts.length - 1] === "0") parts.pop();
    return parts.join(" ");
}

/** One clock time — hours 1–2 digits, minutes exactly 2, optional seconds. Shared by both clock rules. */
const TIME = "(\\d{1,2}):(\\d{2})(?::(\\d{2}))?";

/**
 * ⚠ THE ORDINAL IS а + CARDINAL + тәи, and the corpus spells enough of them to prove it: аҩбатәи (2),
 * ахԥатәи (3), аԥшьбатәи (4), афбатәи (6), ажәабатәи (10). The written form is the numeral plus the
 * suffix — 6-тәи, 19-тәи — and 12 distinct values occur that way.
 *
 * ⚠ 1 IS SUPPLETIVE. The cardinal is акы, but the ordinal is актәи (5 corpus instances), never *акытәи*.
 * ⚠ A MULTI-WORD NUMBER TAKES THE PREFIX ON THE FIRST WORD AND THE SUFFIX ON THE LAST — 1910-тәи is
 * а-зқьы жәшәи жәаба-тәи — because the numeral is one nominal, not a list.
 */
function ordinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    const words = numberToWords(n).split(" ");
    const first = words[0]!;
    words[0] = first.startsWith("а") ? first : `а${first}`; // акы already carries the prefix; ҩба does not
    const last = words.length - 1;
    // ⚠ THE SUPPLETION IS ABOUT THE LAST CARDINAL WORD, NOT ABOUT n === 1. Keying it on the number made
    // every COMPOUND ending in one produce the very form the comment above calls impossible: 21-тәи came
    // out аҩажәи *акытәи, and 21 and 291 are both attested in the corpus.
    words[last] = words[last] === MANIFEST.numbers.units[1]
        ? MANIFEST.numbers.ordinalOne
        : `${words[last]}${MANIFEST.numbers.ordinalSuffix}`;
    return words.join(" ");
}

/** Normalize one Abkhaz input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeAbkhaz(text: string): string {
    let s = text;

    // 1) ZERO-WIDTH marks (×51 in the corpus) — dropped before anything measures adjacency, since a ZWSP
    //    between a number and its unit makes the two non-adjacent and every later rule miss.
    s = s.replace(/[​‌‍﻿]/gu, "");

    // 2) DE-GROUP a thousands-separated numeral (×13: 125 000, 12 364, 180 000) — FIRST among the number
    //    rules, per the playbook: the separator is otherwise read as clause punctuation or, here, as a
    //    second numeral, and `125 000` read as "125" followed by the WORD zero.
    //    ⚠ ONLY between digit groups of exactly three, so a genuine "1877 шықәсазы" (year + word) is
    //    untouched — the guard is the following group being 3 digits and not more.
    //    ⚠ THE LEFT GUARD IS LOAD-BEARING: without `(?<!\d)` the 1–3 digit group BACKTRACKS into the tail
    //    of a longer number, so "1877 250 ҩык" (a year beside a count) joined into 1877250 and was read as
    //    one seven-figure number. The comment used to claim the 3-digit rule covered that; it did not.
    s = s.replace(/(?<!\d)(\d{1,3})(?:[   ](\d{3}))+(?!\d)/gu, (m) => m.replace(/[   ]/gu, ""));

    //    ⚠ COMMA-GROUPING TOO. Two-plus groups are unambiguous (£29,721,250 — the wiki spells that very
    //    sum de-grouped, "29,721,250 фунт стерлинг"). A SINGLE comma group collides with the decimal
    //    comma, but NOT evenly, and the artifact itself is the tiebreak: its `\d{1,3},\d{3}` instances
    //    split 7 groupings ("301,340 км²", "143,600", "21,000 К") against 5 decimals — and every one of
    //    the 5 decimals begins ⟨0,⟩ ("0,723", "0,306"). So the INTEGER PART discriminates: a leading 0
    //    keeps the decimal reading, anything else de-groups. (The first version kept every single group
    //    as a decimal and mis-read the majority class its own comment claimed to protect.)
    s = s.replace(/(?<![\d,])\d{1,3}(?:,\d{3}){2,}(?![\d,])/gu, (m) => m.replace(/,/gu, ""));
    s = s.replace(/(?<![\d,.])([1-9]\d{0,2}),(\d{3})(?![\d,])/gu, "$1$2");

    // 3) SYMBOLS — percent, degrees, currency, км², the clock. The words and their ORDER are the
    //    full-wiki attestations recorded in the manifest `symbols` block (sourcing:
    //    docs/abkhaz_vocabulary_investigation.md).
    //    ⚠ BEFORE ranges and decimals, deliberately: "83°C" must attach its unit while the digits are
    //    still beside it — the range rewrite inserts words between endpoints, and after it runs the ⟨°C⟩
    //    would be touching ⟨рҟынӡа⟩, not a digit. Symbol rules only move a WORD in beside the digit span,
    //    so the later number rules still see the digit shapes they expect.

    //    3a) THE CLOCK (×3: "22:30 рзы", "асааҭ 18:21:56 рзы"). The frame word goes BEFORE the number,
    //    said ONCE — the corpus wrote it itself in one instance, so the rule must not double it.
    //    ⚠ THE HYPHENATED RANGE FORM FIRST. Rewriting "10:00-16:00" endpoint-by-endpoint doubled the
    //    frame word AND stranded the hyphen where the digit-range rule of step 4 could no longer see it
    //    ("асааҭ 10-асааҭ 16") — breaking this step's own header promise. The corpus frame carries the
    //    word once for the whole pair ("асааҭ 10.00 инаркны 16.00"), and the connectives are step 4's,
    //    including its don't-double-рҟынӡа guard.
    //    ⚠ NOT A CLOCK: "(1:51.4)" — a race time, in the corpus — is excluded by the `[.,]\d` trailing
    //    guard ("minutes" carrying a fraction are a duration), and 25:99 by the wall-clock bounds in
    //    clockParts (h<24, mm<60, ss<60 — the shared house rule).
    s = s.replace(new RegExp(`(?<![\\d:])${TIME}\\s?[-–—]\\s?${TIME}(?![\\d:]|[.,]\\d)`, "gu"),
        (m0: string, h1: string, m1: string, s1: string | undefined, h2: string, m2: string,
            s2: string | undefined, off: number, whole: string) => {
            const a = clockParts(h1, m1, s1), b = clockParts(h2, m2, s2);
            if (a === undefined || b === undefined) return m0;
            const after = whole.slice(off + m0.length, off + m0.length + 40);
            const to = /[ар]ҟынӡа/u.test(after) ? "" : ` ${MANIFEST.numbers.rangeTo}`;
            return `${saidHour(whole, off) ? "" : `${MANIFEST.symbols.hour} `}${a} ${MANIFEST.numbers.rangeFrom} ${b}${to}`;
        });
    s = s.replace(new RegExp(`(?<![\\d:])${TIME}(?![\\d:]|[.,]\\d)`, "gu"),
        (m0: string, h: string, mm: string, ss: string | undefined, off: number, whole: string) => {
            const t = clockParts(h, mm, ss);
            if (t === undefined) return m0;
            return `${saidHour(whole, off) ? "" : `${MANIFEST.symbols.hour} `}${t}`;
        });
    //    ⚠ THE DOT-SEPARATED CLOCK EXISTS TOO — "асааҭ 10.00 инаркны 16.00" is the corpus's own frame —
    //    but a bare "10.00" is indistinguishable from a decimal, so EVERY dot form is anchored on the
    //    (letter-bounded) hour word itself; the decimal rule (5) reads every other NN.NN.
    //    ⚠ A FIRST VERSION also accepted a bare инаркны as the anchor, which licensed a clock reading
    //    for ORDINARY decimals in the range frame — "1 инаркны 2.50 метра" read "2 50". The инаркны
    //    continuation is only a clock when the асааҭ endpoint opened it, so the whole attested frame is
    //    one anchored rule (hyphen or инаркны between the endpoints), and the single form another.
    //    ⚠ THE TRAILING GUARD ADMITS PUNCTUATION: "асааҭ 10.00, нас" and a sentence-final clock are
    //    still clocks — only a digit continuation ([.,]\d — a chain or a fraction) refuses.
    const DTIME = "(\\d{1,2})\\.(\\d{2})";
    const HOUR_ANCHOR = `(?<![\\p{L}])${ESC(MANIFEST.symbols.hour)}\\s{1,2}`;
    s = s.replace(new RegExp(
        `${HOUR_ANCHOR}${DTIME}(?:\\s?[-–—]\\s?|\\s+${ESC(MANIFEST.numbers.rangeFrom)}\\s+)${DTIME}(?!\\d|[.,]\\d)`, "gu"),
        (m0: string, h1: string, m1: string, h2: string, m2: string, off: number, whole: string) => {
            const a = clockParts(h1, m1, undefined), b = clockParts(h2, m2, undefined);
            if (a === undefined || b === undefined) return m0;
            const after = whole.slice(off + m0.length, off + m0.length + 40);
            const to = /[ар]ҟынӡа/u.test(after) ? "" : ` ${MANIFEST.numbers.rangeTo}`;
            return `${MANIFEST.symbols.hour} ${a} ${MANIFEST.numbers.rangeFrom} ${b}${to}`;
        });
    s = s.replace(new RegExp(`${HOUR_ANCHOR}${DTIME}(?!\\d|[.,]\\d)`, "gu"),
        (m0: string, h: string, mm: string) => {
            const t = clockParts(h, mm, undefined);
            return t === undefined ? m0 : `${MANIFEST.symbols.hour} ${t}`;
        });

    //    3b) DEGREES (×19: "+23,2 °C", "3,4°", "(+462°C)"). ⟨°C⟩ takes the attested unit NAME
    //    ⟨Цельси иградус⟩ verbatim — Цельси is never attested bare after a number, so no other order can
    //    claim a source. A bare ⟨°⟩ is the postposed ⟨градус⟩ ("180 градус").
    //    ⚠ ⟨С⟩ MAY BE CYRILLIC — U+0421 is what a Russian keyboard types, so the Celsius class holds both
    //    letters; without the Cyrillic one, ⟨23 °С⟩ fell through to the bare rule, which consumed the
    //    space and glued: *градусС.
    //    ⚠ THE SKIP CLASS WANTS A STANDALONE LETTER, so each letter is bounded — unbounded, any following
    //    WORD starting with C/F/K suppressed the rule ("60° Кырҭтәыла" kept its raw °). ⟨°F⟩/⟨°Ф⟩ and
    //    Kelvin still fall through deliberately: no Fahrenheit word is attested, and Kelvin is written
    //    unsigned ("135 K") — a standalone letter after ° stays untouched, a word does not.
    s = s.replace(/(\d)\s?°\s?[CС](?![\p{L}])/gui, (_m, d: string) => `${d} ${MANIFEST.symbols.celsius}`);
    s = s.replace(/(\d)\s?°(?!\s?[CFKКСФ](?![\p{L}]))/gui, (_m, d: string) => `${d} ${MANIFEST.symbols.degree}`);

    //    3c) SCALE ABBREVIATIONS (млрд/млн: "$1,86 млрд", "€ 30 млн") — BEFORE the symbol tier, so the
    //    currency rule can hop the SPELLED scale word and land the currency name LAST, in the attested
    //    "8 миллиард доллар" order. The words come from `numbers` via the manifest's scale→key mapping —
    //    one copy, shared with the number path.
    //    ⚠ THE DOT FORMS ARE REAL (млн./млрд. — Russian writes them dotted, and sibling corpora attest
    //    both), so the dot is consumed like step 7's abbreviation dots — and like there, it may be the
    //    SENTENCE'S too, so it is re-emitted before whitespace + an upper-case letter.
    for (const [abbr, slot] of Object.entries(MANIFEST.symbols.scales))
        s = s.replace(new RegExp(`(?<![\\p{L}])${ESC(abbr)}(?:\\.(\\s+\\p{Lu})?|(?![\\p{L}]))`, "gu"),
            (_m, tail?: string) => (tail === undefined ? MANIFEST.numbers[slot] : `${MANIFEST.numbers[slot]}.${tail}`));

    //    3d) THE ASCII EXPONENT — the corpus writes "8 км2" beside "422 000 км²", and the tier's
    //    ASCII-digit arm is Latin-only by design (its lookbehind is [a-zA-Z], so a Cyrillic unit never
    //    reaches it — the Bulgarian lesson, bg/normalize.ts). Folded to the superscript here, BEFORE the
    //    tier, so both spellings take the same path.
    s = s.replace(/(?<=\d\s?(?:км|см|м))([23])(?![\d\p{L}])/gu, (d: string) => (d === "2" ? "²" : "³"));

    //    3e) PERCENT (×31), CURRENCY (×6), UNITS (км ×58, м ×21) and КМ² all go through the SHARED
    //    symbol tier (see `symbolize` above), which owns the guards: already-said suppression,
    //    letter-bounded longest-first keys, the number→magnitude→currency order that is exactly the
    //    attested Abkhaz frame, and the unit+exponent composition ("422000 км²" → "422000 километра
    //    квадрат"). ⚠ AFTER the scale expansion (3c) — the tier's magnitudes are the SPELLED words.
    s = symbolize(s);

    // 4) RANGES (×71: 1908-1915, 10-11, 13-15). ⚠ BOTH CONNECTIVES ARE CORPUS-ATTESTED and neither is
    //    invented: инаркны ("from", ×25) and рҟынӡа/аҟынӡа ("to", ×25/×17) — the corpus writes them out in
    //    exactly this frame ("16-тәи ашәышықәса инаркны 19-тәи ашәышықәса алагамҭа аҟынӡа").
    //    ⚠ BEFORE the decimal rule, and the endpoints admit a DECIMAL — comma or dot — because the
    //    decimal rewrite replaces the separator with a SPACE, which destroys the digit-dash-digit shape
    //    this needs. Ordered the other way, the attested "6,4-7,6" lost its dash entirely; and with only
    //    the comma admitted, the corpus's own "7.9-8.2" matched its INNER digits and stranded ".2" after
    //    the "to" word. The left guard also refuses a start just past a decimal separator (the ⟨14-15⟩
    //    inside ⟨3.14-15⟩), and the right guard refuses a separator-digit continuation but NOT a
    //    sentence dot.
    s = s.replace(/(?<![\p{L}\d.,-])(\d+(?:[.,]\d+)?)\s?[-–—]\s?(\d+(?:[.,]\d+)?)(?!\d|[.,]\d|-)/gu,
        (m0: string, a: string, b: string, off: number, whole: string) => {
            // ⚠ DO NOT DOUBLE A "TO" THE TEXT ALREADY WROTE. "1800-2000 м рҟынӡа" is attested, and adding
            // the connective unconditionally read рҟынӡа twice. Same guard the shared symbol tier uses for
            // a percent word that follows its sign.
            const after = whole.slice(off + m0.length, off + m0.length + 40);
            const said = /[ар]ҟынӡа/u.test(after);
            return `${a} ${MANIFEST.numbers.rangeFrom} ${b}${said ? "" : ` ${MANIFEST.numbers.rangeTo}`}`;
        });

    // 5) DECIMALS (×120, the commonest numeric form after bare digit runs). The comma is the decimal
    //    separator, and it was reaching clause punctuation as a PAUSE — a sentence break inside a number.
    //    ⚠ THE DECIMAL POINT HAS NO SOURCEABLE WORD. tools/normalization/sources.ts reports `decimal-point
    //    NONE` for ab (no espeak entry — espeak does not ship Abkhaz at all — and no manifest word), and
    //    its instruction for that case is to read the fraction DIGIT BY DIGIT. So the integer part reads as
    //    a numeral and each fractional digit as its own numeral, with NO connective invented between them.
    //    That is deliberately not a claim about how a speaker says it; it is the reading that adds no
    //    vocabulary this language has not been shown to have.
    //    ⚠ THE DOT DECIMAL IS REAL TOO — Latin-source passages write it ("28.28 гр.", "0.02°",
    //    "38.61мм", "1.98847") — and it was reaching the sink as a full-stop PAUSE mid-number. Digits on
    //    BOTH sides keep a sentence's "1877. Ашәышықәса" out; the dot-CLOCK frames were consumed in 3a.
    //    ⚠ A DOT CHAIN IS A DATE, NOT A DECIMAL: "17.11.1946" (the biography frame, all over the corpus)
    //    must keep its dots as pauses — the first version read it "seventeen one one". THREE guards are
    //    needed: the ⟨\.\d⟩ lookahead stops the match at ⟨17.11⟩.1946, the lookbehind stops the retry
    //    from starting inside the chain at ⟨11.1946⟩ — and the ⟨(?!\d)⟩ stops the fraction BACKTRACKING
    //    past the first guard (without it, frac gave back a digit and ⟨17.11⟩ matched as ⟨17.1⟩).
    //    ⚠ AND SO IS THE TWO-PART DOT DATE: "11.1946" is a month beside a year, not eleven-point-…, so a
    //    1–12 integer with an exactly-4-digit fraction keeps its dot as a pause.
    //    ⚠ A LETTER MAY BE GLUED TO THE FRACTION ("0,6км", "38.61мм" — the corpus writes both), and the
    //    emitted words fused with it: 0,6км read *фбакм, one nonword. A trailing space is added exactly
    //    when the next character is a letter.
    s = s.replace(/(?<![\d.])(\d+)[.,](\d+)(?!\d|\.\d)/gu, (m0, int: string, frac: string, off: number, whole: string) => {
        if (m0.includes(".") && frac.length === 4 && int.length <= 2 && Number(int) >= 1 && Number(int) <= 12)
            return m0; // MM.YYYY
        const sep = /\p{L}/u.test(whole[off + m0.length] ?? "") ? " " : "";
        return `${int} ${readDigits(frac)}${sep}`;
    });

    // 6) ORDINALS (×36 across 12 distinct values). ⚠ AFTER ranges: `13-15` is a range, but `16-тәи` is an
    //    ordinal, and both begin `\d+-`. Ranges run first and consume only digit–digit, so what reaches
    //    here is a numeral followed by the suffix rather than by another numeral.
    //    ⚠ THE SEPARATOR MAY BE A SPACE, not only a hyphen — "Совмин 1 тәи ихаҭыԥуаҩ" (×2 against ×20
    //    hyphenated). Found by reading the corpus diff, not by probing: the hyphenated form is what the
    //    hard-set carries, and the spaced one only shows up in running text.
    //    ⚠ AND A TRAILING BOUNDARY, or the suffix matches the START of a longer word: 5-тәижәа glued into
    //    ахәбатәижәа.
    s = s.replace(new RegExp(`(\\d+)[- ]${MANIFEST.numbers.ordinalSuffix}(?![\\p{L}])`, "gu"),
        (m0, d: string) => ordinalWords(Number(d)) ?? m0);

    // 7) ABBREVIATIONS (×125). ⚠ THE EXPANSIONS ARE THE CORPUS'S OWN SPELLINGS, counted in it: шықәса
    //    ("year", spelled ×35 in its inflected forms) and ашәышықәса ("century", ×16). The dot is the
    //    abbreviation's, not a sentence's, so it is consumed — otherwise it survives as a phrase break in
    //    the middle of a date ("1452ш." read as a number, a bare letter, then a full stop).
    //    ⚠ LONGEST FIRST (ш.ш and шш before ш, ашә before ш) or the shorter key eats the longer one's
    //    stem — and ⟨ш.ш.⟩ is exactly that case: the dot is not a letter, so the lookbehind does NOT stop
    //    a ⟨ш⟩-keyed rule from matching the second half, which produced *шықәсашықәса.
    //    ⚠ THE KEY IS REGEX-ESCAPED because one of them now contains a dot.
    for (const [abbr, full] of MANIFEST.abbreviations)
        //    ⚠ THE DOT MAY BE THE SENTENCE'S TOO. Consuming it unconditionally ran two sentences together
        //    ("Ари 1452ш. Аҩбатәи ауп." lost its pause), so it is re-emitted when what follows looks like a
        //    new sentence — whitespace then an upper-case letter.
        s = s.replace(new RegExp(`(?<![\\p{L}])${abbr.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\.(\\s+\\p{Lu})?`, "gu"),
            (_m, tail?: string) => (tail === undefined ? full : `${full}.${tail}`));

    return s;
}
