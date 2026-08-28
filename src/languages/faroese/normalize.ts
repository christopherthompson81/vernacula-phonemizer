import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { rewrite } from "../../core/provenance.ts";
/**
 * Faroese (fo) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/fo.jsonc` — fo.wikipedia dump, 52,355 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 31,837 · `year` 31,814 · `abbrev` 10,336 ·
 * `ordinal-latin` 4,562 · `ranges` 3,529 · `decimals` 3,162 · `dotted` 2,408 · `clock` 1,092 ·
 * `signs` 905 · `units` 816 · `percent` 571 · `fractions` 409 · `era-marker` 73 · `degrees` 71 ·
 * `rate` 40 · `currency` 37.
 *
 * ⚠ THE FULL STOP DOES FIVE DIFFERENT JOBS IN THIS CORPUS, and every one of them was reading as a
 * sentence end. That is the round's finding, and the layer is organised around resolving them in order:
 *
 *   | job | instance | how it is told apart |
 *   |---|---|---|
 *   | THOUSANDS GROUP | `49.267 fólk` · `19.300` · `80.000 føroyingar` · `11.738 mió. kr.` | exactly 3 digits follow |
 *   | DECIMAL | `3.00 kr frímerki` · `4.19$ pr. km²` | fewer than 3 digits follow |
 *   | TIME | `Eitt eyka sekund, 23.59.60` | two dots, 2+2 digits — the leap second |
 *   | ORDINAL MARKER | `1. juli` · `23. apríl` · `3. min.` · `2. og 3. ættarlið` | a lowercase word follows |
 *   | SENTENCE END | everything else | — |
 *
 * ⚠ AND THE COMMA IS THE DECIMAL, so the two marks are doing each other's textbook jobs: `6,3°C`,
 * `56,7 °C`, `49,5 %`, `80,11 ár`, `3,4 miljardir`, `7,2 milliónir`. The dot decimals above are both
 * inside dollar figures — an American convention arriving with the quantity it describes.
 *
 * ⚠ THE ORDINAL WORD IS REFUSED AND THE FALSE SENTENCE BREAK IS FIXED, which is not the same thing. The
 * ordinal period is ×127 in the retained text and is this language's commonest defect; but the DATE slot
 * takes the WEAK form, which the wiki counts confirm — `fyrsta` ×51 against `fyrsti` ×29, `triðja` ×28
 * against `triði` ×20, `fjórða` ×25 against `fjórði` ×20 — and of the 31 day ordinals, `sekstandi` (16),
 * `nítjandi` (19) and every compound above 20 score **zero**. A bounded table would cover about half the
 * month and be in the wrong case for all of it. So the dot is spent — the figure and its noun stay in one
 * clause instead of being split by a full stop — and the ordinal is left to a later round with a source.
 *
 * ⚠ AND THE COLON IS NOT A CLOCK HERE. `9:59.91`, `14:46.33`, `2:25.36`, `2:27.62` are SWIMMING AND
 * RUNNING TIMES in minutes:seconds.hundredths — Faroese national records — and the retained text's only
 * real clock is written `kl. 3 e.m.` with no colon at all. A clock rule would read every national record
 * as a time of day (trap 9); the abbreviations are claimed instead.
 *
 * ⚠ THE CORPUS GLOSSES ITS OWN COORDINATE ABBREVIATION: `Føroyar (danskt: Færøerne; 62° norðurbreidd,
 * 7° vesturlongd)` spells out what `57°71° og 71°11° n.br.` abbreviates, three articles apart.
 *
 * SOURCING — every word emitted is a fo.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/fo.jsonc`.
 */

/** ⚠ NEVER `\b` — Faroese carries `á í ó ú ý æ ø ð`, which `\b` treats as boundaries (trap 1/23). */
/** Normalize one Faroese input string. Pure text→text. Steps are ORDER-DEPENDENT — the five jobs of the
 *  full stop are resolved from the most constrained shape to the least. */
