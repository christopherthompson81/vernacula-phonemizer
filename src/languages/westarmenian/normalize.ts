/**
 * Western Armenian (hyw) text normalization — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/hyw.jsonc` — hyw.wikipedia dump, 140,044 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 61,620 · `year` 61,458 · `quote-letter` 17,620 ·
 * `abbrev` 16,449 · `initialism` 14,167 · `ranges` 13,235 · `decimals` 3,644 · `dotted` 3,283 ·
 * `letter-name` 2,583 · `signs` 2,293 · `grouped` 2,162 · `roman` 1,158 · `percent` 1,139 ·
 * `era-marker` 911 · `exponent` 608 · `clock` 627 · `fractions` 551 · `signed-number` 463 ·
 * `ordinal-latin` 470 · `degrees` 175 · `rate` 148 · `currency` 141 · `units` 22.
 *
 * ⚠ THIS IS A SIBLING TEST, AND SEVEN THINGS DID NOT TRANSFER. `src/languages/armenian/normalize.ts`
 * (Eastern, hy) already solves the same script and the same defining defect — the bound case suffix glued
 * to a figure. Trap 55 says the closest sibling is a HYPOTHESIS, and reading hyw's corpus against hy's
 * layer found this much that is genuinely different:
 *
 *   | slot            | Eastern (hy)            | WESTERN (hyw)                                      |
 *   |-----------------|-------------------------|----------------------------------------------------|
 *   | metre / km      | մետր · կիլոմետր         | **մեթր** ×60 · **քիլոմեթր** ×49 (the classical ⟨թ⟩) |
 *   | dollar          | դոլար                   | **տոլար** ×48                                       |
 *   | euro            | եվրո                    | **եւրօ** ×62 (against `եւրո` ×18)                   |
 *   | Celsius         | «Ցելսիուսի աստիճան»     | **«սելսիուս աստիճան»** — scale first, NO genitive   |
 *   | oblique "two"   | երկուս- (երկուսի)       | **երկուք-** ×17 against երկուս ×1 (`Երկուքին մէջտեղ`)|
 *   | era abbreviation| մ.թ.ա. only             | **Ք.Ա. as well**, and the wiki glosses one by the other |
 *   | percent         | տոկոս                   | տոկոս ×42 **and `առ հարիւր`**, a Western-only phrase |
 *
 * ⚠ THE ERA IS SOURCED BY THE WIKI GLOSSING ITSELF, repeatedly and in one parenthesis:
 *     "714 **Քրիստոսէ առաջ (Մեր թուարկութենէն Առաջ)**", "(735-714 Քրիստոսէ առաջ (Մեր թուարկութենէն
 *     Առաջ))", "Առաջին անգամ յիշատակուած է Քրիստոսէ առաջ (Մեր թուարկութենէն Առաջ) 879 տարին"
 * — so both abbreviations get their expansion from the same sentences, and neither is inferred.
 *
 * ⚠ AND THE DECIMAL SEPARATOR IS BOTH MARKS, IN ONE SENTENCE. Eastern's corpus is comma-only; hyw writes
 *     "5.23 աստղագիտական միաւոր (ա.մ.) է, առաւելագոյն մոտեցումը 4.59 ա.մ. է, հեռացումը՝ **5,87** ա.մ."
 * — three decimals, two conventions, one clause. What resolves it is that the GROUPING here is by SPACE
 * (`1 377 808`, `74 000`), so neither mark is doing double duty: the dot is always a decimal, and the
 * comma is a decimal unless exactly three digits follow it (`445,000`).
 *
 * ⚠ NO CLOCK RULE. `clock` is 627 corpus-wide and the ten retained instances are a Quran citation
 * (`8:73:56`), an arithmetic (`364:13=28`), two media durations (`-3:16`, `-2:20:23`) and a ratio — not
 * one is a time of day. The same refusal hy makes, reached independently on a different sample (trap 9).
 *
 * SOURCING — every word below is either read in `tools/corpus/mined/hyw.jsonc` itself or a TOKEN
 * attestation against hyw.wikipedia whose examples were read; see `tools/corpus/attest/hyw.jsonc`.
 */
import { MANIFEST } from "./manifest.ts";
import { westernNumberWords } from "../../core/numbers.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import type { ArmenianDef } from "../armenian/armenian.ts";
import { rewrite } from "../../core/provenance.ts";

