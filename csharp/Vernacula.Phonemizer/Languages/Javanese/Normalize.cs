/**
 * Javanese (jv) text normalization — the pre-tokenizer pass that rewrites what is not yet a pronounceable
 * word into words the Latin/Aksara → IPA pipeline already speaks. The steps are ORDER-DEPENDENT: a DOT is
 * a thousands separator, a decimal point and a clock separator depending on context.
 * Ported from src/languages/javanese/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Javanese;

public static class Normalize
{
    /** Not-a-letter, on both sides. `\b` cannot be used — see the header. */
    private const string L = "[\\p{L}\\p{M}]";

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "lan",
        Percent = new[] { "persèn" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilomèter" }, ["kg"] = new[] { "kilogram" }, ["cm"] = new[] { "sèntimèter" }, ["g"] = new[] { "gram" }, ["m"] = new[] { "mèter" }, ["mm"] = new[] { "milimèter" }, ["mg"] = new[] { "miligram" }, ["l"] = new[] { "liter" }, ["L"] = new[] { "liter" }, ["ha"] = new[] { "hèktar" },
        },
        Multiply = new MultiplyDef { Times = "kaping" },
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["jam"] = "jam", ["detik"] = "detik", ["s"] = "detik", ["taun"] = "taun" },
        UnitPer = "per",
        ExponentWords = new ExponentWordsDef { Squared = new[] { "persegi" }, Cubed = new[] { "kubik" }, Position = ExponentPosition.After },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["AS$"] = new[] { "dolar AS" }, ["US$"] = new[] { "dolar AS" }, ["$"] = new[] { "dolar" }, ["Rp"] = new[] { "rupiah" },
        },
        Magnitudes = new[] { "èwu", "ewu", "yuta", "juta", "milyar", "triliun" },

    });

    /**
     * Javanese phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?).
     */
    public static readonly Func<string, bool> IsUnreadableJavanese = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{JavanesePhonemizer.DEF.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(JavanesePhonemizer.DEF.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(JavanesePhonemizer.DEF.Phonotactics.Codas, StringComparer.Ordinal),
    });

    /**
     * LEXICAL, not derivable from spelling: acronyms READ AS LETTERS although their lowercase form is a
     * perfectly readable Javanese-looking word, so the OOV test alone would leave them.
     */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(new[] { "as", "us", "sa", "ri", "lu", "pc", "kb", "md", "pip" }, StringComparer.Ordinal);

    /** …and the converse: readable runs that ARE words and must not be spelled even if listed elsewhere. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(new[] { "wib", "wita", "wit", "unesco", "nasa", "asean" }, StringComparer.Ordinal);

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => JavanesePhonemizer.DEF.LetterNames.GetValueOrDefault(l.ToLowerInvariant()),
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = IsUnreadableJavanese,
    });

    // The step patterns. The TS builds several of these inline; JsRegex.Compile caches, so hoisting them
    // here is a readability choice and not a behaviour one.
    private static readonly JsRe CLOCK_RANGE = JsRegex.Compile("(\\d{1,2})\\.00\\s*([-–])\\s*(\\d{1,2})\\.00(?!\\d)", "gu");
    private static readonly JsRe CLOCK_HOUR = JsRegex.Compile("(?<=jam\\s)(\\d{1,2})\\.00(?!\\d)", "gu");
    private static readonly JsRe RP_DOT = JsRegex.Compile("(?<![\\p{L}\\p{M}])Rp\\.(?=\\s*\\d)", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile("(?<![\\d.,])\\d{1,3}(?:\\.\\d{3})+(?![\\d.])", "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<![\\d.,])\\d{1,3}(?:,\\d{3})+(?![\\d,])", "gu");
    private static readonly JsRe DOT_G = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?![\\d,])(?!\\.\\d)", "gu");
    private static readonly JsRe JAM_BEFORE = JsRegex.Compile("(?<![\\p{L}\\p{M}])jam\\s*$", "u");
    private static readonly JsRe HALF = JsRegex.Compile($"(?<!{L}|[\\d/])1/2(?!{L}|[\\d/])", "gu");
    private static readonly JsRe THIRD = JsRegex.Compile($"(?<!{L}|[\\d/])1/3(?!{L}|[\\d/])", "gu");
    private static readonly JsRe QUARTER = JsRegex.Compile($"(?<!{L}|[\\d/])1/4(?!{L}|[\\d/])", "gu");
    private static readonly JsRe PCT_RANGE = JsRegex.Compile("(\\d+)\\s*%\\s*[-–]\\s*(?=\\d)", "gu");
    private static readonly JsRe COORD_RANGE = JsRegex.Compile("(['’\"”′″°])\\s*[-–]\\s*(?=\\d)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d+)\\s*°\\s*C(?![\\p{L}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+)\\s*°\\s*", "gu");
    private static readonly JsRe APPROX = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:±|\\+\\/-)\\s*(?=\\d)", "gu");
    private static readonly JsRe DENSITY = JsRegex.Compile("(\\d[\\d.,]*)\\s*jiwa\\s*\\/\\s*km\\s*(?:²|2)(?![\\p{L}\\d])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\d.,/-])(\\d+)\\s*[-–]\\s*(\\d+)(?![\\d,/-]|\\.\\d)(?!\\s*doi)", "giu");
    private static readonly JsRe DOI_BEFORE = JsRegex.Compile("doi:?\\s*\\S*$", "iu");

    /** Normalize one Javanese string. */
    public static string NormalizeJavanese(string input)
    {

        var s = input;

        // 1. The clock, FIRST — before every dot rule, since a clock's dot is neither a grouper nor a decimal
        // and only the context says so. Only whole hours (`.00`) are claimed.
        s = JsRegex.Replace(s, CLOCK_RANGE, m =>
            $"{Js.NumberToString(Js.Number(m.Groups[1].Value))} nganti {Js.NumberToString(Js.Number(m.Groups[3].Value))}");
        s = JsRegex.Replace(s, CLOCK_HOUR, m => Js.NumberToString(Js.Number(m.Groups[1].Value)));

        s = JsRegex.Replace(s, RP_DOT, _ => "Rp");

        // 2. De-group thousands — AFTER the clock, BEFORE every decimal rule. Both separators group in this
        // language. Exactly-3-digit groups are what keeps this off clocks, decimals and DOIs; the dot arm
        // must allow a following comma (`1.485,36`) and the comma arm a following dot (`32,548.20`).
        s = JsRegex.Replace(s, GROUP_DOT, m => JsRegex.Replace(m.Value, DOT_G, _ => ""));
        s = JsRegex.Replace(s, GROUP_COMMA, m => JsRegex.Replace(m.Value, COMMA_G, _ => ""));

        // 3. Decimals, AFTER de-grouping, so only the fractional tail is left. The fraction is read digit by
        // digit. `.00` and a `jam` context are excluded outright — those are the clock shapes step 1 leaves.
        string Decimal(string i, string f) => $"{i} koma {string.Join(" ", Js.CodePoints(f))}";
        s = JsRegex.Replace(s, DECIMAL_COMMA, m => Decimal(m.Groups[1].Value, m.Groups[2].Value));
        var full3 = s;
        s = JsRegex.Replace(s, DECIMAL_DOT, m =>
            m.Groups[2].Value == "00" || JAM_BEFORE.IsMatch(full3[..m.Index])
                ? m.Value
                : Decimal(m.Groups[1].Value, m.Groups[2].Value));

        // 4. The three fractions, BY LITERAL rather than by pattern: a general `a/b` rule would claim DOIs
        // and year pairs. The vulgar characters arrive already folded to `1/2` etc.
        s = JsRegex.Replace(s, HALF, _ => "setengah");
        s = JsRegex.Replace(s, THIRD, _ => "sapratelon");
        s = JsRegex.Replace(s, QUARTER, _ => "saprapat");

        // 4b. Ranges whose endpoints are not bare digits, BEFORE the symbol tier and the degree rules — both
        // destroy the digit-dash-digit adjacency step 7 needs. The percent sign is captured and put back.
        s = JsRegex.Replace(s, PCT_RANGE, m => $"{m.Groups[1].Value}% nganti ");
        s = JsRegex.Replace(s, COORD_RANGE, m => $"{m.Groups[1].Value} nganti ");

        // 5. °C BEFORE the bare ° — otherwise the bare rule eats the sign and strands a lone ⟨C⟩.
        s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} drajat celsius");
        // The trailing space is load-bearing: a coordinate glues its compass letters onto the sign (`6°LU`).
        s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value} drajat ");

        s = JsRegex.Replace(s, APPROX, _ => "kurang luwih ");

        s = JsRegex.Replace(s, DENSITY, m => $"{m.Groups[1].Value} jiwa per kilomèter persegi");

        // 6. The shared symbol tier — AFTER de-grouping (it needs the number contiguous), AFTER the decimal
        // rule (a still-comma'd decimal presents two numbers to it), and AFTER the degree rules (its `units`
        // alternation would otherwise compete with the scale letter for the same `C`).
        s = SYMBOLS(s);

        // 7. Ranges, LAST of the number rules: every earlier step has already consumed the dashes it owns, so
        // what reaches here is a bare numeric range. Both `doi` guards are needed — one for a citation that
        // FOLLOWS the range, one for the identifier the range sits INSIDE.
        var full7 = s;
        s = JsRegex.Replace(s, RANGE, m =>
            DOI_BEFORE.IsMatch(full7[Math.Max(0, m.Index - 40)..m.Index])
                ? m.Value
                : $"{m.Groups[1].Value} nganti {m.Groups[2].Value}");

        s = NormalizeInitialisms(s);

        return s;
    }
}
