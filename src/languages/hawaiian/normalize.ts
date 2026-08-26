/**
 * Hawaiian (haw) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/haw.jsonc` — haw.wikipedia dump, 7,735 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 3,111 · `year` 3,105 · `abbrev` 1,796 ·
 * `initialism` 979 · `ordinal-latin` 521 · `decimals` 452 · `ranges` 343 · `signs` 260 · `roman` 179 ·
 * `percent` 149 · `clock` 78 · `currency` 71 · `dotted` 66 · `units` 61 · `degrees` 17 · `fractions` 12 ·
 * `rate` 8 · `era-marker` 5.
 *
 * ⚠ THE COORDINATE IS GLOSSED AGAINST ITS OWN NOTATION, IN EVERY INSTANCE, and it is the richest degree
 * attestation this sweep has found. The Northwestern-Hawaiian-Islands articles write the symbolic form and
 * then spell it out in the same parenthesis:
 *
 *     Aia ʻo ia ma 28°25′ʻĀ, 178°20′K
 *       (ʻiwakāluakūmāwalu KĒKELĒ ʻiwakāluakūmālima MINUKE … ʻākau lakikū … komohana lonikū)
 *
 * That one sentence sources `kēkelē` (×37), `minuke` (×32) AND the compass words — ⚠ and it is where the
 * COMPASS LETTERS come from: `ʻĀ` is *ʻākau* (north) and `K` is *komohana* (west), not N and W. A layer
 * ported from any Latin-script neighbour would have looked for the wrong letters entirely.
 *
 * ⚠ AND THE DEGREE SIGN HAS A CONFUSABLE HERE TOO. `°` U+00B0 in `25°`, `9–13 °C`, `28°25′` — but
 * `˚` U+02DA RING ABOVE in `-19.7˚C i -19.9˚C ai ʻole 38.4˚F`. Third round running with a confusable in
 * this slot (Karakalpak and Crimean Tatar both wrote the scale letter in Cyrillic); this one moves the
 * SIGN rather than the letter.
 *
 * ⚠ THE SEPARATORS ARE AMERICAN, WITH ONE GERMAN EXCEPTION. The comma groups (`435,036 km`, `371,657`,
 * `3,849,674`, `9,970,610`, `$100,000`, `3,200 klm`) and the dot decimates (`8.6/10`, `71.6`, `19.95`,
 * `552.3 kapuaʻi kuea`, `-19.7˚C`, `56.4 mika`). ⚠ The exception is inside a quoted German figure —
 * "138,070 mau mile kuea (Kelemānia: **357.600** km/h)", Germany's 357,600 km² with a European grouping dot
 * and a mislabelled unit — so the three-digit test is needed on the dot as well. ⚠ And the guard also has
 * to decline an IP ADDRESS: `18.55.6.215` is four dot-joined groups, so a decimal is a run with exactly ONE
 * dot.
 *
 * ⚠ THE SQUARE MEASURE WORD FOLLOWS ITS UNIT — `mile kuea`, `kilomika kuea`, `kapuaʻi kuea` — which is the
 * opposite of the two Turkic rounds either side of this one. ⚠ AND THE CORPUS GETS ITS OWN UNIT WRONG:
 * `kapuaʻi` is *foot* (`13,796 kp`, `4,784 kapuaʻi ke kiʻekiʻe`, `5,243 kapuaʻi ka luna`), yet the island
 * articles write "596.7 **kapuaʻi kuea** (1,545.4 klm²)" for Oʻahu, which is 596.7 square MILES. Recorded,
 * not fixed: this layer reads the words the writer chose.
 *
 * ⚠ THE UNIT ABBREVIATIONS ARE HAWAIIANISED AND UNGUESSABLE. `klm` is *kilomika* (`3,200 klm (1,988 mil)`,
 * `10,432 klm²`) and `kp` is *kapuaʻi* (`13,796 kp (4,205 m)`); `mil` is the mile. None of the three is the
 * SI abbreviation a fleet-standard table would carry, and `klm` in particular is a letter-order a
 * ported rule cannot produce.
 *
 * ⚠ THE RATE CONNECTIVE IS `o ka`, and the corpus supplies it: "he 118 **kilomika o ka hola** a ʻoi" —
 * *118 kilometres per hour*.
 *
 * ⚠ THE MINUS IS REFUSED AND THIS ONE COSTS, which is the opposite of the Crimean Tatar round one step
 * earlier. `maina` and `mīnuke` are ABSENT from haw.wikipedia, `koena` ×18 is "the remainder/the rest of"
 * and `emi` is the verb "to decrease"; the integers article names the class rather than the sign ("nā helu
 * piha **ʻiʻo ʻole**", non-positive integers), which is an adjectival phrase the tier cannot place. A minus
 * INVERTS its operand, so unlike crh's plus the silence is a real loss — `-19.7˚C` reads as positive.
 * Registered with that price stated rather than papered over.
 *
 * ⚠ AND THE SCRIPTURE COLON IS A DIFFERENT CODEPOINT FROM THE CLOCK. The artifact's only colon between
 * digits is `ʻOihana Kahuna 8ː10-12` and `Pukaʻana 30ː29` — U+02D0 MODIFIER LETTER TRIANGULAR COLON, not
 * `:`. The clocks on the wiki are ASCII (`ka hola 12:18`, `mai ka hola 12:00 awakea a ka hola 5:00
 * ahiahi`), so a rule keyed on `:` reads every clock and never touches a Bible verse.
 *
 * SOURCING — every word emitted is a haw.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/haw.jsonc`.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/** ⚠ NEVER `\b` — Hawaiian carries the ʻokina and the macrons `ā ē ī ō ū`, which `\b` treats as
 *  boundaries (trap 1/23). The ʻokina is U+02BB, a LETTER, and must stay inside a word. */
