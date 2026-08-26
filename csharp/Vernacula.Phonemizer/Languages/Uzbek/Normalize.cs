/**
 * Uzbek (uz) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA. Runs BEFORE the
 * shared symbol tier, and its steps are ORDER-DEPENDENT.
 * Ported from src/languages/uzbek/normalize.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Uzbek;

public static class Normalize
{
    /** A word character. UPPERCASE included — the hyphen-ordinal writing is orthographic, not case-bound. */
    private const string WORD = @"[A-Za-zʻ'’‘`ʼ′]";
    /** A number token the ordinal/dot/era rules rewrite. */
    private const string DIGITS = @"(\d+(?:,\d+)?)";

    /** Uzbek letter names (26 letters + oʻ/gʻ/sh/ch/ng which never need spelling). */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "se", ["d"] = "de", ["e"] = "e", ["f"] = "ef", ["g"] = "ge",
        ["h"] = "ha", ["i"] = "i", ["j"] = "je", ["k"] = "ka", ["l"] = "el", ["m"] = "em", ["n"] = "en",
        ["o"] = "o", ["p"] = "pe", ["q"] = "qa", ["r"] = "er", ["s"] = "es", ["t"] = "te", ["u"] = "u",
        ["v"] = "ve", ["w"] = "ve", ["x"] = "xa", ["y"] = "ye", ["z"] = "ze",
    };

    private static string? LetterName(string l) =>
        LETTER_NAME.TryGetValue(Js.ToLowerCase(l), out var v) ? v : null;

    /** Uzbek phonotactics, for the OOV rule in Core/Initialisms.cs. */
    private static readonly Func<string, bool> IsUnreadableUzbek = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiou]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "by", "dr", "dy", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "ky", "pl",
            "pr", "ps", "py", "sk", "sl", "sm", "sn", "sp", "st", "sv", "sy", "tr", "ts", "vy",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ft", "kt", "ks", "lm", "lt", "nd", "ng", "nk", "nt", "pt", "rd", "rf", "rk", "rl",
            "rm", "rn", "rp", "rs", "rt", "sk", "st", "ts", "yk",
        }, StringComparer.Ordinal),
    });

    /** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(new[] { "aqsh", "nasa", "asus", "opec", "rem", "covid" }, StringComparer.Ordinal);

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = LetterName,
        AcronymLetters = new HashSet<string>(new[] { "pa", "to", "oha", "aol" }, StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = IsUnreadableUzbek,
    });

    // ── Step 0: digit de-grouping ───────────────────────────────────────────────────────────────────
    private static readonly JsRe GROUPING = JsRegex.Compile(@"(?<=\d)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile(@"[ \u00a0\u202f\u2009]", "gu");

    // ── Step 1: era markers ─────────────────────────────────────────────────────────────────────────
    private static readonly JsRe ERA_BC_NUM = JsRegex.Compile(@"(?<![\p{L}\p{M}])m\.a\.(?=\s*(?:\d|milodiy|avval))", "giu");
    private static readonly JsRe ERA_BC = JsRegex.Compile(@"(?<![\p{L}\p{M}])m\.a\.(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile(@"(?<![\p{L}\p{M}])m\.(?=\s*\d)", "giu");

    // ── Step 2: dotted abbreviations ────────────────────────────────────────────────────────────────
    private static readonly JsRe HK_WORD = JsRegex.Compile(@"(?<![\p{L}\p{M}])h\.k\.(?=\s+\p{L})", "giu");
    private static readonly JsRe HK_END = JsRegex.Compile(@"(?<![\p{L}\p{M}])h\.k\.(?=\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe MLN_WORD = JsRegex.Compile(@"(?<![\p{L}\p{M}])mln\.(?=\s+\p{L})", "giu");
    private static readonly JsRe MLN_END = JsRegex.Compile(@"(?<![\p{L}\p{M}])mln\.(?=\s*(?:[.,;:!?»)]|$))", "giu");

    // ── Step 3: clock ───────────────────────────────────────────────────────────────────────────────
    private static readonly JsRe CLOCK = JsRegex.Compile(@"(?<![\d.,:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu");

    // ── Step 4: version dots ────────────────────────────────────────────────────────────────────────
    private static readonly JsRe VERSION_DOT =
        JsRegex.Compile(@"(?<![\d.,])(\d+)\.(\d+)(?:-(" + WORD + @"+))?(?!" + WORD + ")", "gu");

    // ── Step 5: the ordinal `N-word` ────────────────────────────────────────────────────────────────
    private static readonly JsRe ORDINAL_HYPHEN =
        JsRegex.Compile(DIGITS + "-(" + WORD + @"+)(?!" + WORD + ")", "gu");

    // ── Step 6: regnal ordinals ─────────────────────────────────────────────────────────────────────
    private static readonly JsRe REGNAL =
        JsRegex.Compile(@"(\p{Lu}\p{Ll}+\p{M}*)[ \u00a0](\d{1,2})(?![,\d])(?=[ \u00a0](?:ning|hukmron))", "gu");

    // ── Step 7: fractions ───────────────────────────────────────────────────────────────────────────
    private static readonly JsRe THREE_QUARTERS = JsRegex.Compile(@"(\d+)¾", "gu");
    private static readonly JsRe HALF = JsRegex.Compile(@"(\d+)½", "gu");
    private static readonly JsRe SLASH_FRACTION = JsRegex.Compile(@"(?<![\d.,/])(\d{1,2})\/(\d{1,2})(?![\d.,/])", "gu");

    // ── Step 8: degrees ─────────────────────────────────────────────────────────────────────────────
    private static readonly JsRe DEG_C = JsRegex.Compile(@"(\d)\s?°\s?C(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile(@"(\d)\s?°\s?F(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile(@"(\d)\s?°(?![\p{L}\p{M}])", "gu");

    // ── Step 9: signs ───────────────────────────────────────────────────────────────────────────────
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_INFIX = JsRegex.Compile(@"(\S)\+\s?(\d)", "gu");
    private static readonly JsRe PLUS_POST = JsRegex.Compile(@"(\d)\s?\+", "gu");
    private static readonly JsRe PLUS_PRE = JsRegex.Compile(@"(^|\s)\+\s?(\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile(@"(?<![\p{L}\p{Nd}])[-−](?=\d)", "gu");
    // ⚠ NO `u` FLAG — the TS literal is /…/g, and the flags drive the translator's code-point rewrites.
    private static readonly JsRe AMP_LETTERS = JsRegex.Compile("([A-Za-z])&([A-Za-z])", "g");
    private static readonly JsRe AMP = JsRegex.Compile("&", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile(@"(\S)\s*=\s*(\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile(@"(\d)\s*<\s*(\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile(@"(\d)\s*>\s*(\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile(@"(\d)\s*×\s*(\d)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile(@"(\d)\s*÷\s*(\d)", "gu");

    // ── Step 9b: percent with a possessive suffix ───────────────────────────────────────────────────
    private static readonly JsRe PERCENT_POSS = JsRegex.Compile(@"(\d+)%i(?![\p{L}\p{M}])", "gu");

    // ── Step 10: rates ──────────────────────────────────────────────────────────────────────────────
    private const string RATE_SUFFIX = @"(?:\s?(ga|gacha|dan|da))?";
    private static readonly JsRe KMH_RANGE =
        JsRegex.Compile(@"(\d+(?:,\d+)?)[–-](\d+(?:,\d+)?)\s?km\s?\/\s?(?:soat|s|h)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe MIL_RANGE =
        JsRegex.Compile(@"(\d+(?:,\d+)?)[–-](\d+(?:,\d+)?)\s?mil\s?\/\s?(?:soat|s|h)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe KMH =
        JsRegex.Compile(@"(\d+(?:,\d+)?)\s?km\s?\/\s?(?:soat|s|h)" + RATE_SUFFIX + @"(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe MILH =
        JsRegex.Compile(@"(\d+(?:,\d+)?)\s?mil\s?\/\s?(?:soat|s|h)" + RATE_SUFFIX + @"(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe MILYAH =
        JsRegex.Compile(@"(\d+(?:,\d+)?)\s?milya\s?\/\s?soat" + RATE_SUFFIX + @"(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe MS =
        JsRegex.Compile(@"(\d+(?:,\d+)?)\s?m\s?\/\s?s" + RATE_SUFFIX + @"(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe GHZ = JsRegex.Compile(@"(\d+(?:,\d+)?)\s?Gs\b(?![\p{L}\p{M}])", "giu");

    // ── Step 10b: lone personal initials ────────────────────────────────────────────────────────────
    private static readonly JsRe LONE_INITIAL = JsRegex.Compile(@"(?<![\p{L}\p{M}])([A-Z])\.(?=[ \u00a0]+[A-Za-z])", "gu");

    private static string Suffix(Match m, int group) => m.Groups[group].Success ? m.Groups[group].Value : "";

    /** Normalize one Uzbek input string. Pure text→text; ordered, and each ordering coupling is stated in
     *  the TypeScript. Runs BEFORE the shared symbol tier. */
    public static string NormalizeUzbek(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING, first. ONE pass: the separator is matched zero-width, so every
        //    separator in the run is claimed at once.
        s = GROUPING.Replace(s, "");
        s = SPACES.Replace(s, " ");

        // 1) ERA MARKERS, before the single-dot rules so the interior dots cannot survive as breaks.
        s = ERA_BC_NUM.Replace(s, "miloddan avval");
        s = ERA_BC.Replace(s, "miloddan avval");
        s = ERA_AD.Replace(s, "milodiy");

        // 2) DOTTED ABBREVIATIONS.
        s = HK_WORD.Replace(s, "hokazo");
        s = HK_END.Replace(s, "hokazo.");
        s = MLN_WORD.Replace(s, "million");
        s = MLN_END.Replace(s, "million.");

        // 3) CLOCK, before the symbol tier can see the separator. Output stays DIGITS.
        s = CLOCK.Replace(s, m =>
            Js.Number(m.Groups[2].Value) == 0 ? m.Groups[1].Value : $"{m.Groups[1].Value} {m.Groups[2].Value}");

        // 4) VERSION DOTS, before the ordinal rule.
        s = VERSION_DOT.Replace(s, m =>
            !m.Groups[3].Success
                ? $"{m.Groups[1].Value} nuqta {m.Groups[2].Value}"
                : $"{m.Groups[1].Value} nuqta {m.Groups[2].Value} {m.Groups[3].Value}");

        // 5) ORDINAL `N-word` — the defining rule (see the TS header).
        s = ORDINAL_HYPHEN.Replace(s, m =>
        {
            var d = m.Groups[1].Value;
            var w = m.Groups[2].Value;
            var wl = Js.ToLowerCase(w);
            if (wl.StartsWith("regbi", StringComparison.Ordinal) || wl.StartsWith("moliviy", StringComparison.Ordinal))
                return $"{Numbers.NumberToWords(Js.Number(Js.ReplaceFirst(d, ",", ".")))} {w}";
            var ord = Numbers.OrdinalWords(Js.Number(Js.ReplaceFirst(d, ",", ".")));
            return ord is null ? $"{d} {w}" : $"{ord} {w}";
        });

        // 6) REGNAL ORDINALS — guarded on the corpus's genitive, and ONLY that.
        s = REGNAL.Replace(s, m =>
        {
            var n = Js.Number(m.Groups[2].Value);
            var ord = Numbers.OrdinalWords(n);
            return ord is null || n < 2 || n > 39 ? m.Value : $"{m.Groups[1].Value} {ord}";
        });

        // 7) FRACTIONS.
        s = THREE_QUARTERS.Replace(s, "$1 va uch chorak");
        s = HALF.Replace(s, "$1 va yarim");
        s = SLASH_FRACTION.Replace(s, m =>
        {
            var num = Js.Number(m.Groups[1].Value);
            var denom = Js.Number(m.Groups[2].Value);
            if (denom < 2 || num < 1 || num >= denom) return m.Value; // improper/degenerate → not a fraction
            if (num == 1 && denom == 2) return "yarim";
            if (num == 1 && denom == 4) return "chorak";
            return $"{Numbers.NumberToWords(denom)}dan {Numbers.NumberToWords(num)}";
        });

        // 8) DEGREE, before the sign rule can strand the +.
        s = DEG_C.Replace(s, "$1 daraja");
        s = DEG_F.Replace(s, "$1 daraja farengeyt");
        s = DEG.Replace(s, "$1 daraja");

        // 9) SIGNS. ⚠ INFIX before POSTPOSED, and ± is a single character no `+` rule can reach.
        s = PLUS_MINUS.Replace(s, " plyus minus ");
        s = PLUS_INFIX.Replace(s, "$1 plyus $2");
        s = PLUS_POST.Replace(s, "$1 plyus");
        s = PLUS_PRE.Replace(s, "$1plyus $2");
        s = MINUS.Replace(s, "minus ");
        s = AMP_LETTERS.Replace(s, m =>
            $"{LetterName(m.Groups[1].Value) ?? m.Groups[1].Value} va {LetterName(m.Groups[2].Value) ?? m.Groups[2].Value}");
        s = AMP.Replace(s, " va ");
        s = EQUALS.Replace(s, "$1 teng $2");
        s = LESS_THAN.Replace(s, "$1 kichik $2");
        s = GREATER_THAN.Replace(s, "$1 katta $2");
        s = TIMES.Replace(s, "$1 karra $2");
        s = DIVIDE.Replace(s, "$1 boʻlish $2");

        // 9b) PERCENT with a POSSESSIVE SUFFIX — the plain `N%` is left for the shared symbol tier.
        s = PERCENT_POSS.Replace(s, "$1 foizi");

        // 10) RATES, before the shared symbol tier: the corpus's own prose reads them PREFIXED.
        s = KMH_RANGE.Replace(s, "soatiga $1 dan $2 kilometr");
        s = MIL_RANGE.Replace(s, "soatiga $1 dan $2 mil");
        s = KMH.Replace(s, m => $"soatiga {m.Groups[1].Value} kilometr{Suffix(m, 2)}");
        s = MILH.Replace(s, m => $"soatiga {m.Groups[1].Value} mil{Suffix(m, 2)}");
        s = MILYAH.Replace(s, m => $"soatiga {m.Groups[1].Value} milya{Suffix(m, 2)}");
        s = MS.Replace(s, m => $"soniyasiga {m.Groups[1].Value} metr{Suffix(m, 2)}");
        s = GHZ.Replace(s, "$1 gigagerts");

        // 10b) LONE PERSONAL INITIALS the shared pass cannot claim ("T. rex", "N. Ueyn").
        s = LONE_INITIAL.Replace(s, m => LetterName(m.Groups[1].Value) ?? m.Groups[1].Value);

        // 11) INITIALISMS, LAST of the letter rules.
        s = NormalizeInitialisms(s);

        return s;
    }
}
