/**
 * Latin (la) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/la.jsonc` — la.wikipedia dump, 557,823 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 327,545 · `year` 326,310 · `abbrev` 113,531 ·
 * `initialism` 94,350 · `letter-name` 83,881 · `ranges` 70,498 · `ordinal-latin` 58,175 · `dotted` 34,187 ·
 * `roman` 27,892 · `decimals` 11,827 · `era-marker` 11,499 · `signs` 7,884 · `grouped` 5,225 ·
 * `fractions` 3,827 · `clock` 4,031 · `percent` 2,774 · `units` 2,221 · `arithmetic` 1,822 ·
 * `exponent` 1,128 · `degrees` 519 · `currency` 174.
 *
 * ⚠ THE BIGGEST CELL IN THIS ARTIFACT IS AN HTML ENTITY. `ampersand` is **30,613** corpus-wide — more
 * than any language in the fleet — and printing the instances shows that essentially all of them are
 * `&nbsp;`, which this corpus uses as its THOUSANDS SEPARATOR (`1&nbsp;320&nbsp;000&nbsp;000 km³`,
 * `25&nbsp;000&nbsp;000 km³`). `core/markup.ts` already folds it to a space before this pass runs. The
 * BARE `&` is ×22 in the retained text and not one is Latin prose: English book titles (`Astronomy &
 * Astrophysics`, `Harper & Row`), a French film title (`Astérix & Obélix`) — and two that ARE Latin,
 * `&c.` for *et cetera*, which is the one this file claims. A count is a lead, never a finding (trap 2).
 *
 * ⚠ AND THE ARITHMETIC SIGNS ARE REAL HERE, which is the second round running to say so after hyw
 * overturned trap 62. la.wikipedia has articles ON ARITHMETIC, WRITTEN IN LATIN: `6/3 = 2`,
 * `73 = 5 × 14 + 3`, `1/2 = 2/4 = 3/6 = 4/8 = 5/10`, `si summa > 11 sit`, `232.3² = 232.3 × 232.3`. The
 * signs are contentful and dense — but see the refusal below, because being real is not the same as
 * being readable.
 *
 * ⚠ THE CORPUS GLOSSES ITS OWN NOTATION THREE TIMES, and every word this file emits comes from one of them:
 *   · DEGREE and SCALE, in one paragraph: "Mediocris temperatura est **10.6° C**. Mensis Iulius est
 *     calidissimus, quo **18.0 gradus Celsius**, frigidissimus Ianuarius, quo 3.4° C" — the same
 *     publication writing the sign and the words for it three sentences apart. And the ANGULAR sense
 *     beside it: "inter 36° et 43,5° **gradus latitudinis** septentrionalis".
 *   · PERCENT, in one sentence: "electus est cum **53,79%** suffragiorum contra **46,21 centesimae**
 *     suffragiorum Norberti Hofer" — the sign and the word for the same quantity, in one clause.
 *     ⚠ And an older idiom is glossed against the sign directly: "in cellula **octogena per centena
 *     (80%)** eorum sunt in ribosomatibus".
 *   · THE ERA is its own expansion: `a.C.n.` is *ante Christum natum* and `p.C.n.` *post Christum natum*,
 *     written in the corpus as "anno 31 **a.C.n.**", "anno 15 **a.C.n.**", "saeculi II **p.C.n.**".
 *
 * ⚠ THERE IS NO ROMAN-ORDINAL POLICY, AND THAT IS THIS ROUND'S REAL FINDING. Every other language in this
 * sweep got one — ba, tt, chv, tk each read `XIX century` as an ordinal — and each works because the
 * ordinal is INVARIANT (Turkic) or agrees only in gender with one fixed noun. **Latin ordinals decline
 * for five cases × three genders**, and this corpus's 26 retained Roman numerals span the paradigm:
 *
 *     liber II          → secundus   nominative masculine
 *     Capitulum VII     → septimum   nominative neuter
 *     saeculi II p.C.n. → secundi    GENITIVE
 *     XIV Februario     → quarto decimo   ABLATIVE (a date)
 *     libri III         → tres       …and this one is a CARDINAL, "three books"
 *     MMXIX · Num. XV, 37 · Matth. IX,20.21   a year and two Bible references, cardinal
 *     Ludovicus II · Napoleonis III           regnal, and the second is itself genitive
 *
 * A context-keyed policy would have to decline the ordinal to match a noun whose case it cannot see, and
 * `libri III` proves the noun does not even settle the ORDINAL-vs-CARDINAL question. The shared cardinal
 * pass already reads every one of them as a number, which is right for six and wrong for the rest; the
 * ordinal is left unclaimed rather than authored wrong in a majority of slots (trap 14, at full strength).
 *
 * ⚠ AND THE ARITHMETIC SIGNS ARE REFUSED FOR THE SAME REASON. `aequat`, `multiplicatum per`, `divisum
 * per`, `maius quam` are all standard mathematical Latin, and the corpus's own arithmetic article writes
 * its prose around the signs rather than for them ("Debemus fractionem facere: 73 = 5 × 14 + 3") — it
 * never spells one out. Emitting an unsourced verb into an equation whose operands this layer also cannot
 * decline is two guesses stacked; the signs stay visible to the leak gates instead.
 */
