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
 *   cubic    —     куб ×0, so м³/см³/км³ keep their symbol (only км² has a spelled form). °F likewise: no
 *                  Fahrenheit attestation, so ⟨°F⟩ is deliberately left untouched by the degree rule.
 *   ampersand ×1   one instance, inside a Russian-language bibliographic citation.
 *
 * ⚠ ESPEAK CANNOT HELP HERE: it does not ship Abkhaz at all, so the fleet's usual fallback for numerals
 * and unit words is unavailable.
 */
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

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

    //    ⚠ COMMA-GROUPING TOO, but ONLY at two-plus groups: £29,721,250 is in the corpus, and the wiki
    //    spells that very sum de-grouped ("29,721,250 фунт стерлинг"). A SINGLE comma group ("301,340 км²")
    //    is left alone — it is indistinguishable from the decimal "1,86", and the decimal reading is the
    //    common one by an order of magnitude in this corpus.
    s = s.replace(/(?<![\d,])\d{1,3}(?:,\d{3}){2,}(?![\d,])/gu, (m) => m.replace(/,/gu, ""));

    // 3) SYMBOLS — percent, degrees, currency, км², the clock. The words and their ORDER are the
    //    full-wiki attestations recorded in the manifest `symbols` block (sourcing:
    //    docs/abkhaz_vocabulary_investigation.md).
    //    ⚠ BEFORE ranges and decimals, deliberately: "83°C" must attach its unit while the digits are
    //    still beside it — the range rewrite inserts words between endpoints, and after it runs the ⟨°C⟩
    //    would be touching ⟨рҟынӡа⟩, not a digit. Symbol rules only move a WORD in beside the digit span,
    //    so the later number rules still see the digit shapes they expect.

    //    3a) THE CLOCK (×3: "22:30 рзы", "асааҭ 18:21:56 рзы"). The frame word goes BEFORE the number,
    //    and one corpus instance already wrote it — so the rule must not double it (the рҟынӡа guard
    //    again). Zero minutes/seconds are dropped rather than read: "10:00" is асааҭ 10, not "10 aноль" —
    //    the wiki's own "асааҭ 10.00 инаркны 16.00" carries the same dead zeros.
    //    ⚠ NOT A CLOCK: "(1:51.4)" — a race time, in the corpus — is excluded by the `[.,]\d` trailing
    //    guard: "minutes" that carry a fraction are a duration, not a time of day.
    s = s.replace(/(?<![\d:])(\d{1,2}):(\d{2})(?::(\d{2}))?(?![\d:]|[.,]\d)/gu,
        (_m0: string, h: string, mm: string, ss: string | undefined, off: number, whole: string) => {
            const said = new RegExp(`${MANIFEST.symbols.hour}\\s*$`, "u").test(whole.slice(0, off));
            const parts = [h];
            if (Number(mm) !== 0) parts.push(String(Number(mm)));
            if (ss !== undefined && Number(ss) !== 0) parts.push(String(Number(ss)));
            return `${said ? "" : `${MANIFEST.symbols.hour} `}${parts.join(" ")}`;
        });

    //    3b) PERCENT (×31, the largest formerly-deferred class): numeral first, then the word — "18
    //    процент", "жәаба процент" is the only attested order. The digit span (52,8%) stays intact for
    //    the decimal rule.
    s = s.replace(/(\d)\s?%/gu, (_m, d: string) => `${d} ${MANIFEST.symbols.percent}`);

    //    3c) DEGREES (×19: "+23,2 °C", "3,4°", "(+462°C)"). ⟨°C⟩ takes the attested unit NAME
    //    ⟨Цельси иградус⟩ verbatim — Цельси is never attested bare after a number, so no other order can
    //    claim a source. A bare ⟨°⟩ is the postposed ⟨градус⟩ ("180 градус"). ⟨°F⟩ deliberately falls
    //    through both rules — no Fahrenheit word is attested — and Kelvin is written unsigned ("135 K").
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}])/gu, (_m, d: string) => `${d} ${MANIFEST.symbols.celsius}`);
    s = s.replace(/(\d)\s?°(?!\s?[CFКK])/gu, (_m, d: string) => `${d} ${MANIFEST.symbols.degree}`);

    //    3d) SCALE ABBREVIATIONS (млрд/млн: "$1,86 млрд", "€ 30 млн") — BEFORE currency, so the currency
    //    rule can hop the spelled scale word and land the currency name LAST, in the attested
    //    "8 миллиард доллар" order.
    for (const [abbr, word] of MANIFEST.symbols.scales)
        s = s.replace(new RegExp(`(?<![\\p{L}])${abbr}(?![\\p{L}])`, "gu"), word);

    //    3e) CURRENCY (×6: $1,86 млрд · € 30 млн · £200 · £29,721,250). The symbol PRECEDES its number in
    //    text but the word FOLLOWS it in speech, after any scale word — "8 миллиард доллар" is the
    //    attested frame. The number span (decimal comma and all) is left for the later number rules.
    for (const [sym, word] of MANIFEST.symbols.currencies)
        s = s.replace(
            new RegExp(`${sym.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s?(\\d+(?:[.,]\\d+)*(?:\\s(?:${MANIFEST.numbers.milliard}|${MANIFEST.numbers.million}))?)`, "gu"),
            (_m, num: string) => `${num} ${word}`);

    //    3f) КМ² (the bulk of the ×16 exponent class): "143,600 километра квадрат" is the wiki's own
    //    spelling of a км² area — unit and power together, postposed after the number. ⚠ ONLY the square
    //    kilometre: no cubic word exists to source (куб ×0), so м³ and г/см³ keep their symbols.
    s = s.replace(/км²/gu, MANIFEST.symbols.squareKm);

    // 4) RANGES (×71: 1908-1915, 10-11, 13-15). ⚠ BOTH CONNECTIVES ARE CORPUS-ATTESTED and neither is
    //    invented: инаркны ("from", ×25) and рҟынӡа/аҟынӡа ("to", ×25/×17) — the corpus writes them out in
    //    exactly this frame ("16-тәи ашәышықәса инаркны 19-тәи ашәышықәса алагамҭа аҟынӡа").
    //    ⚠ BEFORE the decimal rule, and the endpoints admit a comma — because the decimal rewrite replaces
    //    that comma with a SPACE, which destroys the digit-dash-digit shape this needs. Ordered the other
    //    way, the attested "6,4-7,6" lost its dash entirely and read as four bare numerals.
    //    ⚠ The guard rejects a dash that follows a letter, so a hyphenated word is never a range.
    s = s.replace(/(?<![\p{L}\d-])(\d+(?:,\d+)?)\s?[-–—]\s?(\d+(?:,\d+)?)(?![\d,-])/gu,
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
    s = s.replace(/(\d+),(\d+)/gu, (_m, int: string, frac: string) =>
        `${int} ${[...frac].map((d) => numberToWords(Number(d))).join(" ")}`);

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
