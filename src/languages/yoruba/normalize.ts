/**
 * Yoruba text normalization — the symbols a reader says aloud, before the tokenizer sees them.
 *
 * Every reading here is a measurement from a 112,738-paragraph yo.wikipedia dump (deduplicated from 123,405 —
 * 8.6% of the dump is repeated paragraphs, which inflates exactly the rare forms this work depends on). Yoruba
 * HAS referees (wikipron yor, kaikki yor) but they are word→IPA: they can check how a word is PRONOUNCED, never
 * whether it is the right word for a symbol, so the corpus is the evidence for everything below.
 *
 * ⚠ WHAT IS DELIBERATELY NOT READ, each refused on a measurement rather than left as a silent gap:
 *   · DEGREES — ° is 390 trailing a number, and it is the sign this language most conspicuously writes. But
 *     `dígírí` has 0 hits ANYWHERE and `sẹ́lísíọ̀sì` 0, so there is no scale word to say.
 *   · MULTIPLICATION — × is 72 digit-flanked; `ìlọ́po` (75 whole) is never digit-adjacent even once.
 *   · PLUS — + is 9 digit-flanked; `àfikún` (564) is a nominal "addition", digit-adjacent 3 times in prose.
 *   · MINUS — the digit-flanked dash is a RANGE here (see rule 2), so no minus is read at all.
 *   · EQUALS — = is 7 digit-flanked; `dọ́gba` (124) means "is equal", digit-adjacent 9 times, too thin to map.
 *
 * ⚠ AND `ẹsẹ` FOR THE DECIMAL POINT WAS FOUND IN A DICTIONARY AND STILL REFUSED, which is the distinction the
 * playbook draws. Fakinlede's Yoruba–English Mathematics Dictionary (2017) gives `Ẹsẹ` = "decimal point" — but
 * that glossary belongs to a project explicitly modernising Yoruba numerals for science, and `ẹsẹ`/`ẹsẹ̀` has
 * 478 whole-word hits in this corpus meaning FOOT or LEG in every one (`ẹsẹ̀ rẹ`, `ọwọ́ àti ẹsẹ̀`, `ẹsẹ̀ bàtà`).
 * `3.5` would read as "three feet five". A refusal on SENSE stands on the corpus alone; it was refusal on
 * SILENCE that needed a dictionary (see igbo's ntụkpọ), and the corpus is not silent here — see rule 5.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";

const SYM = MANIFEST.symbols;

const SYMBOLS = makeSymbolNormalizer({
    /**
     * ₦ leads a number 85 times and $ 710 (593 bare + 117 as `US$`); `náírà` is 71 whole-word hits and `dọ́là`
     * 78. The word FOLLOWS the number — `ẹgbàáta náírà (N30,000.00)`, 4:1 and 3:1 for the two — which is the
     * tier's default, so no `currencyPrefix`.
     *
     * £ (141) and € (95) occur but `pọ́ọ̀ndì` has 0 hits and `yúrò` 2: signs without words, so unread.
     */
    /**
     * ⚠ `US$` IS DECLARED AS ITS OWN KEY, and the tier's own documentation says why: the pattern is
     * letter-bounded on the left so a bare `$` cannot match inside `US$83.33`, and the artifact scan reported 6
     * dropped currency signs that were all of that shape. `US$` is 110 occurrences with 106 followed by a digit,
     * and `dọ́là Amẹ́ríkà` is the attested wording (5). Keys are matched longest-first, so this wins over `$`.
     */
    currency: { "US$": ["dọ́là Amẹ́ríkà"], "₦": ["náírà"], $: ["dọ́là"] },
    /**
     * ⚠ DECLARED BUT ALMOST UNREACHABLE, and the reason is architectural rather than idiomatic. Yoruba's
     * percent is a CIRCUMFIX (`ìdá 84 nínú ọgọ́rùn-ún`) and `SymbolData` can express a prefix or a suffix but
     * not both ends, so rule 3 below consumes every `%` that sits next to a number before this tier ever runs.
     * What is left for the tier is a `%` with no adjacent digit, where the leading half alone is the best
     * available reading — a partial reading of a stray sign, not a wrong word.
     */
    percent: [SYM.percentBefore],
    percentPrefix: true,
    /** `àti` — the ordinary Yoruba connective, 42,897 whole-word hits and 430 of them digit-flanked. */
    ampersand: SYM.and,
    /**
     * SQUARED UNITS. `km²` is 754 occurrences and its ² was dropped in every one; the reading is attested in
     * exactly the frame the tier emits — `kìlómítà onígun mẹ́rin`, the measure word AFTER the unit noun, 9
     * instances directly following a unit (27 for the phrase overall).
     *
     * ⚠ ONLY `km` AND `ha` ARE DECLARED, deliberately. `mítà` (205) is the right word for `m`, but a
     * one-letter unit key collides with plural-s and alphanumeric designations — the Dutch lesson recorded in
     * this tier's own `rateDenominators` comment, where declaring `s` turned the aircraft `Il-76s` into
     * *seventy-six seconds*. `m²` is 12 occurrences here, which does not buy that risk.
     *
     * CUBED is NOT declared: ³ occurs 23 times and no cube word appears anywhere in the corpus, so there is
     * nothing to say. The bare-exponent reading is likewise absent — see `exponent` in the refusals above.
     */
    units: { km: ["kìlómítà"], ha: ["hẹ́kítà"] },
    exponentWords: { squared: [SYM.squared], position: "after" },
});

