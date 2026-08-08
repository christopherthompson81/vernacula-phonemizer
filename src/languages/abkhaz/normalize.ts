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
 * ⚠ DELIBERATELY NOT DONE — AND LOOKED UP, NOT ASSUMED. `tools/normalization/review.ts --lang ab` still
 * reports these as DROPPED, and it is right to; they are blocked on VOCABULARY, not on code. The evidence
 * is `tools/normalization/sources.ts --lang ab` plus a `corpus-words.ts` probe of each candidate spelling:
 *
 *   percent  ×31   no word. Neither процент nor апроцент/проценти occurs in 7,780 distinct corpus tokens.
 *   degree   ×19   `scale-names NONE` — neither Celsius nor Fahrenheit anywhere; градус occurs ONCE, in a
 *                  lunar-eclipse passage, which is not enough to hang a reading on (the Fula lesson).
 *   exponent ×16   no square/power word sourceable; the ² currently reaches an English reader as "squared".
 *   minus    ×13   no word — минус/аминус absent.
 *   math     ×12   +, =, <, >, ×, ÷ — none of their words attested.
 *   currency ×6    доллар appears only as a SUBSTRING of longer tokens, never as a token.
 *   ampersand ×1   one instance, inside a Russian-language bibliographic citation.
 *
 * ⚠ ESPEAK CANNOT HELP HERE: it does not ship Abkhaz at all, so the fleet's usual fallback for numerals
 * and unit words is unavailable. Closing these needs a source this repo does not yet have — which is a
 * sourcing problem, not a coding one, and worth knowing before anyone plans the work.
 *
 * ⚠ ALSO NOT DONE: the clock (×3 in the corpus). The colon reaches clause punctuation and reads as a
 * pause, which is wrong, but three instances is too thin to choose between the possible readings and no
 * "hour"/"minute" frame is attested digit-adjacent.
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
    if (n === 1) return MANIFEST.numbers.ordinalOne;
    const words = numberToWords(n).split(" ");
    const first = words[0]!;
    words[0] = first.startsWith("а") ? first : `а${first}`; // акы already carries the prefix; ҩба does not
    words[words.length - 1] = `${words[words.length - 1]}${MANIFEST.numbers.ordinalSuffix}`;
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
    s = s.replace(/(\d{1,3})(?:[   ](\d{3}))+(?!\d)/gu, (m) => m.replace(/[   ]/gu, ""));

    // 3) DECIMALS (×120, the commonest numeric form after bare digit runs). The comma is the decimal
    //    separator, and it was reaching clause punctuation as a PAUSE — a sentence break inside a number.
    //    ⚠ THE DECIMAL POINT HAS NO SOURCEABLE WORD. tools/normalization/sources.ts reports `decimal-point
    //    NONE` for ab (no espeak entry — espeak does not ship Abkhaz at all — and no manifest word), and
    //    its instruction for that case is to read the fraction DIGIT BY DIGIT. So the integer part reads as
    //    a numeral and each fractional digit as its own numeral, with NO connective invented between them.
    //    That is deliberately not a claim about how a speaker says it; it is the reading that adds no
    //    vocabulary this language has not been shown to have.
    s = s.replace(/(\d+),(\d+)/gu, (_m, int: string, frac: string) =>
        `${int} ${[...frac].map((d) => numberToWords(Number(d))).join(" ")}`);

    // 4) RANGES (×71: 1908-1915, 10-11, 13-15). ⚠ BOTH CONNECTIVES ARE CORPUS-ATTESTED and neither is
    //    invented: инаркны ("from", ×25) and рҟынӡа/аҟынӡа ("to", ×25/×17) — the corpus writes them out in
    //    exactly this frame ("16-тәи ашәышықәса инаркны 19-тәи ашәышықәса алагамҭа аҟынӡа").
    //    ⚠ AFTER the decimal rule, so a comma-decimal is already gone and cannot be split across the dash;
    //    and the guard rejects a dash that follows a letter, so a hyphenated word is never a range.
    s = s.replace(/(?<![\p{L}\d-])(\d+)\s?[-–—]\s?(\d+)(?![\d-])/gu,
        (_m, a: string, b: string) => `${a} ${MANIFEST.numbers.rangeFrom} ${b} ${MANIFEST.numbers.rangeTo}`);

    // 5) ORDINALS (×36 across 12 distinct values). ⚠ AFTER ranges: `13-15` is a range, but `16-тәи` is an
    //    ordinal, and both begin `\d+-`. Ranges run first and consume only digit–digit, so what reaches
    //    here is a numeral followed by the suffix rather than by another numeral.
    //    ⚠ THE SEPARATOR MAY BE A SPACE, not only a hyphen — "Совмин 1 тәи ихаҭыԥуаҩ" (×2 against ×20
    //    hyphenated). Found by reading the corpus diff, not by probing: the hyphenated form is what the
    //    hard-set carries, and the spaced one only shows up in running text.
    s = s.replace(new RegExp(`(\\d+)[- ]${MANIFEST.numbers.ordinalSuffix}`, "gu"),
        (m0, d: string) => ordinalWords(Number(d)) ?? m0);

    // 6) ABBREVIATIONS (×125). ⚠ THE EXPANSIONS ARE THE CORPUS'S OWN SPELLINGS, counted in it: шықәса
    //    ("year", spelled ×35 in its inflected forms) and ашәышықәса ("century", ×16). The dot is the
    //    abbreviation's, not a sentence's, so it is consumed — otherwise it survives as a phrase break in
    //    the middle of a date ("1452ш." read as a number, a bare letter, then a full stop).
    //    ⚠ LONGEST FIRST (ш.ш and шш before ш, ашә before ш) or the shorter key eats the longer one's
    //    stem — and ⟨ш.ш.⟩ is exactly that case: the dot is not a letter, so the lookbehind does NOT stop
    //    a ⟨ш⟩-keyed rule from matching the second half, which produced *шықәсашықәса.
    //    ⚠ THE KEY IS REGEX-ESCAPED because one of them now contains a dot.
    for (const [abbr, full] of MANIFEST.abbreviations)
        s = s.replace(new RegExp(`(?<![\\p{L}])${abbr.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\.`, "gu"), full);

    return s;
}