const NUMBERS = loadManifest<ArmenianDef>(import.meta.url, "westarmenian.jsonc").numbers;

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** ⚠ NEVER `\b` — it is ASCII and finds no boundary against Armenian (trap 1); and a "not inside a word"
 *  guard carries `\p{M}` beside `\p{L}` (trap 23). Explicit lookarounds throughout. */
/** Armenian lowercase, for a bound suffix. `և` (U+0587) sits outside the ա–ֆ range. */
const ARM_LOWER = "[\\u0561-\\u0586\\u0587]";

/**
 * The magnitude abbreviations this corpus writes, which reach the IPA as consonant clusters unless
 * expanded: `$350& մլն`, `$ 18 պլն`, `$ 12 պիլիոն`. ⚠ `պլն`/`պիլիոն` is the WESTERN spelling of
 * "billion" with initial ⟨պ⟩ — Eastern writes մլրդ/միլիարդ, and this corpus writes both.
 */
const MAGNITUDE_ABBREV: readonly (readonly [string, string])[] = [
    ["մլրդ", "միլիառ"],
    ["պիլիոն", "միլիառ"],
    ["պլն", "միլիառ"],
    ["մլն", "միլիոն"],
    ["հզր", "հազար"],
];

/** Read from the manifest — see the jsonc, where the evidence lives. */
const IRREGULAR_ORDINAL = MANIFEST.irregularOrdinals;

/** Integer → the Western Armenian cardinal as SPACE-SEPARATED WORDS, through the engine's own composer
 *  and spellings, so this pass and the tokenizer can never disagree about a numeral. */
function cardinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 0 || n > 999_999_999_999) return undefined;
    const parts = westernNumberWords(n, NUMBERS);
    if (parts.some((p) => p === null || p === "")) return undefined;
    return (parts as string[]).join(" ");
}

/**
 * Attach a CASE/ARTICLE suffix to a cardinal's last word.
 *
 * ⚠ THE OBLIQUE "TWO" IS WHERE WESTERN AND EASTERN PART. hy's layer uses the suppletive stem `երկուս-`
 * (երկուսի, երկուսը); hyw.wikipedia has **երկուք ×17 against երկուս ×1**, and this corpus's own
 * "**Երկուքին** մէջտեղ կը գտնուի" is the stem in the exact slot. Porting the Eastern stem across would
 * have produced *երկուսին* for the commonest declined numeral in the language.
 *
 * Otherwise a final `ը` DROPS (ինը → ին-, տասը → տաս-) and everything else glues directly.
 */
function attachSuffix(cardinal: string, suffix: string): string {
    const words = cardinal.split(" ");
    let stem = words[words.length - 1]!;
    if (stem.endsWith("երկու")) stem = `${stem}ք`;
    else if (stem.endsWith("ը")) stem = stem.slice(0, -1);
    words[words.length - 1] = `${stem}${suffix}`;
    return words.join(" ");
}

/** Integer → the Western Armenian ORDINAL: the cardinal with `-երորդ` on its LAST word, a final `ը`
 *  becoming `ն` (ինը → իններորդ, տասը → տասներորդ). 1–4 are suppletive, standalone only. */