/** Grouping is a COMMA (1,829 lines against 86 period-grouped) — the Nigerian convention. */
const GROUPED = /(\d),(\d{3})(?!\d)/gu;
/** A digit-flanked dash. See rule 2: in Yoruba this is a RANGE, never a minus. */
const RANGE = /(\d)\s*[-–—]\s*(?=\d)/gu;
/** `60%`, `8.3%` — the sign FOLLOWS the number, 1,287 times, and 0 lead it. */
const PERCENT = /(\d+(?:\.\d+)?)\s*%/gu;
/**
 * The circumfix already spelled out in the text — see trap 12 in rule 3.
 *
 * ⚠ MATCHED ON A TONE-FOLDED COPY, NOT WITH A CHARACTER CLASS. The first version wrote `[ọ́o]` to accept the
 * word with or without its accent, and a character class CANNOT hold `ọ́`: there is no precomposed codepoint
 * for it, so the class contained ọ, a bare combining acute and o as three separate members and the pattern
 * never matched what it was aimed at. The guard silently did nothing — `(84%)` beside a spelled-out `ìdá 84
 * nínú ọgọ́rùn-ún` was read a second time. Folding the marks away first makes the tone-optionality free.
 */
const fold = (x: string): string => x.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
const SAID_AFTER = /ninu\s+[oọ]g[oọ]run/u;
const SAID_BEFORE = /(?:[iì]da|[iì]pin)\s*$/u;
/** A decimal period (3,317 lines, against 71 with a decimal comma). */
const DECIMAL = /(\d)\.(\d+)/gu;