import { foldNativeDigits } from "../../core/unicode.ts";

/** ⚠ NEVER `\b` here even though Latin is ASCII-adjacent: the alphabet carries macrons and diaereses
 *  (`ā ē ī ō ū ȳ ë ï ö ü ÿ`), which `\b` treats as boundaries and would cut a word in half (trap 1/23). */
const NOT_BEFORE = "(?<![\\p{L}\\p{M}])";
const NOT_AFTER = "(?![\\p{L}\\p{M}])";

/** Normalize one Latin input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeLatin(input: string): string {
    let s = foldNativeDigits(input);

    // 1) DE-GROUPING. ⚠ THE SEPARATOR IS `&nbsp;`, which `core/markup.ts` has already turned into a
    //    no-break space by the time this runs — `1&nbsp;320&nbsp;000&nbsp;000 km³`, `25&nbsp;000&nbsp;000`,
    //    `1&nbsp;582 relatis`. Left alone the groups read as separate numbers (*unus trecenti viginti
    //    nihil nihil*).
    //    ⚠ AND THE WHOLE NUMBER IS MATCHED AT ONCE, NOT ONE JOIN PER PASS. The repeat-a-two-digit-join
    //    idiom the rest of this sweep uses (`(\d)[ ](\d{3})(?!\d)`, two or three passes) is correct for
    //    up to THREE groups and silently wrong at four: on `1 320 000 000` the first pass consumes
    //    `1 320`, the scan resumes inside the remainder and anchors on the LAST digit of the next group,
    //    and the result is `1320 000000` — which then reads as *mille trecenti viginti* followed by
    //    *nihil*, a well-formed Latin numeral for a completely different quantity. Measured across the
    //    seven artifacts this sweep has touched, four-or-more-group numbers occur **twice here and once
    //    in ba**, and nowhere else — which is why the idiom held everywhere it was used before now.
    //    ⚠ AND THE TRAILING GUARD REJECTS A DIGIT, NOT A DOT — trap 58, caught by `review.ts`'s
    //    clause-final probe after I wrote `(?![\d.,])` and lost the whole grouping on `1 320 000,`. A
    //    guard carrying a bare `.` or `,` declines every clause-final figure; what it has to exclude is a
    //    separator that is CONTINUING the number (`.5`), which is `(?![.,]\d)`.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:[    ]\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[    ]/gu, ""));
    s = s.replace(/[    ]/gu, " ");

    // 2) THE ERA MARKER — Latin's own, and its own expansion. `a.C.n.` = *ante Christum natum*,
    //    `p.C.n.` = *post Christum natum*, written in this corpus as "anno 31 a.C.n.", "anno 15 a.C.n.",
    //    "saeculi II p.C.n.". They were reaching the g2p letter-by-letter with three false clause pauses.
    //    The shorter `a.C.`/`p.C.` forms are claimed on the same terms. ⚠ THE LONGER FORM FIRST, or the
    //    two-letter rule eats its prefix and strands the `n.`. The final dot is kept at a sentence end
    //    (trap 10), or the pause is lost outright.
    const multi: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_BEFORE}a\\s?\\.\\s?C\\s?\\.\\s?n\\s?\\.`, "gu"), "ante Christum natum"],
        [new RegExp(`${NOT_BEFORE}p\\s?\\.\\s?C\\s?\\.\\s?n\\s?\\.`, "gu"), "post Christum natum"],
        [new RegExp(`${NOT_BEFORE}a\\s?\\.\\s?C\\s?\\.${NOT_AFTER}`, "gu"), "ante Christum"],
        [new RegExp(`${NOT_BEFORE}p\\s?\\.\\s?C\\s?\\.${NOT_AFTER}`, "gu"), "post Christum"],
    ];
    for (const [re, word] of multi)
        s = s.replace(re, (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 3) `&c.` — the ligature of *et* and *c(etera)*, and the only Latin use of the ampersand in this
    //    corpus: "Thesei, &c.", "cum Praenestinis; &c." It reached the g2p as a bare [k] plus a false
    //    full stop. ⚠ The spelled form is in the same artifact ("73, 73.0, 73.00, et caetera omnes eundem
    //    …"), which is what fixes the expansion rather than leaving it to a dictionary.
    s = s.replace(new RegExp(`&\\s?c\\s?\\.`, "gu"), "et cetera");

    // 4) DEGREES — and this corpus glosses both senses. THERMAL: "Mediocris temperatura est 10.6° C …
    //    quo 18.0 gradus Celsius, frigidissimus Ianuarius, quo 3.4° C", one paragraph writing the sign
    //    and the words for it. ANGULAR: "inter 36° et 43,5° gradus latitudinis septentrionalis".
    //    The scale letter is claimed first so it is not left to `core/foreign.ts` and the English letter
    //    name, which is what `°C` and `°F` were doing ([k] and [f] here, since Latin reads them natively).
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 gradus Celsius");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 gradus Fahrenheit");
    //    ⚠ WITH A TRAILING SPACE, because the corpus writes the sign glued to a following word this rule
    //    does not claim (`43,5° gradus latitudinis`). The final space-collapse removes the doubling.
    s = s.replace(/(\d)\s?°(?!\s*gradus)/gu, "$1 gradus ");
    s = s.replace(/(\d)\s?°(?=\s*gradus)/gu, "$1 ");

    // 5) SIGNS. The minus INVERTS and is read; the plus is lossless where it appears (inside the
    //    arithmetic identities of step 0's refusal) and is not.
    s = s.replace(/(^|(?<!\d)[\s(])[-−–]\s?(\d)/gu, "$1minus $2");

    // 6) RANGES. The dash was dropped outright and the endpoints fused into one utterance — `1732-1735`
    //    read as two years with no break at all, `pp. 1-43` as one number. ⚠ THE DASH IS SPENT ON A PAUSE
    //    RATHER THAN A CONNECTIVE: Latin marks a span with `ab … ad` or the ablative, both of which need
    //    a case this layer cannot supply for the same reason the ordinal is refused.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58).
    //    ⚠ AND AN ISBN IS NOT A RANGE. `ISBN 978-3-8273-7360-1` and `0-333-75088-8` are four and five
    //    hyphen-joined groups; a span has exactly two operands, so the rule refuses any figure that is
    //    already preceded by `digit-` — which is what leaves the identifier as a run of read numbers
    //    rather than a string of false pauses.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    //    ⚠ AND THE GUARD NEEDS `(?!\d)` BEFORE IT, OR BACKTRACKING DEFEATS IT — trap 59's family. Written
    //    as `(\d+)(?!\s?-\s?\d)`, the engine simply gives back a digit: on `0-333-75088-8` it fails the
    //    lookahead with `333`, retries with `33`, finds a plain `3` after it, and emits `0, 333-75088-8`.
    //    Pinning the second operand's end with `(?!\d)` first removes the give-back entirely.
    s = s.replace(/(?<![\d.,-])(\d+)\s?-\s?(\d+)(?!\d)(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
