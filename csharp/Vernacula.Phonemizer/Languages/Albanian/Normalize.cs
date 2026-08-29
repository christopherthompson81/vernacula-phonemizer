/**
 * Albanian (sq) TEXT NORMALIZATION — the pre-pass that turns written figures, signs and abbreviations
 * into Albanian words before the g2p sees them. Pure text→text, wired into Albanian.cs's `Text()`.
 *
 * ⚠ THE ORDER BELOW IS LOAD-BEARING and the steps are numbered for it. De-grouping must run FIRST,
 * because every later rule needs the figure to be one digit run — and in this language de-grouping is
 * also what makes the decimal separator unambiguous, which is the whole problem (step 1).
 *
 * WHAT WAS ACTUALLY WRONG, measured on the mined artifact (458 segments) before any of this existed:
 *
 *   `-38,3 °C`      → *tridhjetë e tetë , tre t͡s*
 *        FOUR defects in one figure: the minus dropped so a record LOW reads as a high, the comma taken
 *        for a clause pause, the degree sign dropped, and ⟨C⟩ read as Albanian /t͡s/ — a legal syllable,
 *        which is playbook trap 56 and is why no leak class, DROP or referee can see it.
 *   `110,994 kilometra` → *njëqind e dhjetë , nëntëqind e nëntëdhjetë e katër kilometra*
 *        the VALUE destroyed — one number read as two, with a sentence pause between them.
 *   `300.000 vjet`  → *treqind . zero vjet*
 *        the same again through the other separator, and `000` read as a single *zero*.
 *   `25 cm`         → *njëzet e pesë t͡sm*
 *        the unit as a fake word.
 *   `75 %`, `€2`, `$ 138 miliardë` — every sign silently dropped.
 *
 * SOURCING. espeak-ng's `sq_list` declares the sign readings (`+` → pllus, `-` → minus, `=` → barabart,
 * `&` → dhe, `€` → euro, `/` → pjestim, `<` → më e vogël, `>` → më e madhe) and — critically — `_dpt`,
 * the DECIMAL-POINT slot itself, as `presja`. Every noun is attested on sq.wikipedia via `attest.ts`,
 * and the two that carry the most weight are attested IN THE SLOT rather than merely as tokens:
 * `24 për qind`, `15.4 për qind` (postposed, ×22 / 6 arts) and `-20 gradë Celsius`, `10 gradë Celsius`
 * (×17 / 6 arts).
 * Ported from src/languages/albanian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Albanian;

public static class Normalize
{
    /**
     * ⚠ ALBANIAN AGREEMENT IS THE PLAIN ONE: singular after exactly 1, plural otherwise. Stated rather
     * than assumed, because the fleet has three different conventions and the tier's default happens to
     * be this one.
     */
    private static int CountForm(double n) => n == 1 ? 0 : 1;
    private static IReadOnlyList<string> Pair(string one, string many) => new[] { one, many };

    /**
     * THE UNIT NOUNS, every form attested on sq.wikipedia as a whole token (`attest.ts`, tok/arts):
     * kilometër 6/5 · kilometra 31/6 · metër 11/6 · metra 26/5 · centimetër 8/6 · centimetra 13/6 ·
     * milimetër 8/6 · milimetra 18/6 · kilogram 16/6 · kilogramë 11/5 · gram 21/6 · litër 17/6 ·
     * litra 16/6 · ton 32/6 · hektarë 28/5.
     *
     * ⚠ `l`, `g`, `t` AND `ha` WERE DECLARED AND HAVE BEEN REMOVED, which is worth recording because the
     * reason is not "unused". `sources.ts` reports `l×3` and `g×2` after a number, so the first cut took
     * them — and reading the instances shows what they actually are:
     *     `62 00 V, 10 00 L`, `29 00 V, 24 00 L`  — ⟨L⟩ is LINDJE, the longitude compass letter
     *     `4G / LTE`, `98% mbulim 4G`             — ⟨G⟩ is the mobile network generation
     * Every corpus "instance" of both keys is a COLLISION, not a use, and `t`/`ha` are ×0 outright. A
     * unit whose only evidence is a token in the wrong sense is trap 37 arriving through a counting tool;
     * the tier's boundary guards happen to refuse these particular spellings (`L` and `4G` are not
     * lowercase-and-spaced), but that is luck, and a lowercase `10 00 l` would have read as *litra*.
     *
     * ⚠ `m` STAYS, and it is the one one-letter key with real support: ×10 after a figure, all metres
     * (`2,962 m`, `3.54m nën nivelin e detit`). One-letter keys are trap 46's hazard and it is the tier's
     * own boundary guards that make this one safe — nothing in this table.
     */
    private static readonly Dictionary<string, IReadOnlyList<string>> UNITS = new(StringComparer.Ordinal)
    {
        ["km"] = Pair("kilometër", "kilometra"),
        ["m"] = Pair("metër", "metra"),
        ["cm"] = Pair("centimetër", "centimetra"),
        ["mm"] = Pair("milimetër", "milimetra"),
        ["kg"] = Pair("kilogram", "kilogramë"),
        /**
         * ⚠ `mb` and `mhz` are the two the leak gate found reaching the IPA raw — `3,5MB`, `32MB`,
         * `294,912 Mhz`, `714 MHz`, ×3 each. `megabajt` 12 tok / 6 arts; `megaherc` is 2/2, the thinner
         * of the two and taken because the alternative is bare Latin letters.
         *
         * ⚠ BOTH COUNT FORMS ARE THE SINGULAR, AND THAT IS THE ATTESTED FORM RATHER THAN A SHORTCUT. The
         * first cut declared `megabajtë`/`megahercë` as plurals and both are INVENTIONS: `attest.ts`
         * returns `megabajtë` **absent** (0 tok / 0 arts) and the corpus writes the singular after every
         * count — *deri në 50 megabajt*, *1024 megabajt*, *1 megabajt ka 1024 kilobajt*. Since `countForm`
         * returns the plural slot for every n ≠ 1, the invented word is what would have shipped for
         * essentially all input. This is the "no form to take, only one to invent" case this file refuses
         * for `±`, and it has to be refused here too or the refusal there is not a principle.
         *
         * ⚠ THESE TWO ARE ALSO READ STANDALONE, which is wider than the evidence. The tier treats a
         * vowel-free multi-letter key as safe without a figure, so `diçka mb` becomes *diçka megabajt*.
         * Recorded rather than worked around: it is the tier's documented behaviour, and a bare `mb` in
         * Albanian prose is not a shape this corpus contains.
         */
        ["mb"] = Pair("megabajt", "megabajt"),
        ["mhz"] = Pair("megaherc", "megaherc"),
    };

    /**
     * `orë` 33 tok / 6 arts, `sekonda` 17/6 — denominators only, never standalone (the tier's `Il-76s`
     * case).
     *
     * ⚠ POPULATION DENSITY IS NOT REACHABLE FROM HERE and stays a leak, which is said rather than
     * implied. The corpus writes `22b/km²`, `48 banore/km²`, `81 banorë/km²`, `100 banorë/km2` — a rate
     * whose NUMERATOR is a noun (*banorë*, inhabitants) rather than a unit abbreviation, so the tier's
     * rate arm, which composes unit-over-unit, cannot match it and `km` reaches the IPA raw. ×6, and it
     * is the same class Basque records for `bizt./km²`. Reading it would mean composing a rate
     * construction (*banorë për kilometër katror*) out of a preposition this file has not sourced for
     * that slot; the RAW-LATIN gate can see the leak, which is the correct failure mode until it is.
     */
    private static readonly Dictionary<string, string> RATE_DENOMINATORS = new(StringComparer.Ordinal)
    {
        ["h"] = "orë",
        ["s"] = "sekonda",
    };

    /**
     * The SIGN words. espeak `sq_list` for all of them; `minus` is also 23 tok / 6 arts on the wiki and
     * `plus` 50/6, so the two that actually occur here carry two tiers.
     *
     * ⚠ THE DIVISION WORD IS THE WIKI'S SPELLING, NOT espeak's. `sq_list` maps `/` to `pjestim`, which
     * the wiki has at 2 tok / 2 arts against `pjesëtim` at 8/6 — the same word with the schwa written.
     * Where two tiers disagree on ORTHOGRAPHY rather than on the word, running text wins: that is the
     * spelling the g2p was built against.
     *
     * ⚠ `±` HAS NO ENTRY AND IS DELIBERATELY LEFT SILENT. It is ×0 in this corpus, espeak declares
     * nothing for it, and `plus minus` is 0 tok / 0 arts on the wiki — so there is no form to take, only
     * one to invent. `review.ts --lang sq` stays RED on that class until a source turns up.
     */
    private const string SIGN_PLUS = "plus";
    private const string SIGN_MINUS = "minus";
    private const string SIGN_EQUALS = "barabart";
    private const string SIGN_LESS_THAN = "më e vogël";
    private const string SIGN_GREATER_THAN = "më e madhe";
    private const string SIGN_DIVIDED_BY = "pjesëtim";
    private const string SIGN_AMPERSAND = "dhe";

    /**
     * THE DECIMAL SEPARATOR'S WORD. espeak declares `_dpt` — which IS this slot, not the mark's name —
     * as `presja`, the definite form, and that is what is emitted.
     *
     * ⚠ `presje` (indefinite) is the form `attest.ts` finds on the wiki (6 tok / 5 arts), and every one
     * of those hits is the mark being NAMED (*ndahen me presje*, "separated by commas") rather than a
     * figure being read. A token in the wrong sense is trap 37, so the wiki is evidence that the WORD
     * exists and espeak is the evidence for which form goes in this slot. Where the two tiers speak to
     * different questions, both are cited.
     */
    private const string DECIMAL_WORD = "presja";

    /**
     * THE SCALE NAMES, and the phrase is attested whole and postposed: `-20 gradë Celsius`, `10 gradë
     * Celsius`, `1-2 gradë Celsius` (17 tok / 6 arts). `gradë` alone is 24/6, `Celsius` 24/6,
     * `Fahrenheit` 7/6.
     */
    private const string DEGREE = "gradë";
    private static readonly Dictionary<string, string> SCALE = new(StringComparer.Ordinal)
    {
        ["C"] = "Celsius",
        ["F"] = "Fahrenheit",
    };

    /** The SHARED symbol tier — percent, currency (with the magnitude hop), units, rates, exponents. */
    private static readonly Func<string, string> SYMBOLS = MakeSymbols();

    private static Func<string, string> MakeSymbols()
    {
        return NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
        {
            /**
             * ⚠ POSTPOSED, AND THAT IS A MEASURED FACT ABOUT THIS LANGUAGE rather than the tier's default
             * showing through. The wiki writes `24 për qind`, `15.4 për qind`, `12.4 për qind`,
             * `80 për qind` — figure first, ×22 across 6 articles — and `%\s*\d` (the prefix shape) is ×0
             * in the corpus.
             *
             * ⚠ TWO WORDS, NOT espeak's ONE. `sq_list` maps `%` to `përqindja`, which is the DEFINITE
             * NOUN "the percentage" — the mark's name, the thing you say when reading the symbol aloud in
             * isolation. After a figure Albanian says `për qind` ("per hundred"), which is what every
             * attested collocation shows. Taking espeak's form here would read `75 %` as *seventy-five
             * the-percentage*.
             */
            Percent = new[] { "për qind", "për qind" },
            /**
             * espeak `€ euro`; `dollarë` 34 tok / 6 arts, `dollar` 19/6, `lekë` 13/6, `euro` 60/6.
             * ⚠ `US$` IS DECLARED SEPARATELY because the corpus writes it (×2, `US$ 104`, `US$ 800
             * milion`) and the tier is letter-bounded on the left, so a bare `$` key cannot match inside
             * it — the compound key is the documented way to claim it, and without one the sign is dropped
             * and `US` read as a word.
             */
            Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
            {
                ["US$"] = new[] { "dollar amerikan", "dollarë amerikanë" },
                ["$"] = new[] { "dollar", "dollarë" },
                ["€"] = new[] { "euro", "euro" },
                ["£"] = new[] { "paund", "paundë" },
            },
            Units = UNITS,
            // The compositor's own magnitude words (albanian.jsonc `numbers`), so a figure separated from
            // its unit or sign by one of them stays adjacent to it: the corpus writes `$ 138 miliardë`,
            // `US$ 800 milion`.
            Magnitudes = new[] { "miliardë", "miliard", "milionë", "milion", "mijë" },
            RateDenominators = RATE_DENOMINATORS,
            UnitPer = "në",
            /**
             * ⚠ `after`, AND IT IS ATTESTED IN RUNNING TEXT rather than inferred: the corpus's own area
             * figure is `110,994 kilometra katrorë` — the modifier follows the noun, as Albanian
             * adjectives do. `katrorë` is 24 tok / 6 arts, `kubikë` 10/6.
             */
            ExponentWords = new ExponentWordsDef
            {
                Squared = new[] { "katrorë" },
                Cubed = new[] { "kubikë" },
                Position = ExponentPosition.After,
            },
            Multiply = new MultiplyDef { Times = "herë" },
            Ampersand = SIGN_AMPERSAND,
            CountForm = CountForm,
        });
    }

    // ─── RULES ────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * 1. DE-GROUPING, AND IT IS THIS LANGUAGE'S CENTRAL PROBLEM.
     *
     * Albanian text mixes THREE grouping conventions and TWO decimal conventions, and the comma and the
     * period each serve both roles. Counted over the artifact:
     *
     *     comma grouping, multi-group (`6,677,563,921`)            8      unambiguous
     *     comma + exactly three digits (`110,994`, `4,167`)       51      AMBIGUOUS by shape
     *     comma + one or two digits (`38,3`, `36,9`)              11      unambiguous decimal
     *     period grouping, multi-group (`4.574.560`)               7      unambiguous
     *     period + exactly three digits (`300.000`)               26      AMBIGUOUS by shape
     *     period + one or two digits (`41.33`, `7.9`)             57      unambiguous decimal
     *     space + three digits (`20 000`, `1 189`)                 6      unambiguous grouping
     *
     * ⚠ THE DISCRIMINATOR IS THE DIGIT COUNT, AND IT WAS READ OFF THE CORPUS, NOT ASSUMED. All 51
     * ambiguous comma sites were read by hand: **50 are groupings** (`110,994 kilometra katrorë`,
     * `324,220 km²`, `2,731 orë`, `346,893` populations, census counts) and exactly ONE is a decimal.
     * The period side is the same shape. So three digits after the separator means grouping; one or two
     * means decimal — uniformly, for both marks.
     *
     * ⚠ THE WIKI STATES IT DEFINITIONALLY, which is why this is a finding rather than a heuristic:
     *   *"ai mund të shkruhet me ose pa presje ose ndonjëherë një pikë që ndan shifrat e mijërave: 1.000"*
     *   — "it may be written with or without a COMMA, or sometimes a PERIOD, separating the thousands
     *   digits." Both marks, named as thousands separators, in one sentence.
     *
     * ⚠ THE ONE INSTANCE THIS GETS WRONG IS NAMED RATHER THAN CARVED OUT: `4,167 %` (one carat = 4.167%
     * gold) is a decimal and will be read as *4167*. A guard keyed on the following `%` would fix this
     * corpus and break the ordinary case — `an increase of 4,167%` is a grouping — so it would be fitting
     * a rule to one instance, which is exactly what trap 37 warns against. 50/51 is the measured trade,
     * and it is stated so it can be re-decided against a bigger sample.
     *
     * ⚠ THE TRAILING GUARD REJECTS A DIGIT, NOT A MARK — trap 58, and the first cut wrote `(?![\d.,])`
     * and broke THREE things at once. `50 000.` at a sentence end was refused (the trap in its usual
     * form); `300.000.` likewise; and `1,110.03 km²` — a real corpus line — was refused because its own
     * DECIMAL tail followed the group. A group is mis-segmented only if a further DIGIT follows it, so
     * that is the only thing worth rejecting; a clause mark and a decimal tail are both fine and both now
     * pass.
     *
     * ⚠ THE HEAD CANNOT BE `0`, and allowing it made this rule read a PRECISION FIGURE 1000× too large.
     * A thousands group never begins with a zero, so `0,375`, `0.500 g` and `p = 0,001` are decimals by
     * construction — but the head was `\d{1,3}`, so they de-grouped to `0375`, `0500` and `0001`, which
     * the number path then reads as 375, 500 and 1. A probability spoken as a thousand, with nothing
     * leaked and nothing dropped for a gate to see.
     */
    private static readonly JsRe GROUP_SEPARATED = JsRegex.Compile(
        "(?<![\\d.,])([1-9]\\d{0,2})((?:[.,\u00a0\u202f\u2009 ]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUP_SEPS = JsRegex.Compile("[.,\u00a0\u202f\u2009 ]", "gu");

    /**
     * 6. THE DECIMAL SEPARATOR. Runs LAST, after de-grouping has removed every three-digit group and after
     * the shared tier has matched `4,167 %`-shaped figures whole — converting the mark earlier breaks the
     * number-to-sign adjacency the tier depends on, which is the playbook's standing "units before
     * decimals".
     *
     * ⚠ THE FRACTION LENGTH IS NOT CHECKED HERE AT ALL, AND THAT IS THE POINT: step 1 has already
     * consumed every genuine thousands group, so whatever separator survives to this rule is a decimal by
     * elimination. Two narrower guards were tried and both leaked. `\d{1,2}` alone dropped `3.14159`,
     * which fell through with its separator intact and read as *tre . katërmbëdhjetë mijë …* — one number
     * as two with a sentence break, the exact class this layer exists to repair. Adding `|\d{4,}` then
     * still dropped `0,375` and `0.500`, because a zero-headed figure is refused by step 1 (a group never
     * starts with 0) and has a three-digit fraction. Letting step 1 do the discriminating and claiming the
     * remainder unconditionally is both simpler and right.
     *
     * ⚠ A LEADING ZERO IN THE FRACTION IS SPOKEN, the Basque defect: reading the fraction as a NUMBER
     * makes `5.09` and `5.9` identical, because `Number("09")` is 9 — the quantity wrong by a factor of
     * ten in well-formed text, and invisible to every gate.
     */
    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+)[.,](\\d+)(?![\\d.,])", "gu");

    /**
     * 3. RANGES. `deri` ("until") is the corpus's and the wiki's own word — 49 tok / 6 arts — and the
     * corpus writes the frame it stands in: `nga … deri …`. Both dash forms and the ASCII hyphen occur
     * (`55 – 79°`, `45-55°`, `5-6 %`, `1,151-1,152 vjet`).
     *
     * ⚠ TRAP 58: the trailing guard rejects a DIGIT, never a bare clause mark, so a range that ends a
     * sentence keeps its joiner. This is the defect that was live in 36 layers fleet-wide; the guard here
     * is written the way the repaired ones are, and `test/clause-final-range.test.ts` holds sq to it.
     */
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\d.,\\p{L}-])(\\d+(?:[.,]\\d+)?)\\s*[-\u2013\u2014]\\s*(\\d+(?:[.,]\\d+)?)(?!\\d|[.,]\\d|-)", "gu");

    /**
     * 4. DEGREES. `°C` and `°F` take the scale name; a bare `°` after a figure is `gradë`.
     *
     * ⚠ DO NOT SAY IT TWICE (trap 12). This corpus writes the scale name as a WORD beside the sign —
     * `+ 24° Celsius`, `+7° Celsius` — so an unconditional `° → gradë Celsius` would emit *gradë Celsius
     * Celsius*. The scale word is only added when the following text does not already carry it.
     *
     * ⚠ AND THE NOUN MUST NOT FUSE with what follows (the shared currency arm's lesson): `41.33°veri` has
     * no space to inherit, and without one the emitted word welds onto the next token.
     *
     * ⚠ THE SCALE LETTER NEEDS A LETTER BOUNDARY, and leaving it off reproduced the exact defect #819's
     * review caught in Latvian: `+7° Celsius` had its ⟨C⟩ eaten as the scale, the guard above then saw
     * only `elsius` and did not recognise the word as already said, so the output was *gradë Celsius
     * elsius* — the word added AND the original truncated. Two defects from one missing lookahead.
     */
    private static readonly JsRe DEGREE_SIGN = JsRegex.Compile(
        "(\\d+(?:[.,]\\d+)?)\\s*\u00b0(?:\\s*([CF])(?![\\p{L}\\p{M}]))?", "gui");

    /** The writer may have spelled the scale out already — `+7° Celsius`. */
    private static readonly JsRe ALREADY_SAID = JsRegex.Compile("^\\s*(?:Celsius|Fahrenheit)\\b", "iu");
    private static readonly JsRe FUSES = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");

    private static string Degrees(string text)
    {
        return Rewrite(text, DEGREE_SIGN, m =>
        {
            var fig = m.Groups[1].Value;
            var scale = m.Groups[2].Success ? m.Groups[2].Value.ToUpperInvariant() : null;
            var rest = text[(m.Index + m.Length)..];
            var named = scale is not null && SCALE.TryGetValue(scale, out var sc) ? sc : null;
            var alreadySaid = ALREADY_SAID.IsMatch(rest);
            var word = named is not null && !alreadySaid ? $"{DEGREE} {named}" : DEGREE;
            var fuses = FUSES.IsMatch(rest);
            return $"{fig} {word}{(fuses ? " " : "")}";
        });
    }

    /**
     * 5. THE SIGNS. `+ 24° Celsius`, `+7° Celsius` and `-38,3 °C` are the corpus's shape — a sign bound to
     * an amount rather than an operator between two — and Albanian uses the same word for both.
     *
     * ⚠ THE MINUS IS TIGHT AND THE PLUS IS NOT, which looks like an inconsistency and is a measurement.
     * The corpus writes `+ 24° Celsius` with a space, and it contains NO spaced minus before a figure at
     * all: every spaced dash in it is a RANGE (`55 – 79°`, `50 - 75 %`, `10 - 18 % argjend`), a date span
     * or an ISBN. So the spacing is the same discriminator Basque uses — tight is a sign, spaced is
     * punctuation — and widening the minus to match the plus would claim the ranges instead. The headline
     * defect this file repairs (`-38,3 °C`) is tight, as are all four of the corpus's negatives.
     *
     * ⚠ AND A SUBTRACTION BETWEEN TWO FIGURES IS NOT CLAIMED BY ANYTHING. `10 - 4 = 6` reads as *dhjetë
     * deri katër barabart gjashtë* — the range rule takes the dash before any sign rule sees it. An
     * ascending-only guard would separate them, and it is NOT taken: this corpus has no arithmetic
     * subtraction (its `=` sites are `Ari i bardhë = 50 - 75 % ar`, where the dash IS a range), while it
     * does have a descending range that such a guard would break — `624–546 p. e. s.`, a BC span, which
     * counts backwards by nature.
     *
     * ⚠ THE OPERAND-FLANKING AND CODE-OPERATOR GUARDS on `=`, `<` and `>` are the ones the Latvian layer's
     * self-review produced: unguarded, `a==b` says the word twice AND emits a double space, which is the
     * SLOT-GAP class the fleet audit exists to find.
     */
    private static readonly JsRe PLUS = JsRegex.Compile("(?<![\\d\\p{L}])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\d\\p{L}])[\u2212\u2013-](?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile(
        "(?<![=!<>])(?<=[\\d\\p{L}\\p{M})])\\s*=\\s*(?=[\\d\\p{L}(])(?![=<>])", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile(
        "(?<![=!<>])(?<=[\\d\\p{L}])\\s*<\\s*(?=[\\d\\p{L}])(?![=<>])", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile(
        "(?<![=!<>])(?<=[\\d\\p{L}])\\s*>\\s*(?=[\\d\\p{L}])(?![=<>])", "gu");
    private static readonly JsRe DIVIDED_BY = JsRegex.Compile("(?<=\\d)\\s*\u00f7\\s*(?=\\d)", "gu");

    private static string Signs(string text)
    {
        text = Rewrite(text, PLUS, SIGN_PLUS + " ");
        text = Rewrite(text, MINUS, SIGN_MINUS + " ");
        text = Rewrite(text, EQUALS, $" {SIGN_EQUALS} ");
        text = Rewrite(text, LESS_THAN, $" {SIGN_LESS_THAN} ");
        text = Rewrite(text, GREATER_THAN, $" {SIGN_GREATER_THAN} ");
        text = Rewrite(text, DIVIDED_BY, $" {SIGN_DIVIDED_BY} ");
        return text;
    }

    /**
     * 0. ⟨km2⟩ IS ⟨km²⟩ WITH THE SUPERSCRIPT LOST, and folding it is what lets step 2 read it at all.
     * This corpus writes the ASCII form ×5 against ×23 for the real superscripts, and every one of the
     * five is `km2` — never `m2` or `cm2` — so the fold is keyed on the one abbreviation that is measured
     * rather than on a shape. Unfolded, the tier's exponent arm does not match, the whole unit fails, and
     * `km` reaches the IPA raw; that is how these were found, as a RAW-LATIN leak rather than as a missing
     * reading.
     */
    private static readonly JsRe ASCII_EXPONENT = JsRegex.Compile(@"\bkm([23])(?![\p{L}\p{M}\d])", "gu");

    /**
     * 2b. PER MILLE. `999 ‰ ar` — ×5 in the corpus, and the sign was vanishing outright, which for a
     * purity figure is the whole quantity. `për mijë` is the transparent parallel of the percent reading
     * this file already ships (`për qind`, "per hundred" → "per thousand") and is attested 2 tok / 2
     * arts; `promil` is 1/1.
     * ⚠ THE THINNEST SOURCE IN THIS FILE, said rather than implied — two articles is a lead, not a
     * finding, and it is taken because the parallel with the percent construction is structural rather
     * than a guess.
     */
    private static readonly JsRe PER_MILLE = JsRegex.Compile("(\\d)\\s*\u2030", "gu");

    /** The Albanian normalization pre-pass. See the numbered steps above; the order is load-bearing. */
    public static string NormalizeAlbanian(string input)
    {
        /**
         * ⚠ A DOTTED DATE (`30.04.1993`) NEEDS NO SPECIAL CASE, and the first draft of this file wrongly
         * built one — holding the date out behind a NUMERIC placeholder and restoring every ` \d+ ` at the
         * end, which would have clobbered any ordinary bare figure the restore pattern happened to match.
         * It is safe by construction: de-grouping requires THREE-digit groups so `.04` cannot open one, and
         * the decimal rule's trailing `(?![\d.,])` refuses `30.04` because a period follows it. The shape
         * survives untouched, which is exactly what the discarded machinery was for. ×1 in the artifact;
         * pinned in test/albanian.test.ts.
         */
        var s = Rewrite(input, ASCII_EXPONENT, m => "km" + (m.Groups[1].Value == "2" ? "\u00b2" : "\u00b3")); // 0

        s = Rewrite(s, GROUP_SEPARATED, m => m.Groups[1].Value + GROUP_SEPS.Replace(m.Groups[2].Value, "")); // 1
        s = Rewrite(s, RANGE, "$1 deri $2"); // 3 — before a dash can be claimed as a minus
        s = Rewrite(s, PER_MILLE, "$1 për mijë"); // 2b — before the tier, which has no per-mille arm
        s = SYMBOLS(s); // 2 — percent, currency, units, rates, exponents; needs the figure intact
        s = Degrees(s); // 4
        s = Signs(s); // 5
        s = Rewrite(s, DECIMAL, m =>
        {
            var head = m.Groups[1].Value;
            var frac = m.Groups[2].Value;
            var zeros = 0;
            while (zeros < frac.Length && frac[zeros] == '0') zeros++;
            var rest = frac[zeros..];
            var parts = new List<string>(Enumerable.Repeat("zero", zeros));
            if (rest != "") parts.Add(rest);
            return $"{head} {DECIMAL_WORD} {string.Join(" ", parts)}";
        }); // 6

        return s;
    }
}