export function ordinalWords(n: number): string | undefined {
    const irregular = IRREGULAR_ORDINAL[n];
    if (irregular !== undefined) return irregular;
    const cardinal = cardinalWords(n);
    if (cardinal === undefined) return undefined;
    const words = cardinal.split(" ");
    let stem = words[words.length - 1]!;
    if (stem.endsWith("ը")) stem = `${stem.slice(0, -1)}ն`;
    words[words.length - 1] = `${stem}երորդ`;
    return words.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS — a numbered, order-dependent sequence.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function normalizeWestArmenian(input: string): string {
    let s = input;

    // 1) SEPARATORS, and ⚠ THIS CORPUS USES BOTH MARKS FOR THE DECIMAL — see the header. What makes the
    //    two decidable is that the GROUPING is by SPACE, so neither mark is doing double duty:
    //      a. space-grouped `1 377 808`, `74 000`, `7 239 881` → join.
    //      b. a COMMA with exactly three digits after it and no more is grouping (`445,000`); every other
    //         comma is a decimal (`5,87`, `2,968903`, `1868,5`, `0,08`, `231, 9`).
    //      c. the DOT is always a decimal here (`4374.82`, `7.87`, `0.037`, `2.6`, `13.2`).
    //    Both marks become a single ASCII `.`, which the engine's number branch reads as a decimal.
    //    ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE, NOT ONE JOIN PER PASS — playbook trap 63. The repeated
    //    two-digit join this sweep used at first is correct to THREE groups and silently wrong at four:
    //    the global scan resumes INSIDE the remainder and anchors on the last digit of the next group,
    //    so `80 239 800 000` became `80239 800000` — a well-formed numeral for a different quantity, and
    //    invisible to DIGIT, RAWMARK, DROP and the referee alike. ⚠ THE TRAILING GUARD REJECTS A DIGIT
    //    AND NOTHING ELSE: `(?![.,]\d)` looks right and costs `3 779,8` — a space-grouped integer with a
    //    decimal tail, which this corpus writes — while a bare `(?![\d.,])` declines every clause-final
    //    figure (trap 58). The separator here is a SPACE, and a decimal never has one before its
    //    fraction, so `(?!\d)` is the whole guard.
    s = rewrite(s, /(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu,  // space, NBSP, NNBSP, thin space
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space
    s = rewrite(s, /[ \u00a0\u202f\u2009]/gu, " ");  // space, NBSP, NNBSP, thin space
    s = rewrite(s, /(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?![\d,]))/gu, "");
    s = rewrite(s, /(\d),\s?(\d+)/gu, "$1.$2");

    // 2) MAGNITUDE ABBREVIATIONS, before any single-dot rule — they reach the IPA as clusters otherwise.
    for (const [abbrev, word] of MAGNITUDE_ABBREV)
        s = rewrite(s, new RegExp(`${NOT_LETTER_BEFORE}${abbrev}\\.?${NOT_LETTER_AFTER}`, "giu"), word);

    // 3) THE ERA MARKERS. Both abbreviations occur in this corpus and the wiki glosses each by the other
    //    in one parenthesis — "714 Քրիստոսէ առաջ (Մեր թուարկութենէն Առաջ)" — so neither expansion is
    //    inferred. ⚠ THE LONGER FORM MUST BE TRIED FIRST, or the bare `մ.թ.` rule eats the prefix of
    //    `մ.թ.ա.` and strands its final letter. The final dot is kept at a sentence end (trap 10).
    const multi: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_LETTER_BEFORE}մ\\s?\\.\\s?թ\\s?\\.\\s?ա\\s?\\.?`, "giu"), "մեր թուարկութենէն առաջ"],
        [new RegExp(`${NOT_LETTER_BEFORE}ք\\s?\\.\\s?ա\\s?\\.?${NOT_LETTER_AFTER}`, "giu"), "Քրիստոսէ առաջ"],
        [new RegExp(`${NOT_LETTER_BEFORE}ք\\s?\\.\\s?ե\\s?\\.?${NOT_LETTER_AFTER}`, "giu"), "Քրիստոսէ ետք"],
        [new RegExp(`${NOT_LETTER_BEFORE}մ\\s?\\.\\s?թ\\s?\\.`, "giu"), "մեր թուարկութեամբ"],
    ];
    for (const [re, word] of multi)
        s = rewrite(s, re, (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 4) THE ASTRONOMICAL UNIT, `ա.մ.` / `ա. մ.` — and the corpus glosses it itself: "5.23 աստղագիտական
    //    միաւոր (ա.մ.) է". It was reaching the g2p as two bare letters with two false clause pauses.
    s = rewrite(s, new RegExp(`(\\d[^\\s]*)\\s?ա\\s?\\.\\s?մ\\s?\\.`, "gu"), "$1 աստղագիտական միաւոր");

    // 5) THE BOUND SUFFIX ON A FIGURE — this language's defining form, exactly as in Eastern, and 174
    //    instances in the retained text. `2019-ին`, `2029-ի`, `1884-ին`, `70-ի`, `120-անկիւնիի`.
    //    A digit cannot take a suffix, because the digit becomes words in the TOKENIZER, downstream of
    //    everything here — so the rule converts the operand to WORDS and attaches the suffix there.
    //    ⚠ ORDER: the ORDINAL first (its suffix is a different morpheme), then the DECADE, then the rest.

    // 5a. ORDINAL RANGE — `19-20-րդ դարերի`, `2-1 հազ`: the suffix is written once, at the end.
    s = rewrite(s, new RegExp(`${NOT_LETTER_BEFORE}(\\d{1,4})\\s?-\\s?(\\d{1,4})\\s?-\\s?(ր|եր|րոր)դ${NOT_LETTER_AFTER}`, "gu"),
        (whole, a: string, b: string) => {
            const first = ordinalWords(Number(a)), second = ordinalWords(Number(b));
            return first === undefined || second === undefined ? whole : `${first}, ${second}`;
        });

    // 5b. ORDINAL. The corpus writes `-րդ` (`2-րդ`, `8-րդ`, `4-րդ`, `5-րդ`) and once the fuller `-րորդ`
    //     (`3-րորդ`); the spelled word is the same either way, so the alternation covers both without
    //     the reading depending on which the writer typed.
    s = rewrite(s, new RegExp(`${NOT_LETTER_BEFORE}(\\d{1,4})\\s?-\\s?(?:ր|եր|րոր)դ(${ARM_LOWER}*)${NOT_LETTER_AFTER}`, "gu"),
        (whole, digits: string, tail: string) => {
            const ord = ordinalWords(Number(digits));
            return ord === undefined ? whole : `${ord}${tail}`;
        });

    // 5c. DECADE — `1960-ականներուն`, `1990-ականներու`, `1950-ական թուականներուն`. The suffix goes on the
    //     cardinal, so it shares `attachSuffix` with 5d and differs only in the string.
    // 5d. EVERY OTHER BOUND SUFFIX, in one rule. ⚠ The alternation is CLOSED to Armenian lowercase and
    //     requires the hyphen, which is what keeps `1915-1923` (a range) and `13-11-2020` (a date) out:
    //     both have a DIGIT after the hyphen, and this rule needs a letter.
    s = rewrite(s, new RegExp(`${NOT_LETTER_BEFORE}(\\d+)\\s?-\\s?(${ARM_LOWER}+)${NOT_LETTER_AFTER}`, "gu"),
        (whole, digits: string, suffix: string) => {
            const cardinal = cardinalWords(Number(digits));
            return cardinal === undefined ? whole : attachSuffix(cardinal, suffix);
        });

    // 6) DEGREES. ⚠ THE SCALE COMPOUND IS «սելսիուս աստիճան» — scale FIRST and NO genitive, which is where
    //    Western parts from Eastern's «Ցելսիուսի աստիճան». The wiki writes it in the slot three times
    //    ("0 սելսիուս աստիճանին", "-1,8 սելսիուս աստիճանին", "-16,2 սելսիուս աստիճանին") and inverts it
    //    once ("– 93,2 աստիճան սելսիուս"); the majority form ships.
    //    ⚠ AND THE CASE SUFFIX SITS ON THE SIGN — `3800±200°C-ին`, `104 °F-ը`, `40°-ին`, `13.2 °C-էն`.
    // ⚠ THE LOWERCASE SCALE LETTER GOES IN THE CLASS, NOT IN AN `i` FLAG — the suffix class beside it
    //    is genuinely lowercase-only, and `i` folds it so the flag would widen the suffix capture too.
    s = rewrite(s, new RegExp(`(\\d)\\s?°\\s?[CСcс]\\s?-\\s?(${ARM_LOWER}+)${NOT_LETTER_AFTER}`, "gu"), "$1 սելսիուս աստիճան$2");
    s = rewrite(s, new RegExp(`(\\d)\\s?°\\s?[Ff]\\s?-\\s?(${ARM_LOWER}+)${NOT_LETTER_AFTER}`, "gu"), "$1 ֆարենհայթ աստիճան$2");
    // ⚠ NO SCALE LETTER IN THIS ARM, so a case-insensitive flag fixes nothing and only folds ARM_LOWER
    //    into matching uppercase Armenian: `20 °-Ը` would match where it must not.
    s = rewrite(s, new RegExp(`(\\d)\\s?°\\s?-\\s?(${ARM_LOWER}+)${NOT_LETTER_AFTER}`, "gu"), "$1 աստիճան$2");
    s = rewrite(s, /(\d)\s?°\s?[CС](?![\p{L}\p{M}])/gui, "$1 սելսիուս աստիճան");
    s = rewrite(s, /(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 ֆարենհայթ աստիճան");
    s = rewrite(s, /(\d)\s?°/gu, "$1 աստիճան ");

    // 7) SIGNS. ⚠ `±` GETS A PAUSE, not a word: `3800±200°C-ին` is a tolerance and no Western reading of
    //    the sign is attested, while dropping it ran the two figures together into one numeral.
    s = rewrite(s, /\s?±\s?/gu, ", ");
    //    ⚠ AND `÷` IS A RANGE HERE, NOT A DIVISION — `0.96÷1.41 ԱՄ հեռաւորութեան`, the Russian-tradition
    //    span notation, which is the same finding ba recorded for its single instance.
    s = rewrite(s, /(\d)\s?÷\s?(?=\d)/gu, "$1, ");
    s = rewrite(s, /(^|(?<!\d)[\s(])[-−–]\s?(\d)/gu, "$1մինուս $2");

    // 7b) DECIMALS — LAST among the number rules, because this step SPENDS the `.` that step 1 needed to
    //     make its grouping decision (trap 39: a guard's evidence has a lifetime). `ամբողջ` ×37 is the
    //     word between the halves, the same one hy.wikipedia reads aloud for 0.(9) («զրո ամբողջ ինը
    //     պարբերական»), and this corpus corroborates the integer sense directly — "առաջին չորս **ամբողջ**
    //     թիւերու գումարի քառակուսին". The fractional part is a plain cardinal and stays as DIGITS for
    //     the engine's own number path.
    //     ⚠ BOTH LOOKAROUNDS EXCLUDE `[.,]`, which is what keeps a dotted date and a de-grouping survivor
    //     out of the rule entirely.
    //     ⚠ AND A LEADING ZERO IN THE FRACTION IS A SILENT 10× ERROR OTHERWISE — trap 56's worst shape:
    //     `0.037%` left as digits would read *զրօ ամբողջ ԵՐԵՍՈՒՆ ԵՕԹ*, i.e. 0.37, a well-formed Armenian
    //     numeral ten times too big and invisible to DIGIT, RAWMARK, DROP and the referee alike. This
    //     corpus has it (`0.037%`, `0,08 աստիճան/օր`), so each leading zero is spelled with the engine's
    //     own units[0] and the rest stays digits.
    s = rewrite(s, /(?<!\d)(?<!\d[.,])(\d+)[.,](\d+)(?!\d)(?![.,]\d)/gu, (_m, int: string, frac: string) => {
        const zeros = /^0*/u.exec(frac)![0].length;
        const rest = frac.slice(zeros);
        const spelledZeros = Array.from({ length: zeros }, () => NUMBERS.units[0]!).join(" ");
        return [`${int} ամբողջ`, spelledZeros, rest].filter((p) => p !== "").join(" ");
    });

    // 7c) THE EQUALS SIGN, DIGIT-GATED — and ⚠ THIS LANGUAGE IS THE COUNTER-EXAMPLE TO TRAP 62. Five
    //     consecutive rounds found `=` was never an equation (gd wiki headings, tt etymology glosses, chv
    //     library parallel titles, tk typos and byte tables, shn Pali glosses). hyw has 44 and MOST ARE
    //     REAL ARITHMETIC, from its number-theory articles: "100=47+53", "100 = 2 + 3 + 5 + 7 + 11 + 13 +
    //     17 + 19 + 23", "105=3 × 5 × 7", "155=2²+3!+5!+7²-11-13", "364:13=28". Printing the instances is
    //     what tells the two situations apart, and it gave the opposite answer here.
    //     `հաւասար` is attested in exactly that sense in the same article type — "Կատարեալ թիւեր, որոնք
    //     **հաւասար են** իրենց իսկ բաժանարարներու գումարին՝ 6, 28, 496, 8128".
    //     ⚠ THE COPULA IS DROPPED, deliberately: careful Armenian writes «հաւասար է» with the verb after
    //     the second operand, and the tier's slot is BETWEEN them. The bare adjective is what a reader
    //     says aloud for `100 = 47`, and half a two-part reading placed wrongly is worse than the word.
    s = rewrite(s, /(\d)\s?=\s?(?=\d)/gu, "$1 հաւասար ");

    // 8) NUMERIC RANGES. The dash was dropped outright and the endpoints fused into one utterance —
    //    `1915-1923` read as two years with no break at all. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A
    //    CONNECTIVE, the same measured refusal hy makes: the corpus attests `N-էն մինչեւ M` only where
    //    the WRITER chose to write it, and imposing it on 13,235 bare dashes over-claims.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58). Runs AFTER the suffix and sign
    //    rules, which have already spent every hyphen belonging to a suffix or opening a negative.
    s = rewrite(s, /(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = rewrite(s, /(?<![\d.,])(\d+)\s?-\s?(?=\d)/gu, "$1, ");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return rewrite(s, /[^\S\n]{2,}/gu, " ");
}
