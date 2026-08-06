import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";

/**
 * Yoruba text normalization — the symbols a reader voices, rewritten to words before the tokenizer sees them.
 *
 * ⚠ Yoruba's referees (wikipron yor, kaikki yor) are word→IPA: they can check how a word is PRONOUNCED, never
 * which word a reader says for a symbol. Readings here therefore rest on corpus evidence, not transcription.
 *
 * Deliberately absent: DIVISION (`÷` never occurs between digits), CUBED (no cube word appears at all), the
 * bare DEGREE sign without a scale letter, and a decimal-point word — `ẹsẹ` exists in a dictionary but means a
 * foot/verse-line, so it is the wrong sense rather than a missing one.
 */
const SYM = MANIFEST.symbols;

const SYMBOLS = makeSymbolNormalizer({
    /** `US$` is its own key: with only a bare `$`, the letters read as a word and the sign is dropped. */
    currency: { "US$": ["dọ́là Amẹ́ríkà"], "₦": ["náírà"], $: ["dọ́là"] },
    percent: [SYM.percentBefore],
    percentPrefix: true,
    ampersand: SYM.and,
    /**
     * ⚠ ONLY `km` AND `ha`. `mítà` is the right word for `m`, but a bare `m` is too ambiguous in running text
     * to claim; cubed is undeclared because no cube word exists in the language's usage here.
     */
    units: { km: ["kìlómítà"], ha: ["hẹ́kítà"], mi: ["máìlì"] },
    /** ⚠ `w` is the YORUBA abbreviation — wákàtí, "hour" — so both `km/w` and the borrowed `km/h` occur. */
    rateDenominators: { w: "wákàtí kan", h: "wákàtí kan" },
    unitPer: "ni",
    exponentWords: { squared: [SYM.squared], position: "after" },
});

const GROUPED = /(\d),(\d{3})(?!\d)/gu;
/** A digit-flanked dash. See rule 2: in Yoruba this is a RANGE, never a minus. */
const RANGE = /(\d)\s*[-–—]\s*(?=\d)/gu;
/** `60%`, `8.3%` — the sign FOLLOWS the number here; none lead it. */
const PERCENT = /(\d+(?:\.\d+)?)\s*%/gu;

/**
 * ⚠ TONE-FOLDED MATCHING, NOT A CHARACTER CLASS. A class cannot hold `ọ́` — there is no precomposed codepoint,
 * so `[ọ́o]` decomposes into ọ, a bare combining acute and o as three separate members, and the pattern silently
 * never matches. Folding the marks away first makes tone-optionality free.
 */
const fold = (x: string): string =>
    x
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .toLowerCase();
/** The percent circumfix already spelled out in the text, so the rule does not read it a second time. */
const SAID_AFTER = /ninu\s+[oọ]g[oọ]run/u;
const SAID_BEFORE = /(?:[iì]da|[iì]pin)\s*$/u;

/** The unit nouns this layer expands, and a squared one with no number necessarily beside it. */
const UNIT_WORDS: Record<string, string> = { km: "kìlómítà", ha: "hẹ́kítà" };
const UNIT_SQUARED = /(?<![\p{L}\p{M}])(km|ha)\s*²/gu;
/** `38°C`, `79.63 °F` — a number, the sign, and a scale letter. The bare ° is refused; see the header. */
const SCALED_DEGREE = /(\d+(?:\.\d+)?)\s*°\s*([CFK])(?![\p{L}\p{M}])/gu;
/** A digit-flanked ×: relay legs, dimensions and resolutions. */
const TIMES = /(\d)\s*×\s*(?=\d)/gu;
const DECIMAL = /(\d)\.(\d+)/gu;

/** Normalize Yoruba text: symbols the reader voices become words, before `yoruba.ts`'s TOKEN sees them. */
export function normalizeYoruba(text: string): string {
    let s = text;
    // 1. De-group thousands FIRST: a grouping comma left in place makes one number into two with a clause pause
    //    (`2,500` → *méjì , ẹgbẹ̀rún márùn-ún*). Exactly three following digits so a decimal comma survives.
    while (GROUPED.test(s)) {
        GROUPED.lastIndex = 0;
        s = s.replace(GROUPED, "$1$2");
    }
    // 2. ⚠ A DIGIT-FLANKED DASH IS A RANGE, NOT A MINUS — `sí` ("to") is what occurs between digits.
    s = s.replace(RANGE, `$1 ${SYM.range} `);
    // 3. ⚠ YORUBA'S PERCENT IS A CIRCUMFIX: a word BEFORE the number and a phrase AFTER it. A parenthesised
    //    percentage restating one already spelled out is dropped rather than read twice.
    s = s.replace(/\(\s*(\d+(?:\.\d+)?)\s*%\s*\)/gu, (m, num: string, at: number, whole: string) =>
        SAID_AFTER.test(fold(whole.slice(Math.max(0, at - 60), at))) ? "" : m,
    );
    s = s.replace(PERCENT, (_m, num: string, at: number, whole: string) =>
        SAID_AFTER.test(fold(whole.slice(at, at + 40))) || SAID_BEFORE.test(fold(whole.slice(Math.max(0, at - 20), at)))
            ? num
            : `${SYM.percentBefore} ${num} ${SYM.percentAfter}`,
    );
    // 4. Squared units, then the shared symbol tier.
    s = s.replace(UNIT_SQUARED, (_m, u: string) => `${UNIT_WORDS[u] ?? u} ${SYM.squared}`);
    s = SYMBOLS(s);
    // 5. ⚠ ANOTHER CIRCUMFIX: `ìwọ̀n` before the number, the scale name after. The scale names are borrowed
    //    unchanged. Must run BEFORE the decimal rule so `100.4°F` is still one number when the scale is claimed.
    s = s.replace(
        SCALED_DEGREE,
        (_m, num: string, letter: string) => `${SYM.degree} ${num} ${SYM.scales[letter.toUpperCase()] ?? letter}`,
    );
    // 6. `lọ́nà` is this language's multiplication word — numbers.ts uses it for the same relation. The honest
    //    limit: it is attested between SPELLED-OUT numerals, not between digits, so this composes a symbol
    //    reading from an attested piece. Preferred to silence because every digit-flanked × here is a relay leg,
    //    dimension or resolution, where dropping the sign runs two numbers together.
    s = s.replace(TIMES, `$1 ${SYM.times} `);
    // 7. ⚠ THE DECIMAL SEPARATOR LAST, AND THE ORDER IS LOAD-BEARING. Before rule 3 it splits `8.3%` and the
    //    percent circumfix wraps only one half; before rule 5 it turns `100.4°F` into `100 àti dásímà 4°F`.
    s = s.replace(DECIMAL, (_m, whole: string, frac: string) => `${whole} ${SYM.decimalWord} ${[...frac].join(" ")}`);
    return s.replace(/[ \t]{2,}/gu, " ");
}
