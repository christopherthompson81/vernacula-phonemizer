/**
 * SEPARATOR HYGIENE — the part of text normalization that needs NO vocabulary, for the languages that have
 * no corpus to source vocabulary from.
 *
 * ⚠ WHAT THIS IS FOR. Eight implemented languages have no usable text at all: no FLEURS split, no mined
 * artifact, and either no Wikipedia (`naq`, `nog`, `mto`, `smj`, `quc`, `grc`) or a closed one that reports
 * zero articles (`kl`). The ordinary method cannot start there — every rule it writes is argued from
 * instances, and there are none to read. But a measurable share of what a normalization layer fixes is not
 * a vocabulary question at all: a grouping mark read as a FULL STOP splits one quantity into two or three
 * sentences, and that is wrong in every orthography, whichever convention the language follows.
 *
 * ⚠ THIS PASS EMITS NO WORDS, EVER. That is the whole design. It spends separators and nothing else, so it
 * cannot commit the failure the sourcing discipline exists to prevent — speaking a word the language may
 * not use. Cherokee shipped exactly this shape today after its corpus turned out to carry no percent word
 * and no unit word: four rules, every one spending a separator, no `makeSymbolNormalizer` declaration at
 * all. Its single fix was `17,000` reading as *seventeen, ZERO* — a silent 1000× error.
 *
 * ⚠ AND IT IS SHARED RATHER THAN COPIED EIGHT TIMES, which is the argument `test/clause-final-range.test.ts`
 * already makes in its own header: eleven languages carried the identical wrong trailing class, and "the
 * same six characters were wrong in eleven files" is the case for fixing the class, not the language. A
 * language that later gains a corpus writes its own rules and stops calling this.
 *
 * ⚠ WHAT IT DELIBERATELY DOES NOT DO, and why each refusal is forced rather than lazy:
 *
 *   · A SINGLE grouped-looking run (`1.234`, `1,234`) is LEFT ALONE. Three digits after the mark means
 *     grouping in a grouping convention and a three-place decimal in a decimating one, and nothing here
 *     can tell which. Joining it would be a guess with a 1000× error attached.
 *   · The HYPHEN is never touched. Cherokee's ×101 hyphens are a WORD-JOINER (the `-Ꭿ` enclitic and
 *     compound numerals) against three real spans; Karakalpak's is a minus; Latgalian's `1983.g.` is a
 *     year. Only the en and em dash between digits are claimed, and only as a pause.
 *   · The COLON is never touched. Nahuatl's is a Gospel citation ×14 against a clock ×6; Hawaiian's is a
 *     Bible verse in a DIFFERENT CODEPOINT (U+02D0); Karakalpak's five-digit ones are ISO standard
 *     numbers. A clock rule needs evidence and there is none.
 *   · No sign is read. `%`, `$`, `°`, `+`, `−`, `=` all keep their current behaviour, which is to be
 *     dropped — visible to the leak gates, and honestly unfixed rather than dishonestly filled.
 *
 * ⚠ A LANGUAGE USING THIS IS NOT "TREATED". It has had the corpus-independent subset applied. Everything
 * that needs evidence remains open, and the per-language `normalize.ts` that calls this says so.
 */
import { rewrite } from "./provenance.ts";

/**
 * Spend the separators that cannot be anything but separators. Pure text→text; emits no word.
 *
 * The four rules, in the only order they compose in — multi-group joins run before the short-decimal rule
 * so `1.234.567` is one number before anything looks for a two-digit tail.
 */
export function separatorHygiene(input: string): string {
    let s = input;

    // 1) A run of TWO OR MORE three-digit groups is grouping in every convention that groups — `1.234.567`,
    //    `1,234,567`, `19,605,052`. One group is ambiguous and is left alone (see the header). Today this
    //    reads as three numbers separated by two full stops, with the head reduced: `1.234.567` → *one .
    //    two hundred thirty-four . five hundred sixty-seven*.
    //    ⚠ THE TRAILING GUARD REJECTS A DIGIT, OR A MARK THAT CONTINUES THE NUMBER — never a bare clause
    //    mark. That is trap 58, and the first version of this file got it wrong three lines under a comment
    //    saying it had not: `(?![\d.,])` declined `1.234.567.` outright, so a grouped figure at the end of a
    //    sentence kept all of its false stops. The pinned test is what caught it. The same three characters
    //    are wrong in the same way in eleven shipped layers, which is what `test/clause-final-range.test.ts`
    //    exists to stop; all three rules below carry the corrected form.
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})((?:[.,]\d{3}){2,})(?!\d)(?![.,]\d)/gu,
        (_m, head: string, rest: string) => head + rewrite(rest, /[.,]/gu, ""));

    // 2) A mark with ONE OR TWO digits after it is a decimal in every convention — `3,5`, `1.5`, `19.95`,
    //    `44,7`. The mark becomes a SPACE: the two halves stay separate numbers, which is not how a reader
    //    says it, but the defect being fixed is the false SENTENCE BREAK, and a word for the decimal point
    //    cannot be sourced for any of these languages (`noqat` was a chickpea, `koena` was "the remainder",
    //    `punkts` was a facility — three rounds, three wrong candidates).
    //    ⚠ NO SPACE MAY PRECEDE THE DIGITS. `Chapter 1. 5 things` is a sentence end followed by a numeral,
    //    and requiring the mark to be tight against both sides is what keeps this off it.
    s = rewrite(s, /(?<![\d.,])(\d+)[.,](\d{1,2})(?!\d)(?![.,]\d)/gu, "$1 $2");

    // 3) THREE OR MORE dot-joined digit runs are a date, a version or an address — `26.02.1994`,
    //    `198.51.100.0`, `v2.1.3`, `Ἡρόδοτος 2.35.1`. None is a sentence, and each currently produces two or
    //    three false full stops. The dots become spaces; no word is invented for the shape, because which
    //    shape it is cannot be told apart without evidence and the reading is the same either way.
    s = rewrite(s, /(?<![\d.])(\d{1,4})((?:\.\d{1,4}){2,})(?!\d)(?!\.\d)/gu,
        (_m, head: string, rest: string) => head + rewrite(rest, /\./gu, " "));

    // 4) AN EN OR EM DASH BETWEEN DIGITS IS A SPAN, and it is currently DROPPED OUTRIGHT — `1990–1995`
    //    fuses into one run of words with no boundary at all. It becomes a pause, not a connective: the
    //    connective is a word ("do", "to", "a"), and this pass emits no words.
    //    ⚠ THE HYPHEN IS NOT INCLUDED. See the header — it is a word-joiner, a minus and a year marker in
    //    three of the languages measured this week, and telling those apart needs a corpus.
    s = rewrite(s, /(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");

    return s;
}
