/**
 * Yoruba text normalization — the symbols a reader says aloud, before the tokenizer sees them.
 *
 * Every reading here is a measurement from a 112,738-paragraph yo.wikipedia dump (deduplicated from 123,405 —
 * 8.6% of the dump is repeated paragraphs, which inflates exactly the rare forms this work depends on). Yoruba
 * HAS referees (wikipron yor, kaikki yor) but they are word→IPA: they can check how a word is PRONOUNCED, never
 * whether it is the right word for a symbol, so the corpus is the evidence for everything below.
 *
 * ⚠ TWO CLASSES WERE FIRST REFUSED HERE AND THE REFUSALS WERE WRONG — see rules 6 and 7. `degrees` rested on
 * `dígírí` 0 and `sẹ́lísíọ̀sì` 0, spellings I invented, while the corpus borrows `Celsius`/`Fahrenheit` unchanged
 * and says `ìwọ̀n` for the degree; °C alone is 211 occurrences that were being read as a bare number. And `times`
 * was refused as having no operator word while numbers.ts was already using `lọ́nà` — this language's
 * multiplicative particle — for exactly that relation. A wall of accepted silences is a smell, and in this
 * language two of the three highest-frequency entries in it did not survive being re-examined.
 *
 * ⚠ WHAT IS STILL NOT READ, each refused on a measurement rather than left as a silent gap. The refusals that
 * remain are all signs that are BOTH rare AND wordless, which is the distinction the two above failed:
 *   · MINUS — the digit-flanked dash is a RANGE here (see rule 2), so no minus is read at all.
 *   · A BARE ° with no scale letter — 128 occurrences, of which 55 are digit-flanked geographic coordinates
 *     (`7°30′`). The angular `digiri` has 1 hit; three of its four total hits are ACADEMIC degrees.
 *   · PLUS — + is 9 digit-flanked; `àfikún` (564) is a nominal "addition", digit-adjacent 3 times in prose.
 *   · PLUS-MINUS — ± is 18 digit-flanked and no tolerance word occurs anywhere.
 *   · EQUALS — = is 7 digit-flanked; `dọ́gba` (124) means "is equal", digit-adjacent 9 times, too thin to map.
 *   · The COMPARATORS — < occurs 13 times and > 39, NEITHER of them ever between digits.
 *   · DIVIDE — ÷ occurs twice in 21 MB, never between digits.
 *   · A BARE exponent — ³ is 23 occurrences with no cube word anywhere; the squared UNIT is read (rule 4).
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
    units: { km: ["kìlómítà"], ha: ["hẹ́kítà"], mi: ["máìlì"] },
    /**
     * SPEEDS. `80km/w` is 36 occurrences in this corpus and its `/` was silent in every one — and the reading is
     * GLOSSED beside the figure, repeatedly, which is how the frame is known rather than guessed:
     *
     *     iyara ti kilomita ọgọrin ni wakati okan (80km/w)      eighty kilometres in one hour
     *     iyara ti àádóta kilomita ni wakati ọkan (50km/w)
     *     máìlì méjìdínlọ́gọrin ní wákàtí kan (126km/h)
     *
     * ⚠ `w` IS THE YORUBA ABBREVIATION — wákàtí, "hour" — so the corpus writes both `km/w` and the borrowed
     * `km/h`; both are declared. The denominators live here rather than in `units` for the reason this tier
     * documents: a one-letter key in the standalone alternation turns the aircraft `Il-76s` into seconds. As a
     * denominator it can only match after a slash.
     */
    rateDenominators: { w: "wákàtí kan", h: "wákàtí kan" },
    unitPer: "ni",
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
/** The unit nouns this layer expands, and a squared one with no number necessarily beside it. */
const UNIT_WORDS: Record<string, string> = { km: "kìlómítà", ha: "hẹ́kítà" };
const UNIT_SQUARED = /(?<![\p{L}\p{M}])(km|ha)\s*²/gu;
/** `38°C`, `79.63 °F` — a number, the sign, and a scale letter. The bare ° is refused; see the header. */
const SCALED_DEGREE = /(\d+(?:\.\d+)?)\s*°\s*([CFK])(?![\p{L}\p{M}])/gu;
/** A digit-flanked ×: relay legs, dimensions and resolutions. */
const TIMES = /(\d)\s*×\s*(?=\d)/gu;
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

    // ── 4a. a SQUARED UNIT that no number is adjacent to ─────────────────────────────────────────────────
    // The tier reads `250 km²` and `54.92 km²` because a number sits against the unit, but not
    // `9.83 million km²` or `3.79 egbegberun km²`, where a MAGNITUDE WORD comes between — and those are how the
    // corpus writes the large areas. The reading does not depend on the number, so it is claimed here for every
    // occurrence; the tier then sees the words rather than the sign, and its `units` declaration still serves a
    // bare `km` (`12.76 km` → `kìlómítà`).
    s = s.replace(UNIT_SQUARED, (_m, u: string) => `${UNIT_WORDS[u] ?? u} ${SYM.squared}`);

    // ── 4. the shared symbol tier (currency, ampersand) ───────────────────────────────────────────────────
    s = SYMBOLS(s);

    // ── 5. temperature ───────────────────────────────────────────────────────────────────────────────────
    // ⚠ ANOTHER CIRCUMFIX: `ìwọ̀n` before the number, the scale name after — `ìwọ̀n 3.4 Celsius`,
    // `ìwọ̀n 36 sí 50 Fahrenheit`. °C is 211 occurrences and °F 144, every one of them previously read as a bare
    // number with the sign and the scale both silent.
    //
    // ⚠ AND THE SCALE NAMES ARE BORROWED UNCHANGED. This class was refused on `dígírí` 0 / `sẹ́lísíọ̀sì` 0 —
    // Yorubized spellings that do not exist — while the corpus writes `Celsius` (9) and `Fahrenheit` (5) as they
    // are, with `ìwọ̀n` (1,198) for the degree. Every readable spelled-out temperature in the corpus carries
    // ìwọ̀n somewhere in the phrase, which is why it is emitted rather than the scale name alone.
    //
    // ⚠ BEFORE THE DECIMAL RULE, so `100.4°F` is still one number when the scale is claimed.
    s = s.replace(SCALED_DEGREE, (_m, num: string, letter: string) =>
        `${SYM.degree} ${num} ${SYM.scales[letter.toUpperCase()] ?? letter}`);

    // ── 6. multiplication ────────────────────────────────────────────────────────────────────────────────
    // ⚠ `lọ́nà` IS THIS LANGUAGE'S MULTIPLICATION WORD — numbers.ts uses it for exactly this relation
    // (`ẹgbẹ̀rún lọ́nà ogún` = 1000×20, 77 instances after that magnitude alone), so refusing × as wordless
    // while the compositor multiplied with it was not defensible.
    //
    // The honest limit: the particle is attested between SPELLED-OUT numerals, never between digits, so this
    // composes a symbol reading from an attested piece — a lead rather than a finding, in the playbook's terms.
    // It is preferred to silence because all 72 digit-flanked × are relay legs (`4 × 100 metres`), dimensions
    // (`2×4`, `8×8`) and resolutions (`1920 × 1080`), where dropping the sign runs two numbers together.
    s = s.replace(TIMES, `$1 ${SYM.times} `);

    // ── 7. the decimal separator ──────────────────────────────────────────────────────────────────────────
    // ⚠ LAST, AND THE ORDER IS LOAD-BEARING. Run before rule 3 this splits `8.3%` into two numbers and the
    // percent circumfix wraps only one half; run before rule 5 it turns `100.4°F` into `100 àti dásímà 4°F` and
    // the scale attaches to the fraction digit. Every rule that must see a decimal number WHOLE comes first.
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

    // Removing a redundant `(60%)` leaves the space on both sides of it, so a doubled space would survive into
    // the token stream where the gloss used to be.
    return s.replace(/[ \t]{2,}/gu, " ");
}
