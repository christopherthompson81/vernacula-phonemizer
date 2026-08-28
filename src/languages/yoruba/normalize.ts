import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";
import { tr } from "../../core/provenance.ts";

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

/**
 * ⚠ NO `percent` AND NO `percentPrefix`, AND THE SABOTAGE SWEEP IS WHAT PROVED IT. Both were declared here and
 * both were DEAD: rule 3 below consumes every `%` in the string before this tier ever runs, because Yoruba's
 * percent is a CIRCUMFIX (`ìdá 84 nínú ọgọ́rùn-ún`) and `percentPrefix` can only move ONE word to the front.
 * Wrecking the manifest key moved zero readings — the declaration claimed a route the text never takes. It is
 * removed rather than left as documentation: a tier field that is read by nothing is a false statement about
 * where this language's percent word comes from. See `SYM.percentBefore`/`SYM.percentAfter` at rule 3.
 */
const SYMBOLS = makeSymbolNormalizer({
    ampersand: SYM.and,
    exponentWords: { squared: [SYM.squared], position: "after" },
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    unitPer: MANIFEST.symbolTier.unitPer,
    rateDenominators: MANIFEST.symbolTier.rateDenominators,
});

const GROUPED = /(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))/gu;
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

/**
 * THE BARE METRE, CLAIMED LOCALLY RATHER THAN IN THE TIER — and the reason is one measured counter-example
 * class that a `units` entry has no way to decline.
 *
 * The word is not in doubt. *mítà* is 69 tokens / 20 articles on yo.wikipedia and its metre article is
 * definitional — *"Mítà je eyo tìpìlẹ̀ ìwọ̀n ìgùn ninu Sistemu Kakiriaye fun awon Eyo (SI)"*, "the metre is
 * the base unit of length in the International System of Units" — with running text to match: *"òkè òkúta
 * iyanrìn tó ga tó 500 MÍTÀ (1,600 ẹsẹ̀ bàtà)"*, *"omi náà dé ibi gíga jùlọ ní 8.62 MÍTÀ (28.3 ft)"*. It is
 * also the stem this file already ships inside `kìlómítà` and `mílímítà`.
 *
 * ⚠ WHAT IS IN DOUBT IS THE ONE-LETTER KEY, and unlike `l` above the measurement here is NOT clean. Rebuilt
 * with the tier's own digit-adjacent guard over the mined artifact, `m` matches THREE times:
 *     `2419 m (7936 ft)`   — Chappal Waddi's elevation. A genuine metre.
 *     `9h 50m 30.0s`       — MINUTES. Jupiter's rotation period.
 *     `9h 55m 40.6s`       — MINUTES. The same article, the System III period.
 * One right against two wrong is not a key this file may hand to the tier: `50 mítà` for fifty minutes is
 * confidently wrong, which is worse than the raw letter it replaces. But refusing outright leaves every
 * Yoruba metre unread, and the brief's standing rule is that a thin corpus is evidence about the corpus.
 *
 * So the metre is read HERE, with a left guard that declines exactly the losing shape: a digit, an `h`, and
 * a space immediately before the number is the `Nh Nm Ns` astronomical/duration notation, and nothing else
 * in this corpus writes it. 1 of 1 genuine claimed, 2 of 2 counter-examples declined.
 * ⚠ AND NOTHING IS LOST BY KEEPING IT OUT OF THE TIER, measured rather than assumed: the tier would add a
 * rate and an exponent path, and this corpus has `m/s` ×0 and a bare `m²` ×0 (all 24 of its `m`-superscripts
 * are `km²`, which `UNIT_SQUARED` and the tier already read).
 * ⚠ POSTPOSED, like every other unit here — see the units note above for why the corpus's preposed
 * instances are athletics event names rather than measurements.
 */
