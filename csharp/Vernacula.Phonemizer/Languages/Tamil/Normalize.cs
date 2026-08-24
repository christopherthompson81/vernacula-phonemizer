/**
 * Tamil (ta) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/tamil/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tamil;

public static class Normalize
{
    /** Tamil letter+mark boundary. Never `\b`. */
    private const string NB = "(?<![\\p{L}\\p{M}])";
    private const string NA = "(?![\\p{L}\\p{M}])";

    /** The SHARED symbol tier (percent / currency / units / rate / exponent). */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "பெருக்கல்" },
        Ampersand = "மற்றும்",
        Percent = new[] { "சதவீதம்" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "டாலர்" }, ["$"] = new[] { "டாலர்" },
        },
        Magnitudes = new[] { "மில்லியன்", "பில்லியன்", "ட்ரில்லியன்", "லட்சம்", "கோடி" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "கிலோமீட்டர்" },
            ["cm"] = new[] { "சென்டிமீட்டர்" },
            ["mm"] = new[] { "மில்லிமீட்டர்" },
            ["kg"] = new[] { "கிலோகிராம்" },
            ["mi"] = new[] { "மைல்" },
            ["m"] = new[] { "மீட்டர்" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "சதுர" },
            Cubed = new[] { "கன" },
            Position = ExponentPosition.Before,
        },
    });

    /** Tamil unit abbreviations, written with or without the interior dot. */
    private static readonly IReadOnlyDictionary<string, string> TAMIL_UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["கிமீ"] = "கிலோமீட்டர்", ["கிமி"] = "கிலோமீட்டர்",
        ["மிமீ"] = "மில்லிமீட்டர்", ["மிமி"] = "மில்லிமீட்டர்",
        ["செமீ"] = "சென்டிமீட்டர்", ["செமி"] = "சென்டிமீட்டர்",
        ["கிகி"] = "கிலோகிராம்",
    };

    /**
     * ERA markers, which must be rewritten BEFORE the generic dotted-abbreviation rule below — otherwise
     * the era marker is consumed as a two-letter initialism and lost.
     */
    private static readonly IReadOnlyDictionary<string, string> ERA = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["மு"] = "கிறிஸ்துவுக்கு முன்",
        ["பி"] = "கிறிஸ்துவுக்கு பின்",
    };

    /**
     * Tamil renderings of the LATIN letter names, which is what a dotted Tamil initialism is made of. A
     * CLOSED LIST on purpose; a generic "short token, dot, short token" rule matches sentence boundaries.
     */
    private static readonly string[] LETTER_NAME =
    {
        "ஏ", "பி", "சி", "டி", "இ", "எஃப்", "ஜி", "எச்", "ஐ", "ஜே", "கே", "எல்", "எம்", "என்",
        "ஓ", "க்யூ", "ஆர்", "எஸ்", "யு", "வி", "டபிள்யூ", "எக்ஸ்", "ஒய்", "இசட்", "நா",
    };

    private static string Alt(IEnumerable<string> keys) =>
        string.Join("|", keys.OrderByDescending(a => a.Length));

    private static readonly JsRe TAMIL_UNIT_RE = JsRegex.Compile($"{NB}({Alt(TAMIL_UNIT.Keys)}){NA}", "gu");
    private static readonly JsRe TAMIL_UNIT_DOT_RE = JsRegex.Compile($"{NB}(கி|மி|செ)\\s*\\.\\s*(மீ|மி){NA}", "gu");
    private static readonly JsRe TAMIL_UNIT_SPACED_RE = JsRegex.Compile($"(?<=\\d\\s?)(கி|மி|செ)\\s(மீ|மி){NA}", "gu");
    private static readonly JsRe ERA_RE = JsRegex.Compile($"{NB}கி\\s*\\.?\\s*(மு|பி)\\.?{NA}", "gu");
    private static readonly string LETTER = $"(?:{Alt(LETTER_NAME)})";
    private static readonly JsRe INITIALISM_RE = JsRegex.Compile(
        $"{NB}{LETTER}(?:\\s*\\.\\s*{LETTER})+(?:\\s*\\.(?=\\s+[\\p{{L}}]))?{NA}", "gu");

    /** Ordinal suffixes, longest first: ஆவது / வது take -ஆவது, ஆம் / ம் take -ஆம். */
    private static readonly string[] ORDINAL_SUFFIX = { "ஆவது", "ஆம்", "வது", "ம்" };
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s*-?\\s*({string.Join("|", ORDINAL_SUFFIX)}){NA}", "gu");

    /** Numeric fractions. Only the three attested shapes; Tamil lexicalises the halves and quarters. */
    private static readonly IReadOnlyDictionary<string, string> FRACTION_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["1/2"] = "அரை", ["1/4"] = "கால்", ["3/4"] = "முக்கால்",
    };

    /** ASCII rate units. Tamil puts the denominator FIRST, in the dative. */
    private static readonly IReadOnlyDictionary<string, string> RATE_DENOM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["h"] = "மணிக்கு", ["s"] = "வினாடிக்கு",
    };
    private static readonly IReadOnlyDictionary<string, string> RATE_NUM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "கிலோமீட்டர்", ["m"] = "மீட்டர்", ["mi"] = "மைல்", ["ft"] = "அடி",
    };

    private static string Cardinal(double n) => TamilNumbersComposer.NumberToWords(n);

    /** The rate prefix, UNLESS the text already carries it. */
    private static string Dative(string word, string full, int offset) =>
        JsRegex.Compile($"{word}\\s*$", "u").IsMatch(full[..offset]) ? "" : $"{word} ";

    /** cardinal + ordinal suffix, fused onto the LAST word (15ஆம் → பதினைந்தாம், not *பதினைந்து ஆம்). */
    private static string? Ordinal(double n, string suffix)
    {
        var words = Cardinal(n).Split(' ');
        var last = words.Length > 0 ? words[^1] : null;
        if (last is null || last == "") return null;
        var stem = TamilNumbersComposer.OrdinalStem(last);
        if (stem is null) return null;
        words[^1] = $"{stem}{(suffix == "ஆவது" || suffix == "வது" ? "ாவது" : "ாம்")}";
        return string.Join(" ", words);
    }

    // The step patterns. The TS builds several of these inline; JsRegex.Compile caches, so hoisting them
    // here is a readability choice and not a behaviour one.
    // ⚠ THE ZERO-WIDTH CLASS IS ESCAPED, NOT LITERAL. The TS spells it with the four characters themselves;
    // same class, stated by code point.
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200b-\\u200d\\ufeff]", "gu");
    private static readonly JsRe DEGROUP = JsRegex.Compile("(?<=\\d),(?=\\d{2,3}(?:,\\d|[^\\d]|$))", "gu");
    private static readonly JsRe EGA_RE = JsRegex.Compile($"{NB}எ\\s*\\.\\s*கா\\s*\\.?{NA}", "gu");
    private static readonly JsRe DOT_RUN = JsRegex.Compile("\\s*\\.\\s*", "gu");
    private static readonly JsRe THIRU_RE = JsRegex.Compile($"{NB}திரு\\s*\\.\\s*(?=[\\p{{L}}])", "gu");
    private static readonly JsRe RATE_ASCII = JsRegex.Compile("(?<![\\p{L}\\d])(\\d[\\d.]*)\\s?(km|mi|ft|m)\\s?/\\s?(h|s)(?![A-Za-z])", "giu");
    private static readonly JsRe RATE_MPH = JsRegex.Compile($"(\\d[\\d.]*)\\s?mph{NA}", "giu");
    private static readonly JsRe CLOCK_DOT_TZ = JsRegex.Compile("(?<![\\d.:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?=\\s*(?:UTC|GMT))", "gu");
    private static readonly JsRe CLOCK_ZERO = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):00(?![\\d:.])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<=\\d):(?=\\d)", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe FRACTION_RE = JsRegex.Compile("(?<![\\d./])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe LOCATIVE = JsRegex.Compile("(\\d)\\s*-?\\s*ல்(?![\\p{L}\\p{M}])", "gu");

    /** The Tamil normalizer. */
    public static string NormalizeTamil(string input)
    {
        var s = JsRegex.Replace(input, ZERO_WIDTH, _ => "");

        s = Unicode.FoldNativeDigits(s);

        s = JsRegex.Replace(s, DEGROUP, _ => "");

        s = JsRegex.Replace(s, ERA_RE, m => ERA[m.Groups[1].Value]);
        s = JsRegex.Replace(s, EGA_RE, _ => "எடுத்துக்காட்டாக");

        s = JsRegex.Replace(s, TAMIL_UNIT_DOT_RE, m =>
        {
            string a = m.Groups[1].Value, b = m.Groups[2].Value;
            return TAMIL_UNIT.GetValueOrDefault($"{a}{b}") ?? TAMIL_UNIT.GetValueOrDefault($"{a}மீ") ?? $"{a}{b}";
        });
        s = JsRegex.Replace(s, TAMIL_UNIT_SPACED_RE, m =>
        {
            string a = m.Groups[1].Value, b = m.Groups[2].Value;
            return TAMIL_UNIT.GetValueOrDefault($"{a}{b}") ?? TAMIL_UNIT.GetValueOrDefault($"{a}மீ") ?? $"{a} {b}";
        });
        s = JsRegex.Replace(s, TAMIL_UNIT_RE, m => TAMIL_UNIT[m.Groups[1].Value]);
        s = JsRegex.Replace(s, INITIALISM_RE, m => JsRegex.Replace(m.Value, DOT_RUN, _ => " ").Trim());
        s = JsRegex.Replace(s, THIRU_RE, _ => "திரு ");

        var full5 = s;
        s = JsRegex.Replace(s, RATE_ASCII, m =>
        {
            var num = RATE_NUM.GetValueOrDefault(m.Groups[2].Value.ToLowerInvariant());
            var d = RATE_DENOM.GetValueOrDefault(m.Groups[3].Value.ToLowerInvariant());
            if (num is null || d is null) return m.Value;
            return $"{Dative(d, full5, m.Index)}{m.Groups[1].Value} {num}";
        });
        var full5b = s;
        s = JsRegex.Replace(s, RATE_MPH, m => $"{Dative("மணிக்கு", full5b, m.Index)}{m.Groups[1].Value} மைல்");

        s = SYMBOLS(s);

        s = JsRegex.Replace(s, CLOCK_DOT_TZ, m =>
            Js.Number(m.Groups[2].Value) == 0 ? m.Groups[1].Value : $"{m.Groups[1].Value} {m.Groups[2].Value}");
        s = JsRegex.Replace(s, CLOCK_ZERO, m => m.Groups[1].Value);
        s = JsRegex.Replace(s, CLOCK_COLON, _ => " ");

        s = JsRegex.Replace(s, DECIMAL_RE, m =>
            $"{m.Groups[1].Value} புள்ளி {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        s = JsRegex.Replace(s, PLUSMINUS, _ => " கூட்டல் கழித்தல் ");
        s = JsRegex.Replace(s, PLUS_AFTER, m => $"{m.Groups[1].Value} பிளஸ் {m.Groups[2].Value}");
        s = JsRegex.Replace(s, PLUS_START, m => $"{m.Groups[1].Value}பிளஸ் {m.Groups[2].Value}");

        s = PostposedSignPass.PostposedSign(s, "<", "ஐ விட குறைவாக");
        s = PostposedSignPass.PostposedSign(s, ">", "ஐ விட அதிகமாக");
        s = JsRegex.Replace(s, EQUALS, _ => " சமம் ");
        s = JsRegex.Replace(s, DIVIDE, _ => " வகுத்தல் ");

        s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} டிகிரி செல்சியஸ்");
        s = JsRegex.Replace(s, DEG_F, m => $"{m.Groups[1].Value} டிகிரி பாரன்ஹீட்");
        s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value} டிகிரி");

        s = JsRegex.Replace(s, FRACTION_RE, m =>
        {
            string a = m.Groups[1].Value, b = m.Groups[2].Value;
            var lex = FRACTION_WORD.GetValueOrDefault($"{a}/{b}");
            if (lex is not null) return lex;
            var tail = Cardinal(Js.Number(b)).Split(' ');
            var den = TamilNumbersComposer.OrdinalStem(tail.Length > 0 ? tail[^1] : "");
            if (den is null || Js.Number(b) == 0) return m.Value;
            var dw = Cardinal(Js.Number(b)).Split(' ');
            dw[^1] = $"{den}ில்";
            return $"{string.Join(" ", dw)} {(Js.Number(a) == 1 ? "ஒரு" : Cardinal(Js.Number(a)))} பங்கு";
        });

        s = JsRegex.Replace(s, ORDINAL_RE, m =>
            Ordinal(Js.Number(m.Groups[1].Value), m.Groups[2].Value) ?? m.Value);

        s = JsRegex.Replace(s, LOCATIVE, m => $"{m.Groups[1].Value} இல்");

        return s;
    }
}
