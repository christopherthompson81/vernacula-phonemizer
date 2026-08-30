/**
 * Kamba / Kĩkamba (kam) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/kamba/normalize.ts — see that file for the corpus evidence behind every arm,
 * every word, and every rule deliberately not written.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Kamba;

public static class Normalize
{
    /** ⚠ NEVER `\b` — the apostrophe is a LETTER here and must stay inside a word. */
    private const string NOT_BEFORE = "(?<![\\p{L}\\p{M}'’ʼ])";
    private const string NOT_AFTER = "(?![\\p{L}\\p{M}'’ʼ])";

    private static readonly JsRe CONFUSABLE = JsRegex.Compile("[îíìûúùÎÍÌÛÚÙ]", "u");
    private static readonly JsRe KAMBA_WORD = JsRegex.Compile("^[abcdefghijklmnoprstuvwyzĩũ'’ʼ]+$", "iu");
    private static readonly JsRe WORD_RUN = JsRegex.Compile("[\\p{L}\\p{M}'’ʼ]+", "gu");
    private static readonly JsRe FOLD_I_LOWER = JsRegex.Compile("[îíì]", "gu");
    private static readonly JsRe FOLD_U_LOWER = JsRegex.Compile("[ûúù]", "gu");
    private static readonly JsRe FOLD_I_UPPER = JsRegex.Compile("[ÎÍÌ]", "gu");
    private static readonly JsRe FOLD_U_UPPER = JsRegex.Compile("[ÛÚÙ]", "gu");

    /**
     * ⟨ĩ⟩ is /e/ and ⟨ũ⟩ is /o/; the confusable ⟨î û í ú ì⟩ are in no grapheme rule, so `latinPhone`
     * hands back the plain vowel. ⚠ THE GUARD IS THE ALPHABET, NOT A FLAG: a word is folded only if,
     * AFTER folding, every letter in it is one Kamba writes.
     */
    private static string FoldTildeConfusables(string s)
    {
        if (!CONFUSABLE.IsMatch(s)) return s;
        return Rewrite(s, WORD_RUN, m =>
        {
            var w = m.Value;
            if (!CONFUSABLE.IsMatch(w)) return w;
            var folded = JsRegex.Replace(JsRegex.Replace(JsRegex.Replace(JsRegex.Replace(w, FOLD_I_LOWER, "ĩ"), FOLD_U_LOWER, "ũ"), FOLD_I_UPPER, "Ĩ"), FOLD_U_UPPER, "Ũ");
            return KAMBA_WORD.IsMatch(folded) ? folded : w;
        });
    }

    /** The shared SYMBOL tier: the measure noun heads its phrase (`unitPrefix` + `currencyPrefix`), and
     *  `magnitudes` is deliberately NOT declared — the magnitude heads the phrase too, so the tier's
     *  number-then-magnitude hop would buy zero readings. See the TS header for the attestation. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "percenti" },
        // ⚠ INSERTION-ORDERED, like JS `Object.keys`: the tier sorts currency keys longest-first, stably.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "ndola" },
            ["AUD$"] = new[] { "ndola" },
            ["$"] = new[] { "ndola" },
        },
        CurrencyPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilomita" },
            ["m"] = new[] { "mita" },
            ["mm"] = new[] { "milimita" },
            ["cm"] = new[] { "sendimita" },
            ["mi"] = new[] { "maili" },
        },
        UnitPrefix = true,
        UnitPer = "kwa",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["h"] = "isaa",
            ["s"] = "sekondi",
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "sikwea" },
            Cubed = new[] { "kubik" },
            Position = ExponentPosition.Before,
        },
        Multiply = new MultiplyDef { Times = "kwa" },
        Ampersand = "na",
    });

    private static readonly JsRe SQ_MI =
        JsRegex.Compile($"{NOT_BEFORE}(\\d[\\d,.]*)\\s?sq\\s?mi{NOT_AFTER}", "gu");
    private static readonly JsRe MPH =
        JsRegex.Compile($"{NOT_BEFORE}(\\d[\\d,.]*)\\s?mph{NOT_AFTER}", "gu");
    private static readonly JsRe CURRENCY_NOUN =
        JsRegex.Compile($"{NOT_BEFORE}[Nn]dola\\s+((?:US|AUD)?\\$)\\s?(?=\\d)", "gu");
    private static readonly JsRe SIGN_BEFORE_MAGNITUDE =
        JsRegex.Compile($"{NOT_BEFORE}(?:US|AUD)?\\$\\s?(?=(?:milioni|mbilioni|ngili){NOT_AFTER})", "gu");
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile(@"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile(@"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)", "gu");
    private static readonly JsRe RANGE =
        JsRegex.Compile(@"(?<![\d.,\-\/:])(\d+)([^\S\n]?)-\2(\d+)(?![\d\/:\p{L}\p{M}])(?!\s?-\s?\d)", "gu");
    private static readonly JsRe DECIMAL_DOT =
        JsRegex.Compile(@"(?<![\d.])(\d+)\.(\d+)(?!\d)(?!\.\d)", "gu");
    private static readonly JsRe DEGREE =
        JsRegex.Compile($"(\\d[\\d.,]*)\\s?°\\s?[CF]?{NOT_AFTER}", "gui");
    /** The "the writer already said it" test for the degree word. */
    private static readonly JsRe SAID_NDIKILII = JsRegex.Compile(@"ndikilii\s*[+\-−]?\s*$", "iu");
    private static readonly JsRe CLOCK =
        JsRegex.Compile(@"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])", "gu");
    private static readonly JsRe SPACED_DASH =
        JsRegex.Compile(@"(?<!\d)[^\S\n]+-{1,2}[^\S\n]+(?!\d)", "gu");
    private static readonly JsRe RUN_OF_SPACES = JsRegex.Compile(@"[^\S\n]{2,}", "gu");

    /** Normalize one Kamba input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeKamba(string input)
    {
        // ⚠ NFC FIRST: this corpus writes ⟨ĩ ũ⟩ precomposed throughout, but a decomposed input would slip
        // past the confusable fold below and every literal in this file.
        var s = Renormalize(input, System.Text.NormalizationForm.FormC);

        // 1) THE CONFUSABLE TILDE VOWELS, BEFORE EVERYTHING — it changes which characters the tokenizer
        //    and every rule below can see at all.
        s = FoldTildeConfusables(s);

        // 2) `sq mi` — THE SQUARE MILE, WRITTEN AS TWO TOKENS. ⚠ THE MEASURE WORDS ARE EMITTED DIRECTLY
        //    rather than rewritten to `mi²` — an INVENTED superscript reaches the phoneme sink as a RAWMARK
        //    wherever the tier's digit-adjacency then declines.
        s = Rewrite(s, SQ_MI, "sikwea sya maili $1");

        // 3) `mph`. Composed here rather than as a `units` key because `unitPrefix` would move a
        //    three-word reading wholesale in front of its number. Before the tier, or its `mi` key would
        //    have to be kept off `mph` by a second guard.
        s = Rewrite(s, MPH, "maili $1 kwa isaa");

        // 4) THE CURRENCY NOUN THE WRITER ALREADY WROTE. ⚠ CONSUMED HERE AND PUT BACK BY THE TIER: the
        //    tier has an "already said it" suppression for PERCENT and none for currency, so left alone
        //    this reads the noun twice.
        s = Rewrite(s, CURRENCY_NOUN, "$1");

        // 5) THE SIGN BEFORE A MAGNITUDE WORD — the tier needs a digit adjacent to the mark and this
        //    shape puts the magnitude between them, so the sign would simply be dropped.
        s = Rewrite(s, SIGN_BEFORE_MAGNITUDE, "ndola ");

        // 6) THE SHARED SYMBOL TIER. ⚠ IT MUST RUN BEFORE THE DECIMAL STEP or `NOT_VERSION` has no dot
        //    left to reject and the `m` key claims `802.11m`.
        s = SYMBOLS(s);

        // 7) DE-GROUPING, BY THE THREE-DIGIT TEST ON BOTH MARKS. ⚠ THE WHOLE NUMBER AT ONCE — `5,000,000`
        //    is three groups and a per-pass join reads it as two numbers. ⚠ AND THE TRAILING GUARD
        //    REJECTS A DIGIT AND NOTHING ELSE: this corpus ends a clause on a figure 152 times.
        s = Rewrite(s, GROUP_COMMA, m => m.Groups[1].Value + m.Groups[2].Value.Replace(",", ""));
        s = Rewrite(s, GROUP_DOT, m => m.Groups[1].Value + m.Groups[2].Value.Replace(".", ""));

        // 8) RANGES → `kũthi`, ABOVE THE DECIMAL STEP and that ordering is a defect this layer would
        //    otherwise have INTRODUCED: the corpus's `miaka 4.2- 3.9 tene muno` is a DESCENDING span of
        //    millions of years, and spending its decimal points first leaves an ascending `2- 3`.
        //    ⚠ ASCENDING ONLY, and `:` IS IN BOTH GUARDS, or `saa 10:00-11:000` matches at `00-11` and
        //    the clock is destroyed. ⚠ TWO MORE GUARDS EXIST FOR ONE AIRCRAFT: a LETTER after the second
        //    operand rejects `2-76s`, and the SPACING BACKREFERENCE rejects `2 -76`, because a span is
        //    spaced symmetrically or not at all.
        s = Rewrite(s, RANGE, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[3].Value)
                ? $"{m.Groups[1].Value} kũthi {m.Groups[3].Value}"
                : m.Value);

        // 9) THE DECIMAL DOT, NEUTRALISED. ⚠ NO DECIMAL WORD IS SOURCEABLE, so the mark is SPENT rather
        //    than spoken; the defect being fixed is the false sentence break mid-quantity. ⚠ AND IT IS
        //    ALSO THE CLOCK RULE FOR THE DOTTED NOTATION — `saa 12.00 GMT` — which comes out identical to
        //    what step 11 does to `saa 11:00`.
        s = Rewrite(s, DECIMAL_DOT, "$1 $2");

        // 10) DEGREES. ⚠ THE WRITER HAS ALREADY SAID IT — `ndikilii` stands immediately before the sign,
        //     so emitting the word again would double it. ⚠ THE SCALE LETTER IS CONSUMED AND NOT READ:
        //     no Celsius or Fahrenheit name exists in any source for this language.
        // ⚠ `full` IS THE PRE-REPLACE STRING, as JS's replace callback argument is — snapshot it.
        var src10 = s;
        s = Rewrite(s, DEGREE, m =>
            SAID_NDIKILII.IsMatch(src10[..m.Index])
                ? m.Groups[1].Value
                : $"ndikilii {m.Groups[1].Value}");

        // 11) THE CLOCK. The colon is clause punctuation in Kamba.cs, so `saa 11:00` read as a phrase
        //     break inside a time. ⚠ THE TWO-DIGIT MINUTE BOUND IS THE WHOLE GUARD and it is what
        //     declines the ratio `3:2`, the degree class `2:2`, and the sports times' trailing `.`.
        s = Rewrite(s, CLOCK, "$1 $2");

        // 12) A SPACED DASH is a parenthetical break. LAST, so step 8 has already claimed every dash
        //     between two numbers — the score keeps its bare juxtaposition rather than gaining a
        //     spurious pause.
        s = Rewrite(s, SPACED_DASH, ", ");

        return Rewrite(s, RUN_OF_SPACES, " ");
    }
}
