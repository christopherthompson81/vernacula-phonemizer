/**
 * Telugu (te) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/telugu/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Telugu;

public static class Normalize
{
    /** Telugu letter+mark boundary. Never `\b`. */
    private const string NB = "(?<![\\p{L}\\p{M}])";
    private const string NA = "(?![\\p{L}\\p{M}])";

    /** Telugu letters and marks, EXCLUDING the digit block ౦-౯ (U+0C66-0C6F) — used by the ౦ fold. */
    private const string TE_LETTER = "\\u0C00-\\u0C65\\u0C70-\\u0C7F";

    /** The SHARED symbol tier (percent / currency / units / exponent). */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "మరియు",
        Multiply = new MultiplyDef { Times = "గుణించి" },
        Percent = new[] { "శాతం" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "డాలరు", "డాలర్లు" }, ["$"] = new[] { "డాలరు", "డాలర్లు" },
        },
        Magnitudes = new[] { "మిలియన్", "బిలియన్", "ట్రిలియన్", "లక్ష", "కోటి" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "కిలోమీటరు", "కిలోమీటర్లు" },
            ["cm"] = new[] { "సెంటీమీటరు", "సెంటీమీటర్లు" },
            ["mm"] = new[] { "మిల్లీమీటరు", "మిల్లీమీటర్లు" },
            ["kg"] = new[] { "కిలోగ్రాము", "కిలోగ్రాములు" },
            ["mi"] = new[] { "మైలు", "మైళ్లు" },
            ["m"] = new[] { "మీటరు", "మీటర్లు" },
            ["miles"] = new[] { "మైలు", "మైళ్లు" },
            ["inches"] = new[] { "అంగుళం", "అంగుళాలు" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "చదరపు" },
            Cubed = new[] { "క్యూబిక్" },
            Position = ExponentPosition.Before,
        },
    });

    /** Telugu unit abbreviations, dotted and undotted. */
    private static readonly JsRe KM_RE = JsRegex.Compile($"{NB}కి\\s*\\.\\s*మీ\\.?{NA}|{NB}కిమీ{NA}", "gu");
    /** మై for మైళ్ళు, ×2, only ever after a digit — the digit guard is what keeps it off the many real words
     *  beginning మై (మైదానం, మైనస్…). */
    private static readonly JsRe MI_RE = JsRegex.Compile($"(?<=\\d\\s?)మై{NA}", "gu");

    /** Era markers. Both are written without a trailing dot in this corpus (క్రీ.శ 1000, క్రీ.పూ 5000). */
    private static readonly IReadOnlyDictionary<string, string> ERA = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["శ"] = "క్రీస్తు శకం",
        ["పూ"] = "క్రీస్తు పూర్వం",
    };
    private static readonly JsRe ERA_RE = JsRegex.Compile($"{NB}క్రీ\\s*\\.\\s*(శ|పూ)\\.?{NA}", "gu");

    private static readonly string LETTER =
        "(?:" + string.Join("|", Manifest.MANIFEST.InitialismLetterForms.OrderByDescending(a => a.Length)) + ")";
    /** A run of ≥2 dot-separated letter names. The run's TRAILING dot is consumed only when the sentence
     *  visibly continues, so a true sentence-final pause is never lost. */
    private static readonly JsRe INITIALISM_RE = JsRegex.Compile(
        $"{NB}{LETTER}(?:\\s*\\.\\s*{LETTER})+(?:\\s*\\.(?=\\s*[\\p{{L}}]))?{NA}", "gu");

    /** ASCII rate numerators/denominators. Telugu puts the denominator FIRST, in the dative. */
    private static readonly IReadOnlyDictionary<string, string> RATE_NUM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "కిలోమీటర్లు", ["m"] = "మీటర్లు", ["mi"] = "మైళ్లు", ["ft"] = "అడుగులు",
    };
    private static readonly IReadOnlyDictionary<string, string> RATE_DENOM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["h"] = "గంటకు", ["s"] = "సెకనుకు",
    };

    /** The rate prefix, UNLESS the text already carries it. */
    private static string Dative(string word, string full, int offset) =>
        JsRegex.Compile($"{word}\\s*$", "u").IsMatch(full[..offset]) ? "" : $"{word} ";

    // The step patterns. The TS builds several of these inline; JsRegex.Compile caches, so hoisting them
    // here is a readability choice and not a behaviour one.
    /** ⚠ WRITTEN AS ESCAPES, NOT LITERALS. The TS source spells this class with the four zero-width
     *  characters themselves; same class, stated by code point: U+200B…U+200D and U+FEFF. */
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200b-\\u200d\\ufeff]", "gu");
    private static readonly JsRe SUNNA_HOMOGLYPH = JsRegex.Compile("(?<![౦-౯])౦(?![౦-౯])", "gu");
    private static readonly JsRe TE_NEAR = JsRegex.Compile($"[{TE_LETTER}]", "u");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s*-?\\s*వ(ది)?{NA}", "gu");
    private static readonly JsRe YEAR_RE = JsRegex.Compile("(?<![\\d.,])(1[1-9]\\d{2})(?![\\d]|\\.\\d)", "gu");
    private static readonly JsRe DEGROUP = JsRegex.Compile("(?<=\\d),(?=\\d{3}(?:,\\d|[^\\d]|$))", "gu");
    private static readonly JsRe UDA_RE = JsRegex.Compile($"{NB}ఉదా\\s*\\.\\s*(?=[\\p{{L}}])", "gu");
    private static readonly JsRe DOT_RUN = JsRegex.Compile("\\s*\\.\\s*", "gu");
    private static readonly JsRe RATE_ASCII = JsRegex.Compile("(?<![\\p{L}\\d])(\\d[\\d.]*)\\s?(km|mi|ft|m)\\s?\\/\\s?(h|s)(?![A-Za-z])", "giu");
    private static readonly JsRe RATE_TE = JsRegex.Compile($"(\\d[\\d.]*)\\s?కిలోమీటర్లు\\s*\\/\\s*గం\\.?{NA}", "gu");
    private static readonly JsRe HALF = JsRegex.Compile("(?<=\\d)\\s?½", "gu");
    private static readonly JsRe THREE_QUARTERS = JsRegex.Compile("(?<=\\d)\\s?¾", "gu");
    private static readonly JsRe CLOCK_ZERO = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):\\s?00(?![\\d:.])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<=\\d):\\s?(?=\\d)", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_AT_END = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");

    /** The Telugu normalizer. */
    public static string NormalizeTelugu(string input)
    {
        var s = JsRegex.Replace(input, ZERO_WIDTH, _ => "");

        // ⚠ `full[off - 1]` / `full[off + 1]` READ SINGLE UTF-16 UNITS in the TS, not code points, and the
        //    neighbours here are BMP Telugu so the two coincide. Mirrored rather than corrected.
        var full2 = s;
        s = JsRegex.Replace(s, SUNNA_HOMOGLYPH, m =>
        {
            var off = m.Index;
            var prev = off - 1 >= 0 ? full2[off - 1].ToString() : null;
            var next = off + 1 < full2.Length ? full2[off + 1].ToString() : null;
            return (prev is not null && TE_NEAR.IsMatch(prev)) || (next is not null && TE_NEAR.IsMatch(next))
                ? "ం"
                : m.Value;
        });

        s = Unicode.FoldNativeDigits(s);

        s = JsRegex.Replace(s, ORDINAL_RE, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n == 0) return m.Value;
            var w = TeluguNumbersComposer.OrdinalToWords(n, !m.Groups[2].Success ? "వ" : "వది");
            return w == "" ? m.Value : w;
        });

        s = JsRegex.Replace(s, YEAR_RE, m => TeluguNumbersComposer.YearToWords(Js.Number(m.Groups[1].Value)));

        s = JsRegex.Replace(s, DEGROUP, _ => "");

        s = JsRegex.Replace(s, ERA_RE, m => ERA[m.Groups[1].Value]);
        s = JsRegex.Replace(s, UDA_RE, _ => "ఉదాహరణకు ");

        s = JsRegex.Replace(s, KM_RE, _ => "కిలోమీటర్లు");
        s = JsRegex.Replace(s, MI_RE, _ => "మైళ్లు");
        s = JsRegex.Replace(s, INITIALISM_RE, m => JsRegex.Replace(m.Value, DOT_RUN, _ => " ").Trim());

        var full8 = s;
        s = JsRegex.Replace(s, RATE_ASCII, m =>
        {
            var num = RATE_NUM.GetValueOrDefault(m.Groups[2].Value.ToLowerInvariant());
            var d = RATE_DENOM.GetValueOrDefault(m.Groups[3].Value.ToLowerInvariant());
            if (num is null || d is null) return m.Value;
            return $"{Dative(d, full8, m.Index)}{m.Groups[1].Value} {num}";
        });
        var full8b = s;
        s = JsRegex.Replace(s, RATE_TE, m =>
            $"{Dative("గంటకు", full8b, m.Index)}{m.Groups[1].Value} కిలోమీటర్లు");

        s = JsRegex.Replace(s, HALF, _ => ".5");
        s = JsRegex.Replace(s, THREE_QUARTERS, _ => ".75");

        s = SYMBOLS(s);

        s = JsRegex.Replace(s, CLOCK_ZERO, m => m.Groups[1].Value);
        s = JsRegex.Replace(s, CLOCK_COLON, _ => " ");

        s = JsRegex.Replace(s, DECIMAL_RE, m =>
            $"{m.Groups[1].Value} పాయింట్ {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        s = JsRegex.Replace(s, PLUSMINUS, _ => " ప్లస్ మైనస్ ");
        var full12 = s;
        s = JsRegex.Replace(s, MINUS, m =>
            DIGIT_AT_END.IsMatch(full12[..m.Index]) ? m.Value : "మైనస్ ");
        s = JsRegex.Replace(s, PLUS_AFTER, m => $"{m.Groups[1].Value} ప్లస్ ");
        s = JsRegex.Replace(s, PLUS_START, m => $"{m.Groups[1].Value}ప్లస్ ");

        s = PostposedSignPass.PostposedSign(s, "<", "కంటే తక్కువ");
        s = PostposedSignPass.PostposedSign(s, ">", "కంటే ఎక్కువ");
        s = JsRegex.Replace(s, EQUALS, _ => " సమానం ");
        s = JsRegex.Replace(s, DIVIDE, _ => " భాగించడం ");

        s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} డిగ్రీల సెల్సియస్");
        s = JsRegex.Replace(s, DEG_F, m => $"{m.Groups[1].Value} డిగ్రీల ఫారెన్‌హీట్");
        s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value} డిగ్రీలు");

        return s;
    }
}