const METRE = /(?<![\p{L}\p{M}\d.,])(?<!\p{Nd}h[ \u00a0])(\d+(?:\.\d+)?)[ \u00a0]?m(?![\p{L}\p{M}'’\d])/gu;  // space, NBSP
const METRE_WORD = SYM.metre;

/** The unit nouns this layer expands, and a squared one with no number necessarily beside it. */
const UNIT_WORDS: Record<string, string> = { km: "kìlómítà", ha: "hẹ́kítà" };
/** The remaining `units` keys `sq` may precede — see rule 4a. Kept beside `UNIT_WORDS` rather than merged
 *  into it, because that table is also `UNIT_SQUARED`'s, and `mi²`/`ft²` are ×0 in this corpus. */
const SQ_UNITS: Record<string, string> = { mi: "máìlì", ft: "ẹsẹ̀ bàtà" };
const UNIT_SQUARED = /(?<![\p{L}\p{M}])(km|ha)\s*²/gu;
/** `38°C`, `79.63 °F` — a number, the sign, and a scale letter. The bare ° is refused; see the header. */
const SCALED_DEGREE = /(\d+(?:\.\d+)?)\s*°\s*([CFK])(?![\p{L}\p{M}])/gui;
/** A digit-flanked ×: relay legs, dimensions and resolutions. */
const TIMES = /(\d)\s*×\s*(?=\d)/gu;
const DECIMAL = /(\d)\.(\d+)/gu;

/** Normalize Yoruba text: symbols the reader voices become words, before `yoruba.ts`'s TOKEN sees them. */
export function normalizeYoruba(text: string): string {
    let s = text;
    // 1. De-group thousands FIRST: a grouping comma left in place makes one number into two with a clause pause
    //    (`2,500` → *méjì , ẹgbẹ̀rún márùn-ún*). Exactly three following digits so a decimal comma survives.
    s = tr(s, GROUPED, "");
    // 2. ⚠ A DIGIT-FLANKED DASH IS A RANGE, NOT A MINUS — `sí` ("to") is what occurs between digits.
    s = tr(s, RANGE, `$1 ${SYM.range} `);
    // 2b. THE MINUS — U+2212 ONLY, and a LEADING one. ⚠ THE RANGE ABOVE IS WHY: this language's
    //     digit-flanked dash is a range 7,537 times over, so the sign is claimed only where a dash cannot
    //     be one. `alòdì` is sourced in `yoruba.jsonc` against yo.wikipedia's own `-1.44, -1` gloss.
    //     ⚠ U+2212 AND NOT THE HYPHEN. The hyphen is the range's own character and Yoruba's compounding
    //     (`ọgọ́rùn-ún`, `gram-negatibo`); U+2212 can only be the operator, which is what licenses reading
    //     a sign this corpus never spells out. 81 U+2212 on yo.wikipedia, with genuine prose temperatures
    //     (`ìwọ̀n otútù àròpín ti −47.6 °C`, `−38 °C`, `−39.8 °C`, `−65 °C`) that read as POSITIVE until now.
    //     ⚠ `(?<!\p{Nd}\s)` REFUSES THE SPACE-SEPARATED EXPONENT — this corpus writes one
    //     (`1.98739x10 −21 s`), and a one-character lookbehind sees only the space before it.
    s = tr(s, /(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}\s)\u2212(?=\p{Nd})/gu, `${SYM.negative} `);
    // 3. ⚠ YORUBA'S PERCENT IS A CIRCUMFIX: a word BEFORE the number and a phrase AFTER it. A parenthesised
    //    percentage restating one already spelled out is dropped rather than read twice.
    s = tr(s, /\(\s*(\d+(?:\.\d+)?)\s*%\s*\)/gu, (m, num: string, at: number, whole: string) =>
        SAID_AFTER.test(fold(whole.slice(Math.max(0, at - 60), at))) ? "" : m,
    );
    s = tr(s, PERCENT, (_m, num: string, at: number, whole: string) =>
        SAID_AFTER.test(fold(whole.slice(at, at + 40))) || SAID_BEFORE.test(fold(whole.slice(Math.max(0, at - 20), at)))
            ? num
            : `${SYM.percentBefore} ${num} ${SYM.percentAfter}`,
    );
    // 4. Squared units, then the shared symbol tier.
    s = tr(s, UNIT_SQUARED, (_m, u: string) => `${UNIT_WORDS[u] ?? u} ${SYM.squared}`);
    // 4a. ⚠ THE ENGLISH MEASURE WORD `sq`, WHICH COSTS TWO READINGS RATHER THAN ONE — the `so` finding
    //     exactly. `ìwọ̀n ilẹ̀ tó tó 705.78sq km 2` is Ibarapa East's area, and the `sq` stands BETWEEN the
    //     number and the unit, so the tier's digit-adjacent unit path declines as well: the `km` leaks raw
    //     AND the area is lost. Note it is GLUED to the number here, which is why the gap is optional.
    //     ⚠ ONLY BEFORE A DECLARED UNIT, so `sq ft`-style phrases whose unit this file cannot read keep
    //     their `sq` rather than half the phrase being spoken. Emitted as unit-then-modifier, the position
    //     `exponentWords` already declares for this language.
    s = tr(s,
        /(?<![\p{L}\p{M}])sq\.?\s*(km|ha|mi|ft)(?![\p{L}\p{M}\d])/giu,
        // ⚠ A LEADING SPACE, because the corpus writes `705.78sq` GLUED and the replacement would otherwise
        // fuse the noun onto the numeral (`8kìlómítà`) for the tokenizer to swallow whole. The trailing
        // whitespace collapse at the end of this function spends the extra one in the spaced case.
        (_m, u: string) => ` ${UNIT_WORDS[u.toLowerCase()] ?? SQ_UNITS[u.toLowerCase()] ?? u} ${SYM.squared}`,
    );
    s = SYMBOLS(s);
    // 4b. ⚠ THE BARE METRE, AFTER THE TIER AND NOT INSIDE IT. See METRE for the two `9h 50m` counter-examples
    //     that keep `m` out of `units`. After the tier so every shape the tier CAN read gets first refusal —
    //     `10 km`, `56 km²`, `100 km/h` all consume their `m` there and never reach this pattern — and before
    //     rule 7, which still needs `8.62` intact to be this reading's operand.
    s = tr(s, METRE, (_m, num: string) => `${num} ${METRE_WORD}`);
    // 5. ⚠ ANOTHER CIRCUMFIX: `ìwọ̀n` before the number, the scale name after. The scale names are borrowed
    //    unchanged. Must run BEFORE the decimal rule so `100.4°F` is still one number when the scale is claimed.
    s = tr(s,
        SCALED_DEGREE,
        (_m, num: string, letter: string) => `${SYM.degree} ${num} ${SYM.scales[letter.toUpperCase()] ?? letter}`,
    );
    // 6. `lọ́nà` is this language's multiplication word — numbers.ts uses it for the same relation. The honest
    //    limit: it is attested between SPELLED-OUT numerals, not between digits, so this composes a symbol
    //    reading from an attested piece. Preferred to silence because every digit-flanked × here is a relay leg,
    //    dimension or resolution, where dropping the sign runs two numbers together.
    s = tr(s, TIMES, `$1 ${SYM.times} `);
    // 7. ⚠ THE DECIMAL SEPARATOR LAST, AND THE ORDER IS LOAD-BEARING. Before rule 3 it splits `8.3%` and the
    //    percent circumfix wraps only one half; before rule 5 it turns `100.4°F` into `100 àti dásímà 4°F`.
    s = tr(s, DECIMAL, (_m, whole: string, frac: string) => `${whole} ${SYM.decimalWord} ${[...frac].join(" ")}`);
    return s.replace(/[ \t]{2,}/gu, " ");
}