/** Normalize Yoruba text: symbols the reader voices become words, before `yoruba.ts`'s TOKEN sees them. */
export function normalizeYoruba(text: string): string {
    let s = text;

    // ── 1. de-group thousands ─────────────────────────────────────────────────────────────────────────────
    // FIRST, because a grouping comma left in place makes one number into two with a clause pause between
    // them: `2,500` read *méjì , ẹgbẹ̀rún márùn-ún*. Exactly three following digits, so a decimal comma —
    // rare here (71 lines) but real — cannot be eaten.
    while (GROUPED.test(s)) { GROUPED.lastIndex = 0; s = s.replace(GROUPED, "$1$2"); }

    // ── 2. ranges ─────────────────────────────────────────────────────────────────────────────────────────
    // ⚠ A DIGIT-FLANKED DASH IS A RANGE, NOT A MINUS. `sí` ("to") is 1,427 times digit-flanked, and the
    // corpus glosses the reading twice over: `ọgọ́rùn-ún méjì sí mẹ́fà (200-600 kg)` and, for a scoreline,
    // `góòlù mẹ́rin sí òdo (4–0)`. Reading a minus here would turn every date range into arithmetic — the
    // defect ig, nl, mr, ta and yue each record as the reason their minus is an accepted silence.
    s = s.replace(RANGE, `$1 ${SYM.range} `);

    // ── 3. percent ────────────────────────────────────────────────────────────────────────────────────────
    // ⚠ YORUBA'S PERCENT IS A CIRCUMFIX — a word BEFORE the number and a phrase AFTER it — which is why this
    // is here and not in the shared tier (that supports a prefix or a suffix, not both ends).
    //
    //     ìdá 84 nínú ọgọ́rùn-ún        "portion 84 in a hundred"
    //
    // Two constructions are attested and the totals nearly tie: `ọgọ́rùn-ún lọ́nà X` ("hundred by X") 115
    // instances against `ìdá X nínú ọgọ́rùn-ún` 94. What settles it is the form writers use when the number is
    // a DIGIT, which is what this rule produces: `ìdá <digit> nínú ọgọ́rùn-ún` 21, the other 0. All 21 read
    // correctly in context and one glosses itself with the sign present — `ìdá 480 nínú ọgọ́rùn ún(480%)`.
    // Trap 12: where a sentence writes BOTH the sign and the words — `ìpín ọgọ́ta nínú ọgọ́rùn-ún (60%)`, which
    // is how the corpus glosses itself — the sign is dropped rather than read, or the reading says it twice.
    s = s.replace(/\(\s*(\d+(?:\.\d+)?)\s*%\s*\)/gu, (m, num: string, at: number, whole: string) =>
        SAID_AFTER.test(fold(whole.slice(Math.max(0, at - 60), at))) ? "" : m);
    s = s.replace(PERCENT, (_m, num: string, at: number, whole: string) =>
        SAID_AFTER.test(fold(whole.slice(at, at + 40))) || SAID_BEFORE.test(fold(whole.slice(Math.max(0, at - 20), at)))
            ? num
            : `${SYM.percentBefore} ${num} ${SYM.percentAfter}`);

    // ── 4. the shared symbol tier (currency, ampersand) ───────────────────────────────────────────────────
    s = SYMBOLS(s);

    // ── 5. the decimal separator ──────────────────────────────────────────────────────────────────────────
    // ⚠ LAST, AND THE ORDER IS LOAD-BEARING: run before rule 3, this would split `8.3%` into two numbers and
    // the percent circumfix would wrap only one half.
    //
    // The separator is `àti dásímà` — "and decimal" — and the fraction is read DIGIT BY DIGIT. Both come from
    // the same 18 instances, which are unanimous on the frame:
    //
    //     bílíọ̀nù mẹ́rin àti dásímà ọ̀kan mẹ́rin     4.14 billion   (fraction: one, four)
    //     mílíọ̀nù mẹ́sàn-án àti dásímà ẹjọ ẹjọ       9.88 million   (eight, eight)
    //     odo àti dásímà márùn-ún odo                 0.50
    //
    // ⚠ `dásímà` IS A BORROWING OF "DECIMAL", AND I FOUND IT ONLY BY ACCIDENT. The candidate list probed for
    // native compounds — ààmì, àmì, ẹ̀là, pọ́ìntì, ojú — every one 0 between digits, and on that evidence this
    // layer was about to declare the separator unreadable. The word surfaced inside a percent extraction. A
    // guessed candidate list is a guess, and its zeros measure the list rather than the language.
    //
    // ⚠ HONEST LIMIT: all 18 cluster in one topic (deforestation statistics), so they may be one translator's
    // usage rather than the language's. What supports it beyond that cluster is the frame's other half — `àti`
    // separating the two parts of a decimal appears in percent constructions from unrelated articles
    // (`ìdá mẹ́fà àti mẹ́ta nínú ọgọ́rùn-ún` = 6.3%). And leaving the period alone is NOT neutral: `yoruba.ts`
    // treats `.` as clause punctuation, so `3.5` read *mẹ́ta . márùn-ún* — a sentence break inside a number.
    s = s.replace(DECIMAL, (_m, whole: string, frac: string) =>
        `${whole} ${SYM.decimalWord} ${[...frac].join(" ")}`);

    // A sentence-final period survives: DECIMAL requires a digit on BOTH sides.
    return s;
}
