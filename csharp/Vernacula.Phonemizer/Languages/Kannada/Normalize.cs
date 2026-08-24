/**
 * Kannada (kn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/kannada/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kannada;

public static class Normalize
{
    /** Kannada letter+mark boundary. Never `\b`. */
    private const string NB = "(?<![\\p{L}\\p{M}])";
    private const string NA = "(?![\\p{L}\\p{M}])";

    /** The SHARED symbol tier (percent / currency / units / exponent). */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "ಮತ್ತು",
        Multiply = new MultiplyDef { Times = "ಗುಣಿಸಿ" },
        Percent = new[] { "ಪ್ರತಿಶತ" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "ಡಾಲರ್" }, ["$"] = new[] { "ಡಾಲರ್" },
        },
        Magnitudes = new[] { "ಮಿಲಿಯನ್", "ಬಿಲಿಯನ್", "ದಶಲಕ್ಷ", "ಶತಕೋಟಿ", "ಲಕ್ಷ", "ಕೋಟಿ" },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "ಕಿಲೋಮೀಟರ್" }, ["m"] = new[] { "ಮೀಟರ್" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "ಚದರ" },
            Cubed = new[] { "ಘನ" },
            Position = ExponentPosition.Before,
        },
    });

    /** Kannada unit abbreviations. */
    private static readonly JsRe KM_RE = JsRegex.Compile($"{NB}(?:ಕಿ\\s*\\.\\s*ಮ[ೀಿ]|ಕಿಮ[ೀಿ])", "gu");

    /**
     * ಮೈ for ಮೈಲಿ — ONLY as a rate numerator (`40 ಮೈ/ಗಂ`). The `/ಗಂ` guard is what keeps this off the many
     * real Kannada words beginning ಮೈ.
     */
    private static readonly JsRe MI_RATE_RE = JsRegex.Compile("(\\d[\\d.]*)\\s?ಮೈ\\s*\\/\\s*ಗಂ\\.?", "gu");

    /** Era markers. */
    private static readonly IReadOnlyDictionary<string, string> ERA = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ಪೂ"] = "ಕ್ರಿಸ್ತ ಪೂರ್ವ",
        ["ಶ"] = "ಕ್ರಿಸ್ತ ಶಕ",
    };

    /** Kannada renderings of the LATIN letter names that occur in a dotted initialism (ಯು.ಎಸ್, ಡಿ.ಕೆ). */
    private static readonly string[] LETTER_NAME = { "ಯು", "ಎಸ್", "ಡಿ", "ಕೆ" };
    private static readonly string LETTER =
        $"(?:{string.Join("|", LETTER_NAME.OrderByDescending(x => x.Length))})";

    /** A run of ≥2 dot-separated letter names. The run's TRAILING dot is consumed only when the sentence
     *  visibly continues, so a true sentence-final pause is never lost. */
    private static readonly JsRe INITIALISM_RE = JsRegex.Compile(
        $"{NB}{LETTER}(?:\\s*\\.\\s*{LETTER})+(?:\\s*\\.(?=\\s*[\\p{{L}}]))?{NA}", "gu");

    /** Kannada rate denominators, in the dative. */
    private static readonly IReadOnlyDictionary<string, string> RATE_DENOM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ಗಂ"] = "ಗಂಟೆಗೆ", ["ಸೆ"] = "ಸೆಕೆಂಡಿಗೆ",
    };

    /** The dative rate prefix, UNLESS the text already carries it. */
    private static string Dative(string word, string full, int offset) =>
        JsRegex.Compile($"{word}\\s*$", "u").IsMatch(full[..offset]) ? "" : $"{word} ";

    private static readonly IReadOnlyDictionary<string, string> VULGAR = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["¼"] = "ಕಾಲು", ["½"] = "ಅರ್ಧ", ["¾"] = "ಮುಕ್ಕಾಲು",
    };

    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[​‌‍﻿]", "gu");
    private static readonly JsRe GROUPING = JsRegex.Compile("(?<=\\d),(?=\\d{3}(?:,\\d|[^\\d]|$))", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s*-?\\s*(ನೇ|ನೆಯ)(ದು)?{NA}", "gu");
    private static readonly JsRe ERA_RE = JsRegex.Compile($"{NB}ಕ್ರಿ\\s*\\.\\s*(ಪೂ|ಶ)(?:\\s*\\.(?=\\s*[\\p{{L}}\\d]))?", "gu");
    private static readonly JsRe DOTTED = JsRegex.Compile("\\s*\\.\\s*", "gu");
    private static readonly JsRe LETTER_START = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe MM_RE = JsRegex.Compile($"{NB}ಮಿ\\s*\\.\\s*ಮೀ", "gu");
    private static readonly JsRe KM_RATE_RE = JsRegex.Compile(
        $"(\\d[\\d.]*)\\s?ಕಿಲೋಮೀಟರ್\\s*\\/\\s*(ಗಂ|ಸೆ)\\.?{NA}", "gu");
    private static readonly JsRe VULGAR_RE = JsRegex.Compile("(?<=\\d)\\s?([¼½¾])", "gu");
    private static readonly JsRe CLOCK_00 = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):\\s?00(?![\\d:.])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<=\\d):\\s?(?=\\d)", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("(\\d)\\s?°\\s?", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");

    /**
     * The Kannada normalizer. A numbered, ORDER-DEPENDENT sequence; the coupling is stated at each step.
     */
    public static string NormalizeKannada(string input)
    {
        // 1. Zero-width characters FIRST: every later rule asserts letter/digit adjacency, and an invisible
        // character defeats all of them. It also splits a word for the tokenizer, whose word class is the
        // Kannada block and excludes U+200C/U+200D.
        var s = ZERO_WIDTH.Replace(input, "");

        // 2. Kannada digits → ASCII, before every numeric rule below, so a native-digit numeral is eligible
        // for the same de-grouping, ordinal, percent and unit handling as an ASCII one.
        s = Unicode.FoldNativeDigits(s);

        // 3. De-group digits, before anything that reads punctuation, or the separator becomes a clause pause.
        s = GROUPING.Replace(s, "");

        // 4. Ordinals ನೇ / ನೆಯ, AFTER de-grouping — an ordinal can sit on a grouped numeral. The suffix fuses
        // onto the LAST cardinal word; emitted apart, ನೇ reaches the g2p as a stray stressed [nˈeː].
        s = ORDINAL_RE.Replace(s, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n == 0) return m.Value;
            var w = Numbers.OrdinalToWords(n, $"{m.Groups[2].Value}{(m.Groups[3].Success ? m.Groups[3].Value : "")}");
            return w == "" ? m.Value : w;
        });

        // 5. Era markers, BEFORE the dotted-abbreviation rules — ಕ್ರಿ.ಪೂ is a dotted pair by shape and would
        // otherwise survive as two letters with the era lost.
        s = ERA_RE.Replace(s, m => ERA[m.Groups[1].Value]);

        // 6. Multi-dot abbreviations before single-dot ones, else the interior dot survives as a phrase break.
        // The unit is expanded only when nothing is welded onto it: gluing a case clitic to the expansion
        // would build a form Kannada does not have. `frozen` snapshots the subject, which `s` no longer is.
        var frozen = s;
        s = KM_RE.Replace(s, m =>
            LETTER_START.IsMatch(frozen[(m.Index + m.Value.Length)..])
                ? DOTTED.Replace(m.Value, "")
                : "ಕಿಲೋಮೀಟರ್");
        s = MM_RE.Replace(s, "ಮಿಮೀ");
        s = INITIALISM_RE.Replace(s, m => DOTTED.Replace(m.Value, " ").Trim());

        // 7. Rate units, BEFORE the shared symbol tier can claim the numerator and strand the denominator.
        // Kannada's rate is a dative PREFIX, which is why `unitPer` is not declared on the shared tier.
        var frozen2 = s;
        s = KM_RATE_RE.Replace(s, m =>
            $"{Dative(RATE_DENOM[m.Groups[2].Value], frozen2, m.Index)}{m.Groups[1].Value} ಕಿಲೋಮೀಟರ್");
        var frozen3 = s;
        s = MI_RATE_RE.Replace(s, m => $"{Dative("ಗಂಟೆಗೆ", frozen3, m.Index)}{m.Groups[1].Value} ಮೈಲಿ");

        s = VULGAR_RE.Replace(s, m => $" {VULGAR[m.Groups[1].Value]}");

        // 9. The shared symbol tier: percent, currency, units, exponent. UNITS BEFORE DECIMALS — the tier
        // matches a unit only when a NUMBER is adjacent. After de-grouping and after the rate rule.
        s = SYMBOLS(s);

        // 10. Times BEFORE the decimal step: a bare-number rule must not claim `11:30`. `:00` minutes are
        // dropped rather than read, and every remaining digit-colon-digit becomes a space.
        s = CLOCK_00.Replace(s, "$1");
        s = CLOCK_COLON.Replace(s, " ");

        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} {Numbers.DECIMAL_WORD} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        s = PLUS_ATTACHED.Replace(s, "$1 ಪ್ಲಸ್ ");
        s = PLUS_LEADING.Replace(s, "$1ಪ್ಲಸ್ ");

        s = DEGREE.Replace(s, "$1 ಡಿಗ್ರಿ ");

        s = PostposedSignPass.PostposedSign(s, "<", "ಗಿಂತ ಕಡಿಮೆ");
        s = PostposedSignPass.PostposedSign(s, ">", "ಗಿಂತ ಹೆಚ್ಚು");
        s = EQUALS.Replace(s, " ಸಮ ");
        s = DIVIDE.Replace(s, " ಭಾಗಾಕಾರ ");

        return s;
    }
}