const NOT_BEFORE = "(?<![\\p{L}\\p{M}\\u02bb])";
const NOT_AFTER = "(?![\\p{L}\\p{M}\\u02bb])";

/**
 * The shared SYMBOL tier. ⚠ THE UNIT TABLE IS THE CORPUS'S OWN ABBREVIATIONS, NOT THE SI ONES — see the
 * header: `klm` for kilometre and `kp` for foot are what this wiki writes, and neither is guessable.
 *
 * `kilomika` ×13 · `mika` ×15 · `kapuaʻi` ×25 · `mile` ×32 · `kuea` ×20 · `pākēneka` ×7 · `kālā` ×35 ·
 * `miliona` ×31 · `biliona` ×31 · `hola` ×6 · `kēkelē` ×37 · `minuke` ×32.
 *
 * ⚠ `kuea` FOLLOWS the unit (`mile kuea`, `kilomika kuea`), which is `position: "after"` and the opposite
 * of the Karakalpak and Crimean Tatar rounds either side of this one.
 *
 * ⚠ AND THE RATE CONNECTIVE IS A TWO-WORD PHRASE, `o ka`, taken from the corpus's own "118 kilomika o ka
 * hola". That is what makes `mph` and `km/h` readable at all.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["pākēneka"],
    currency: { "US$": ["kālā"], "$": ["kālā"] },
    units: {
        "km": ["kilomika"], "klm": ["kilomika"], "m": ["mika"],
        "kp": ["kapuaʻi"], "mil": ["mile"], "mph": ["mile o ka hola"],
    },
    unitPer: "o ka",
    rateDenominators: { "h": "hola" },
    exponentWords: { squared: ["kuea"], cubed: ["kupika"], position: "after" },
    ampersand: "a me",
    magnitudes: ["miliona", "biliona"],
});

/** Normalize one Hawaiian input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeHawaiian(input: string): string {
    let s = input;

    // 1) THE SHARED SYMBOL TIER FIRST — its own numeral pattern reads `435,036` and `19.95` as ONE token,
    //    and steps 2 and 3 split precisely those.
    s = SYMBOLS(s);

    // 2) DE-GROUPING, BY THE THREE-DIGIT TEST ON BOTH MARKS. The comma is the grouping mark throughout;
    //    the dot groups exactly once, inside a quoted German figure (see the header).
    //    ⚠ THE WHOLE NUMBER AT ONCE (trap 63), and the trailing guard rejects a DIGIT and nothing else
    //    (trap 58).
    s = s.replace(/(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));
    s = s.replace(/(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));

    // 3) THE DECIMAL DOT, NEUTRALISED. ⚠ NO DECIMAL WORD IS SOURCEABLE — `koena` ×18 is "the remainder of"
    //    in every example — so the mark is spent rather than spoken; the defect being fixed is the false
    //    sentence break it produces mid-quantity. ⚠ THE `(?<![\d.])…(?![\d.])` GUARD IS WHAT DECLINES AN
    //    IP ADDRESS: `18.55.6.215` is four dot-joined groups and a decimal has exactly one dot.
    s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu, "$1 $2");

    // 4) THE COORDINATE, which this corpus glosses for itself — "28°25′ʻĀ, 178°20′K (ʻiwakāluakūmāwalu
    //    kēkelē ʻiwakāluakūmālima minuke … ʻākau … komohana …)". ⚠ ONLY THE TWO COMPASS LETTERS THE
    //    ARTIFACT ACTUALLY SHOWS ARE CLAIMED: `ʻĀ` = ʻākau (north) and `K` = komohana (west). `H` would be
    //    ambiguous between *hema* (south) and *hikina* (east), and guessing it is exactly the kind of
    //    fourth arm this corpus gives no evidence for.
    s = s.replace(/(\d)\s?[°˚]\s?(\d+)\s?[′']\s?ʻĀ(?![\p{L}\p{M}ʻ])/gu, "$1 kēkelē $2 minuke ʻākau");
    s = s.replace(/(\d)\s?[°˚]\s?(\d+)\s?[′']\s?K(?![\p{L}\p{M}ʻ])/gu, "$1 kēkelē $2 minuke komohana");
    s = s.replace(/(\d)\s?[°˚]\s?(\d+)\s?[′']/gu, "$1 kēkelē $2 minuke ");

    // 5) DEGREES. ⚠ BOTH SIGNS — `°` U+00B0 and `˚` U+02DA (see the header) — and the scale letter is left
    //    to the shared cardinal path, because no Hawaiian Celsius/Fahrenheit name is attested on this wiki.
    //    `kēkelē` ×37 is the word, sourced from the coordinate gloss above.
    s = s.replace(/(\d)\s?[°˚]/gu, "$1 kēkelē ");

    // 6) THE CLOCK. ⚠ THE CODEPOINT IS THE WHOLE GUARD: the artifact's only colon between digits is a
    //    SCRIPTURE REFERENCE written with U+02D0 (`ʻOihana Kahuna 8ː10-12`, `Pukaʻana 30ː29`), while the
    //    clocks are ASCII (`ka hola 12:18`, `mai ka hola 12:00 awakea a ka hola 5:00 ahiahi`). A rule keyed
    //    on `:` reads every clock and never touches a verse. The writer supplies `hola`, so the figures are
    //    left as figures and only the colon is spent.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])/gu, "$1 $2");

    // 7) RANGES. The dash was dropped and the endpoints fused — `9–13 °C`, `22–25 °C`, `48–55 °F`,
    //    `70–75 pākēneka`, `15–20 °C`. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: Hawaiian
    //    writes `mai X a i Y` and the corpus does so in full where it means it ("loli aʻe mai 9–13 °C ma ka
    //    wā hoʻoilo"), so imposing the connective on a bare dash would double a word the writer already
    //    chose or not.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), and an adjacent slash means a rating
    //    (`8.6/10`) rather than a span.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
