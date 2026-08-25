/**
 * Odia (or) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/odia/normalize.ts — see that file for the corpus evidence.
 *
 * ⚠ NO `\b` ANYWHERE IN THIS FILE: it is ASCII-defined in both runtimes and matches nothing against Odia
 * script, so every boundary is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])` lookaround.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Odia;

public static class Normalize
{
    /** The SHARED symbol tier, with Odia's data. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "ଏବଂ",
        Multiply = new MultiplyDef { Times = "ଗୁଣନ" },
        Percent = OdiaPhonemizer.DEF.SymbolTier.Percent,
        Currency = OdiaPhonemizer.DEF.SymbolTier.Currency,
        Units = OdiaPhonemizer.DEF.SymbolTier.Units,
        RateDenominators = OdiaPhonemizer.DEF.SymbolTier.RateDenominators,
        UnitPer = OdiaPhonemizer.DEF.SymbolTier.UnitPer,
        ExponentWords = OdiaPhonemizer.DEF.SymbolTier.ExponentWords,
        Magnitudes = OdiaPhonemizer.DEF.SymbolTier.Magnitudes,
    });

    /** Odia unit abbreviations → the full word, matched only AFTER a number. ⚠ ORDER IS LOAD-BEARING: the
     *  alternation is built longest-first (see UNIT_ALT), so କି.ମି. is claimed before bare ମି — multi-dot
     *  abbreviations before single-dot ones. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["କି.ମି."] = "କିଲୋମିଟର", ["କି.ମି"] = "କିଲୋମିଟର", ["କିମି"] = "କିଲୋମିଟର",
        ["ମି.ମି."] = "ମିଲିମିଟର", ["ମି.ମି"] = "ମିଲିମିଟର", ["ମିମି"] = "ମିଲିମିଟର",
        ["କି.ଗ୍ରା."] = "କିଗ୍ରା", ["କି.ଗ୍ରା"] = "କିଗ୍ରା",
    };

    private static readonly JsRe DOT_ESCAPE = JsRegex.Compile("\\.", "gu");
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys
        .OrderByDescending(k => k.Length)
        .Select(k => DOT_ESCAPE.Replace(k, "\\.")));

    /** Measure nouns that may stand either side of a rate slash. A CLOSED LIST on both sides, because only
     *  five of the corpus's fourteen Odia-to-Odia slashes are rates. */
    private static readonly string[] RATE_NUM = { "କିଲୋମିଟର", "ମିଲିମିଟର", "ମିଟର", "ମାଇଲ୍", "ମାଇଲ" };
    private static readonly string[] RATE_DEN = { "ଘଣ୍ଟା", "ସେକେଣ୍ଡ", "ମିନିଟ୍", "ମିନିଟ" };

    /** Read from the manifest — LONGEST FIRST, and the order is load-bearing (see the jsonc). */
    private static IReadOnlyList<string> ORDINAL_SUFFIXES => OdiaPhonemizer.DEF.OrdinalSuffixes;

    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe LATIN_INITIALISM = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])([A-Za-z](?:\\.[A-Za-z])+)\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RATE_SLASH = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({string.Join("|", RATE_NUM)})\\s?/\\s?({string.Join("|", RATE_DEN)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe GROUP_INDIC = JsRegex.Compile("(?<![\\d,])(\\d{1,2}(?:,\\d{2})+,\\d{3})(?![\\d,])", "gu");
    private static readonly JsRe GROUP_WESTERN = JsRegex.Compile("(?<![\\d,])(\\d{1,3}(?:,\\d{3})+)(?![\\d,])", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe KG_STANDALONE = JsRegex.Compile("(?<![\\p{L}\\p{M}])କି\\.ଗ୍ରା\\.?", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(\\d)\\.(?=\\d)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s?({string.Join("|", ORDINAL_SUFFIXES)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DOCTOR = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:ଡଃ|ଡାଃ)\\.(\\s*)(?=[\\p{L}])", "gu");
    private static readonly JsRe NUMBER_ABBR = JsRegex.Compile("(?<![\\p{L}\\p{M}])ନଂ\\.(\\s*)(?=[\\d\\p{L}])", "gu");
    private static readonly JsRe LATIN_DANDA = JsRegex.Compile("(?<![A-Za-z\\d])I(?![A-Za-z\\d])", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe LEADING_MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_BEFORE = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUS = JsRegex.Compile("\\+(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");

    /** Build the Odia normalizer. Takes the numbers definition so the ordinal rule composes its cardinal
     *  from exactly the data the engine's own number path uses. */
    public static Func<string, string> MakeOdiaNormalizer(NumbersDef numbers)
    {
        /** The ordinal: the cardinal with the suffix JOINED to its final word. Joining it in the DIGITS is
         *  not enough — the tokenizer splits a digit run from an adjacent Odia letter, so `18ଶ` would still
         *  emit the suffix as its own stressed word. Bails out on any un-authored gap. */
        string? Ordinal(double n, string suffix)
        {
            var words = Numbers.indicNumberWords(n, numbers);
            if (words.Count == 0 || words.Any(w => string.IsNullOrEmpty(w))) return null;
            var outp = words.Select(w => w!).ToList();
            outp[^1] = $"{outp[^1]}{suffix}";
            return string.Join(" ", outp);
        }

        return input =>
        {
            // ⚠ ORDER IS LOAD-BEARING throughout. The SHARED SYMBOL TIER runs FIRST: it matches a sign only
            // when a NUMBER is adjacent and reads `19,500` / `14.7` as ONE token, while the de-grouping and
            // decimal steps below split exactly those in two — running them first strands every sign.
            var s = SYMBOLS(input);

            // Unit abbreviations before the rate slash below, so its left-hand side is a full measure noun
            // by the time that rule runs (`160କିମି/ଘଣ୍ଟା`).
            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            s = LATIN_INITIALISM.Replace(s, m => DOT_ESCAPE.Replace(m.Groups[1].Value, ""));

            s = RATE_SLASH.Replace(s, m => $"{m.Groups[1].Value} ପ୍ରତି {m.Groups[2].Value}");

            // De-grouping before anything else that reads punctuation, or `7,000` reads as "seven, zero".
            // Both groupings: Indian 2-2-3 and Western 3-3.
            s = GROUP_INDIC.Replace(s, m => COMMAS.Replace(m.Value, ""));
            s = GROUP_WESTERN.Replace(s, m => COMMAS.Replace(m.Value, ""));

            s = KG_STANDALONE.Replace(s, "କିଗ୍ରା");

            // Decimals after de-grouping and before the clock. The dot is NEUTRALISED, not spoken: the defect
            // is the SENTENCE BREAK it produced mid-number.
            s = DECIMAL_DOT.Replace(s, "$1 ");

            // The clock before the ordinal rule, and the colon becomes a space (it was reading as a pause).
            s = CLOCK.Replace(s, m =>
                Js.Number(m.Groups[2].Value) == 0 ? m.Groups[1].Value : $"{m.Groups[1].Value} {m.Groups[2].Value}");

            // ⚠ THE TRAILING BOUNDARY IS LOAD-BEARING: in `18ଶହ ଶତାବ୍ଦୀ` the ଶହ is the HUNDRED word, not the
            // ordinal suffix ଶ, and must be left alone.
            s = ORDINAL_RE.Replace(s, m =>
                Ordinal(Js.Number(m.Groups[1].Value), m.Groups[2].Value) ?? m.Value);

            // The DOT IS REQUIRED here, and so is the visarga: a dot-optional rule would also fire on an
            // ordinary word-final ଡା.
            s = DOCTOR.Replace(s, m => $"ଡାକ୍ତର{(m.Groups[1].Value.Length > 0 ? m.Groups[1].Value : " ")}");
            s = NUMBER_ABBR.Replace(s, m => $"ନମ୍ବର{(m.Groups[1].Value.Length > 0 ? m.Groups[1].Value : " ")}");

            // A Latin `I` standing alone is a keyboard artifact for the danda ।, not the English pronoun; the
            // guard is against other LATIN letters and digits only, since it is often glued to an Odia word.
            s = LATIN_DANDA.Replace(s, "।");

            s = DEGREE.Replace(s, "$1 ଡିଗ୍ରୀ");

            s = PLUS_MINUS.Replace(s, " ପ୍ଲସ୍ ଋଣାତ୍ମକ ");
            var frozen = s;
            s = LEADING_MINUS.Replace(s, m => DIGIT_BEFORE.IsMatch(frozen[..m.Index]) ? m.Value : "ଋଣାତ୍ମକ ");
            s = PLUS.Replace(s, " ପ୍ଲସ୍ ");

            // ⚠ THE COMPARATIVES ARE POSTPOSED (ଠାରୁ follows the standard and fuses to it), hence the shared
            // postposed-sign pass; rewriting them as an infix rule reads the comparison backwards.
            s = PostposedSignPass.PostposedSign(s, "<", "ଠାରୁ କମ");
            s = PostposedSignPass.PostposedSign(s, ">", "ଠାରୁ ଅଧିକ");
            s = EQUALS.Replace(s, " ସମାନ ");
            s = DIVIDE.Replace(s, " ଭାଗ ");

            return s;
        };
    }
}
