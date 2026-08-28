/**
 * Sesotho / Southern Sotho (st) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which
 * is not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS FILE OWNS THE SHARED-TIER CALL (step 9), because st needs rules on BOTH sides of it and no fixed
 * order works: RANGES and the currency-glued magnitude letter must run BEFORE (the tier's `unitPrefix`
 * moves the noun in front of its number), the decimal spell-out AFTER.
 *
 * Ported from src/languages/sesotho/normalize.ts, whose header carries the whole evidential record: the
 * South-African-orthography decision and why a Lesotho form cannot be transposed into it, the before/after
 * readings that motivate each step (including the three trap-56 defects — ⟨kg⟩ as one Sesotho affricate,
 * ⟨ha⟩ as a Sesotho word, an ASCII exponent as a quantity), and the priced refusals (the clock, `=`, the
 * degree and scale words, the hectare, cm/mm/l, `€`, a decimal-separator word, letter names, fractions, the
 * bare exponent). Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Sesotho;

public static class Normalize
{
    /** The manifest's own conjunction — the number joiner, reused for `&`, read from the manifest so the
     *  two can never drift apart. */
    private static string AND => Manifest.MANIFEST.Numbers.And;

    /** MAGNITUDE WORDS as they appear in RUNNING TEXT — a MATCHER, not an author, so the Lesotho spellings
     *  belong here beside the SA ones. A magnitude the tier cannot see breaks the number↔sign adjacency and
     *  drops the sign outright. */
    private static readonly string[] MAGNITUDES =
    [
        "dimilione", "dimiliyone", "limilione", "milione", "miliyone",
        "dibilione", "dibiliyone", "libilione", "bilione", "biliyone",
    ];
    /** …and the same list as an alternation, for step 10's concord repair. */
    private static readonly string MAG_ALT =
        string.Join("|", MAGNITUDES.OrderByDescending(m => m.Length));

    /** THE SPAN JOINER — *ho isa ho*, "up to". ⚠ The second operand's concord is deliberately NOT emitted:
     *  which concord depends on the head noun's class, which this layer does not know. */
    private const string SPAN = "ho isa ho";

    /** The digits of a fractional part, spaced so the number path speaks them one at a time. ⚠ Reading `25`
     *  in `1.25` as a NUMBER would say a different quantity. */
    private static string Spell(string integer, string frac) =>
        $"{integer} {string.Join(" ", Js.CodePoints(frac))}";

    /**
     * THE SHARED SYMBOL TIER. ⚠ EVERY FORM IS DECLARED TWICE AND THE SECOND ENTRY CARRIES THE CONCORD:
     * index 0 is the citation form (a bare symbol standing alone, or a literal count of one), index 1 is the
     * noun plus the class 8/10 relative concord `tse`, which is what 100% of the digit-bearing attestations
     * write. The concord is NOT agreement with the numeral — it agrees with the NOUN, which this file
     * chooses, so it is carried as data instead of computed. See the TS for every field's attestation.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "diperesente", "diperesente tse" },
        PercentPrefix = true, // the measure noun heads its phrase in Bantu
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            // ⚠ the compound key must exist or `US$100` matches the bare `$` and the code is stranded.
            ["US$"] = new[] { "didolara tsa Amerika", "didolara tsa Amerika tse" },
            ["$"] = new[] { "didolara", "didolara tse" },
            // A bare capital `R` key is MEASURED safe: all 12 `R`+digit instances in the artifact are money.
            ["R"] = new[] { "diranta", "diranta tse" },
            ["£"] = new[] { "diponto", "diponto tse" },
        },
        CurrencyPrefix = true,
        Magnitudes = MAGNITUDES,
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "dikhilomithara", "dikhilomithara tse" },
            // ⚠ A ONE-LETTER KEY, DECLARED ON A MEASUREMENT. Step 5 spends the three currency-glued
            // millions before the tier ever sees them, which is what makes it safe.
            ["m"] = new[] { "dimithara", "dimithara tse" },
            // ⚠ ONE TOKEN IN ONE ARTICLE, AND DECLARED ANYWAY — what the silence costs is not a visible
            // leak: ⟨kg⟩ is a declared Sesotho GRAPHEME, so `50 kg` was reading as one velar affricate.
            ["kg"] = new[] { "dikhilograma", "dikhilograma tse" },
        },
        UnitPrefix = true,
        /** THE RATE, composed from `ka` — the obvious candidate `ka hora` is a CLOCK time in every
         *  attestation, so it is not declared. `h` is a DENOMINATOR ONLY. */
        UnitPer = "ka",
        RateDenominators = new Dictionary<string, string> { ["h"] = "hora" },
        /** ⚠ NO `cubed`: nothing attests one, so the tier's missing-word branch re-emits the exponent
         *  where the leak gate can see it rather than inventing a reading. */
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "disekwere" }, Position = ExponentPosition.Before,
        },
        // ⚠ `Ampersand` IS DELIBERATELY NOT DECLARED — see step 2.
    });

    // ── the patterns, in step order ─────────────────────────────────────────
    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;", "giu");
    private static readonly JsRe APOS_ENTITY = JsRegex.Compile("&#0*39;|&#x0*27;|&apos;", "giu");
    private static readonly JsRe LB_ENTITY = JsRegex.Compile("&#x0*5B;", "giu");
    private static readonly JsRe RB_ENTITY = JsRegex.Compile("&#x0*5D;", "giu");
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe BARE_AMP = JsRegex.Compile("[ \\t]*&[ \\t]*", "gu");

    private static readonly JsRe DOTTED_CAPS =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:\\p{Lu}\\.[ \\u00a0]?){2,}(?:\\p{Lu}(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe DOT_OR_SPACE = JsRegex.Compile("[. \\u00a0]", "gu");  // NBSP
    private static readonly JsRe LEADING_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe SPACE_THEN_CAP = JsRegex.Compile("^[ \\u00a0]+\\p{Lu}", "u");  // space, NBSP

    private static readonly JsRe DOTTED_DATE =
        JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})(?![\\d.,])", "gu");

    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:,\\d{3})+(?![\\d]|[.,]\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:\\.\\d{3})+(?![\\d]|[.,]\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:[ \\u00a0\\u202f\\u2009]\\d{3})+(?![\\d])", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    private static readonly JsRe CURRENCY_SCALE = JsRegex.Compile(
        "((?:US[ \\u00a0]?)?[$£€R])([ \\u00a0]?\\d[\\d.,]*)(m|bn)(?![\\p{L}\\p{M}\\d])", "gu");  // space, NBSP

    private static readonly JsRe SAID_PERCENT = JsRegex.Compile(
        "((?<![\\p{L}\\p{M}])[dl]i(?:peresente|poresente|phesente)[ \\u00a0]+(?:tse[ \\u00a0]+)?)(\\d[\\d.,]*)[ \\u00a0]?%",  // space, NBSP
        "giu");
    private static readonly JsRe GLUED_PERCENT =
        JsRegex.Compile("(?<=[\\p{L}\\p{M}])(?=\\d[\\d.,]*[ \\u00a0]?%)", "gu");  // space, NBSP

    private static readonly JsRe DASH_RANGE = JsRegex.Compile(
        "(?<![-\\d.,\\p{L}\\p{M}])(\\d+)[ \\u00a0]?[-–—][ \\u00a0]?(\\d+)(?![-\\d\\p{L}\\p{M}]|[.,]\\d)", "gu");  // space, NBSP

    private static readonly JsRe ENGLISH_ORDINAL =
        JsRegex.Compile("(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");

    private static readonly JsRe MAG_CONCORD =
        JsRegex.Compile($"(tse[  ]+(?:{MAG_ALT}))[  ]+(?=\\d)", "gu");  // space, NBSP

    private static readonly JsRe DECIMAL_DOT =
        JsRegex.Compile("(?<![\\d.,:])(\\d+)\\.(\\d{1,2})(?![\\d]|\\.\\d)", "gu");
    private static readonly JsRe DECIMAL_COMMA =
        JsRegex.Compile("(?<![\\d.,:])(\\d+),(\\d{1,2})(?![\\d,])", "gu");

    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACE = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** Normalize one Sesotho input string. Steps are ORDER-DEPENDENT; each coupling is stated in the TS. */
    public static string NormalizeSesotho(string input)
    {
        var s = input;

        // 1) HTML ENTITIES, before anything reads a `&` or a `#`. ⚠ `&#39;` IS AN ORTHOGRAPHIC CHARACTER in
        //    Sesotho — the apostrophe writes the syllabic nasal — so it is restored rather than dropped.
        s = Rewrite(Rewrite(Rewrite(Rewrite(
            Rewrite(s, NBSP_ENTITY, " "), APOS_ENTITY, "’"), LB_ENTITY, "["), RB_ENTITY, "]"), AMP_ENTITY, "&");

        // 2) THE BARE AMPERSAND → `le`. ⚠ This is why `Ampersand` is not declared on the shared tier: 8 of
        //    the corpus's 19 ampersands are `&nbsp;`, and the tier would emit "le nbsp" for every one.
        s = Rewrite(s, BARE_AMP, $" {AND} ");

        // 3) DOTTED CAPITAL RUNS → the bare letters. ⚠ THE FINAL DOT IS KEPT ONLY AT END OF INPUT, and the
        //    trade was measured: 1 lost sentence end against 2 spurious pauses avoided.
        var frozen = s;
        s = Rewrite(s, DOTTED_CAPS, m =>
        {
            var letters = DOT_OR_SPACE.Replace(m.Value, "");
            var rest = frozen[(m.Index + m.Value.Length)..];
            if (LEADING_LETTER.IsMatch(rest)) return $"{letters} ";
            return rest == "" || SPACE_THEN_CAP.IsMatch(rest) ? $"{letters}." : letters;
        });

        // 3b) THE DOTTED DATE — spend the dots, and nothing else. ⚠ BEFORE step 4 and step 11.
        s = Rewrite(s, DOTTED_DATE, "$1 $2 $3");

        // 4) THOUSANDS DE-GROUPING, before every remaining numeric rule. ⚠ EXACTLY THREE DIGITS PER BLOCK,
        //    and the head must start 1–9.
        s = Rewrite(s, GROUP_COMMA, m => COMMAS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_DOT, m => DOTS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_SPACE, m => SPACE_SEPS.Replace(m.Value, ""));

        // 5) A MAGNITUDE LETTER GLUED TO A CURRENCY AMOUNT → the magnitude WORD. ⚠ This step is what makes
        //    the one-letter metre key safe, and it must run after step 4 and before the tier.
        s = Rewrite(s, CURRENCY_SCALE, m =>
            $"{m.Groups[1].Value}{m.Groups[2].Value} {(m.Groups[3].Value == "m" ? "dimilione" : "dibilione")}");

        // 6) A PERCENT SIGN WHOSE WORD IS ALREADY WRITTEN → drop the sign. This covers the three spellings
        //    the tier cannot know about (the Lesotho forms and the SA variant `diphesente`).
        s = Rewrite(s, SAID_PERCENT, "$1$2");

        // 6b) A DIGIT RUN GLUED TO THE END OF A WORD, immediately before a `%` → set it off with a space.
        //     ⚠ THIS EXISTS BECAUSE THE FIX CREATED IT, and it is narrowed to the `%` case on purpose.
        s = Rewrite(s, GLUED_PERCENT, " ");

        // 7) RANGES → `ho isa ho`, BEFORE the shared tier, and that ordering is load-bearing.
        //    ⚠ ASCENDING ONLY: the modal `N-N` shape in the artifact is a SEASON, which declines itself.
        s = Rewrite(s, DASH_RANGE, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[2].Value)
                ? $"{m.Groups[1].Value} {SPAN} {m.Groups[2].Value}"
                : m.Value);

        // 8) THE ENGLISH ORDINAL SUFFIX — always foreign orthography here; stripping it is the whole fix.
        s = Rewrite(s, ENGLISH_ORDINAL, "$1");

        // 9) THE SHARED SYMBOL TIER.
        s = SYMBOLS(s);

        // 10) THE CONCORD BETWEEN A MAGNITUDE AND ITS FIGURE, which the tier cannot emit. ⚠ ONLY AFTER A
        //     CONCORD THIS FILE JUST EMITTED, so a magnitude in ordinary prose is untouched.
        s = Rewrite(s, MAG_CONCORD, "$1 tse ");

        // 11) DECIMALS, LAST of the numeric rules. NO separator word is emitted; see the TS header.
        //     ⚠ THE DOT ARM REJECTS A FOLLOWING `.digit` (the D.M.Y date) and BOTH ARMS REJECT A LEADING
        //     COLON, which is what keeps this rule out of the sports times the header declines.
        s = Rewrite(s, DECIMAL_DOT, m => Spell(m.Groups[1].Value, m.Groups[2].Value));
        s = Rewrite(s, DECIMAL_COMMA, m => Spell(m.Groups[1].Value, m.Groups[2].Value));

        // A padded replacement doubles a space that was already there and can leave one at an edge.
        return Rewrite(Rewrite(s, MULTI_SPACE, " "), EDGE_SPACE, "");
    }
}