export function normalizeFaroese(input: string): string {
    let s = input;

    // 1) THE TIME, first, because `23.59.60` is the only shape with TWO dots and the grouping rule would
    //    otherwise take its first pair. One instance and it is the leap second — "Eitt eyka sekund,
    //    23.59.60, verður lagt at enda árið" — so the fields are separated and left as figures.
    s = rewrite(s, /(?<![\d.,])([01]?\d|2[0-4])\.([0-5]\d)\.([0-5]\d|60)(?![\d.,])/gu, "$1 $2 $3");

    // 2) THE THOUSANDS GROUP — exactly three digits after the dot, and the no-break space this corpus
    //    also uses (`7 737 fólkini`, `48 219`, `12 000–10 000 f. Kr.`). ⚠ THE WHOLE NUMBER AT ONCE, not
    //    one join per pass (trap 63); the trailing guard rejects a DIGIT and nothing else (trap 58).
    s = rewrite(s, /(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu,  // space, NBSP, NNBSP, thin space
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space
    s = rewrite(s, /(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));

    // 3) THE DECIMAL DOT — what is left with fewer than three digits after it, which in this corpus is
    //    always a dollar figure (`3.00 kr frímerki`, `4.19$ pr. km²`). Folded onto the comma the engine's
    //    number branch reads, so one branch covers both conventions.
    s = rewrite(s, /(?<!\d)(\d+)\.(\d{1,2})(?!\d)/gu, "$1,$2");

    // 4) THE ABBREVIATIONS, before the ordinal rule spends any remaining dot. Every expansion is the
    //    corpus's own: `n.br.`/`v.l.` are glossed in full three articles away ("62° norðurbreidd, 7°
    //    vesturlongd"), `kl.` is `klokkan` ×38, `f.Kr.`/`e.Kr.` are `fyri`/`eftir Kristus` (×413/×137,
    //    `Kristus` ×24), `e.m.`/`f.m.` are `eftir`/`fyri middag` (`middag` ×3), `mió.` is milliónir.
    //    ⚠ THE FINAL DOT IS KEPT AT A SENTENCE END, or the pause is lost outright (trap 10).
    const abbrev: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_LETTER_BEFORE}n\\s?\\.\\s?br\\s?\\.`, "gu"), "norðurbreidd"],
        [new RegExp(`${NOT_LETTER_BEFORE}v\\s?\\.\\s?l\\s?\\.`, "gu"), "vesturlongd"],
        [new RegExp(`${NOT_LETTER_BEFORE}f\\s?\\.\\s?Kr\\s?\\.`, "gu"), "fyri Kristus"],
        [new RegExp(`${NOT_LETTER_BEFORE}e\\s?\\.\\s?Kr\\s?\\.`, "gu"), "eftir Kristus"],
        [new RegExp(`${NOT_LETTER_BEFORE}e\\s?\\.\\s?m\\s?\\.`, "gu"), "eftir middag"],
        [new RegExp(`${NOT_LETTER_BEFORE}f\\s?\\.\\s?m\\s?\\.`, "gu"), "fyri middag"],
        [new RegExp(`${NOT_LETTER_BEFORE}kl\\s?\\.`, "gu"), "klokkan"],
        [new RegExp(`${NOT_LETTER_BEFORE}mió\\s?\\.`, "gu"), "milliónir"],
        [new RegExp(`${NOT_LETTER_BEFORE}uml\\s?\\.`, "gu"), "umleið"],
    ];
    for (const [re, word] of abbrev)
        s = rewrite(s, re, (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 5) THE ORDINAL PERIOD — ×127, and the commonest defect in the language. ⚠ THE DOT IS SPENT AND NO
    //    WORD IS EMITTED, which is a deliberate half-measure: see the header. The figure and its noun end
    //    up in one clause (`1. juli` → `1 juli`) instead of being split by a full stop, which is the part
    //    that is unambiguously right; the ordinal itself needs a paradigm this corpus does not supply.
    //    ⚠ THE GUARD IS A FOLLOWING LOWERCASE WORD. An uppercase one begins a new sentence, which is the
    //    dot's fifth job and the one that must survive untouched.
    s = rewrite(s, /(?<![\d.,])(\d{1,4})\.(\s+)(?=\p{Ll})/gu, "$1$2");
    //    …and the same before a NO-BREAK space, which this corpus writes inside a date (`31.&nbsp;des.`).
    //    ⚠ THE SEPARATOR HERE MUST BE THE NO-BREAK SPACE AND NOTHING ELSE. Written with an ordinary space
    //    and a bare `\p{L}` lookahead, this rule ate the SENTENCE-FINAL dot in `Tað var 1998. Síðan kom`
    //    — the fifth job of the full stop, and the one that must survive untouched (trap 58's family).
    //    The test caught it; the corpus diff could not, because a lost pause is not a lost reading.
    s = rewrite(s, /(?<![\d.,])(\d{1,4})\.(\u00a0)(?=\p{L})/gu, "$1$2");  // NBSP

    // 6) DEGREES. `stig` ×64 / `stigum` ×59 is the Faroese degree; `Celsius` ×23. The corpus's angular
    //    instances are coordinates (`62° norðurbreidd`, `57°71° … n.br.`, `47° and 50° N`) and its
    //    thermal ones carry the scale letter (`11 °C (52 °F)`, `56,7 °C (134 °F)`).
    s = rewrite(s, /(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 stig Celsius");
    s = rewrite(s, /(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 stig Fahrenheit");
    s = rewrite(s, /(\d)\s?°/gu, "$1 stig ");

    // 7) SIGNS, before the range rule spends the hyphen.
    s = rewrite(s, /(^|(?<!\d)[\s(])[-−–]\s?(\d)/gu, "$1minus $2");

    // 8) RANGES. The dash was dropped and the endpoints fused — `1269–1308` read as one run. ⚠ THE DASH
    //    IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: Faroese writes `frá X til Y` and the corpus does
    //    so in full where it means it ("frá 2. nov til 31. des."), so imposing the connective on a bare
    //    dash would double a word the writer already chose or not.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), and a chain of three or more
    //    hyphen-joined groups is an identifier rather than a span.
    s = rewrite(s, /(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = rewrite(s, /(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
