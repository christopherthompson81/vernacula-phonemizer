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
     * ⚠ `mm` AND `l` JOIN `km`/`ha`/`mi`; `m` IS STILL NOT HERE, and it is claimed locally instead — see
     * `METRE` below for the two counter-examples that decide it. Cubed is undeclared because no cube word
     * exists in the language's usage here.
     *
     * · `mm` → *mílímítà*, yo.wikipedia 1 token / 1 article and a flood article at that: *"ó sì mú kí òjò
     *   tó ju MÍLÍMÍTÀ 250 rọ̀"* ("rain of more than 250 mm fell"). ⚠ One article is a lead, so the
     *   UNTONED spelling was probed as its own word and carries the finding: `milimita` is 12 tokens / 9
     *   articles, every readable hit rainfall or a botanical measurement — *"1189.7 milimita gbogbo òjò"*,
     *   *"òjò tí ó ju milimita 150 (5.9 in) lọ"*, *"10 nípasẹ 10 milimita"*, *"àwọn milimita 61.59 ti
     *   ojoriro"*. Same word, tone marks written or not, which is this corpus's normal condition; the
     *   TONED form is emitted because every other unit noun in this file is toned and the g2p reads it.
     * · `l` → *lítà*, 10 tokens / 5 articles, senses read and all volume: *"tó lítà 298 (ẹsẹ̀ onígun mẹ́ta
     *   10.5)"* (a car's boot), *"ẹ̀rọ Ford OHC lítà 2.0"*, *"Jala Porimala Jojona (35,000 lítà)"*, *"lítà
     *   omi bílíọ̀nù 61.7 lójoojúmọ́"*, and a Wikipedia style note that glosses the English outright:
     *   *"wọ́n lè kọ \"one litre\" (LÍTÀ KAN)"*. `líta` is ×0; `lita` ×9 is mostly the footballer Leroy
     *   Lita and a Ford engine displacement, which is why the toned form is the one taken.
     *
     * ⚠ THE ONE-LETTER KEY `l` IS SAFE HERE, AND THE MEASUREMENT IS THE OPPOSITE OF WHAT THE RAW COUNT
     * SAYS (trap 46). A bare grep for a digit then `l` finds THIRTEEN hits in the mined artifact and not
     * one is a litre: every one is Yoruba's proclitic `l-` glued to the next word after a number —
     * `1975 lẹ́yìn`, `1829 látàrí`, `2.8 làti`, `30,000 lábẹ́`, `2015 lọ`, `1985 lóri`, `2012 láti`. That
     * is exactly the shape that bit `mad`, `rn` and `hmn` this session. What saves it is that the tier's
     * trailing guard is `(?![\p{L}\p{M}'’ʼ])` and a Yoruba letter follows the `l` in all thirteen: rebuilt
     * with the guard, the count is 0 matches, so declaring `l` claims nothing the corpus would refuse.
     * ⚠ `L` IS DECLARED ALONGSIDE `l` — the litre's documented exception to the one-letter rule
     * (`resolveUnitSymbol`): both cases are official for this unit and the exact branch is case-sensitive.
     *
     * ⚠ POSTPOSED, AND THE MIXED COUNT RESOLVES ON A READING. Over the mined artifact the unit noun follows
     * its number 4 times and precedes it 6, which looks like the `hil`/`rw` question — but the six are all
     * ATHLETICS EVENT NAMES (`mita 5000`, `mita 3000`, `kilomita 10`, "the 5000 metres"), an idiom naming a
     * race rather than measuring anything, while every genuine MEASUREMENT is digit-first: `4,180 kìlómítà
     * (2,600 miles)`, `500 mítà (1,600 ẹsẹ̀ bàtà)`, `8.62 mítà (28.3 ft)`, `10,000 mita`. 4:0 once the
     * event names are set aside, so the tier's default order stands and no `unitPrefix` is declared.
     */
    /**
     * ⚠ `ft` IS DECLARED, AND IT IS THE ONE PLACE THIS FILE PARTS COMPANY WITH THE FLEET-WIDE IMPERIAL
     * REFUSAL. ak, sn, mos and jv all leave `ft` reported inside a metric-glossing parenthetical, and the
     * reason each of them gives is that the language has NO FOOT WORD to give it. Yoruba has one, and this
     * corpus's own line is the gloss: `tí ọkọọkan tó 150 ẹsẹ̀ (FT) ní gíga` — the abbreviation set beside
     * the Yoruba noun, in the same sentence, as the definition of it. The layer's `METRE` note already
     * quotes a second: `500 mítà (1,600 ẹsẹ̀ bàtà)`.
     *
     * · `ẹsẹ̀ bàtà` — 19 tokens / 15 articles on yo.wikipedia (tools/corpus/attest/yo.jsonc), and every
     *   example read is the imperial foot in a metric gloss: *"ẹ̀ẹ́dẹ́gbẹ̀rún mítà (900m), ìwọ̀n ẹsẹ̀ bàtà
     *   ẹ́ẹ́tà lé-láádọ̀ta-lé-lẹ́gbẹ̀rún méjì (2,953ft)"*, *"mítà méje (ẹsẹ̀ bàtà mẹ́tàlélógún àti ìnṣì)"*,
     *   *"ère … tí ó tó ẹsẹ bàtà mẹrin (1.2 m)"*. The untoned `ẹsẹ bàtà` ×9/8 is the same word.
     * ⚠ THE COMPOUND, NEVER BARE `ẹsẹ̀`, and the header already says why: bare `ẹsẹ̀` is a foot/leg and a
     *   verse-line, which is exactly the wrong-sense argument that keeps it out of the decimal-point slot.
     *   `bàtà` ("shoe") is what makes the measure sense unambiguous, and it is the collocation the corpus
     *   writes.
     * ⚠ POSTPOSED LIKE THE REST, AND THE COUNT LOOKS PREPOSED UNTIL IT IS READ — the same trap this file's
     *   `units` note records for the athletics event names. Six of the attested hits put the noun first,
     *   and in every one of those the number is SPELLED OUT (`ẹsẹ bàtà mẹrin`, `ẹsẹ̀ bàtà mẹ́tàlélógún`) or
     *   the phrase is framed by `ìwọ̀n` ("the measure of"). Where a DIGIT is involved — which is the only
     *   shape this rule can ever match — the corpus writes `1,600 ẹsẹ̀ bàtà` and `150 ẹsẹ̀`, number first.
     */
    units: {
        km: ["kìlómítà"], ha: ["hẹ́kítà"], mi: ["máìlì"], mm: ["mílímítà"], l: ["lítà"], L: ["lítà"],
        ft: ["ẹsẹ̀ bàtà"],
    },
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
const METRE_WORD = "mítà";

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
    // 4a. ⚠ THE ENGLISH MEASURE WORD `sq`, WHICH COSTS TWO READINGS RATHER THAN ONE — the `so` finding
    //     exactly. `ìwọ̀n ilẹ̀ tó tó 705.78sq km 2` is Ibarapa East's area, and the `sq` stands BETWEEN the
    //     number and the unit, so the tier's digit-adjacent unit path declines as well: the `km` leaks raw
    //     AND the area is lost. Note it is GLUED to the number here, which is why the gap is optional.
    //     ⚠ ONLY BEFORE A DECLARED UNIT, so `sq ft`-style phrases whose unit this file cannot read keep
    //     their `sq` rather than half the phrase being spoken. Emitted as unit-then-modifier, the position
    //     `exponentWords` already declares for this language.
    s = s.replace(
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
    s = s.replace(METRE, (_m, num: string) => `${num} ${METRE_WORD}`);
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
