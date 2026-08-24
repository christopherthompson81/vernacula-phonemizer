/**
 * Afrikaans (af) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/afrikaans/normalize.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

public static class Normalize
{

    private static AfrikaansManifest MANIFEST => Afrikaans.Manifest.MANIFEST;

    private static IReadOnlyList<string> ORD_BELOW_20 => MANIFEST.OrdinalsBelow20; // afrikaans.jsonc

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");

    /** Integer → the Afrikaans ordinal word. */
    public static string? OrdinalWord(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 1) return null;
        if (n < 20) return (int)n < ORD_BELOW_20.Count ? ORD_BELOW_20[(int)n] : null;
        var card = Numbers.NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        var r = n % 100;
        if (r >= 1 && r < 20)
        {
            var idx = (int)r;
            var tail = r < 10
                ? (idx < MANIFEST.Numbers.Units.Count ? MANIFEST.Numbers.Units[idx] : null)
                : (idx - 10 < MANIFEST.Numbers.Teens.Count ? MANIFEST.Numbers.Teens[idx - 10] : null);
            if (!string.IsNullOrEmpty(tail) && card.EndsWith(tail, StringComparison.Ordinal))
                return $"{card[..^tail.Length]}{ORD_BELOW_20[idx]}";
        }
        return $"{card}ste";
    }

    /** Multi-dot abbreviations and era markers (afrikaans.jsonc `multiDotAbbreviations`). */
    private static IReadOnlyList<IReadOnlyList<string>> MULTI_DOT => MANIFEST.MultiDotAbbreviations;

    private static IReadOnlyDictionary<string, string> DOTTED_ABBREV => MANIFEST.DottedAbbreviations; // afrikaans.jsonc

    private static readonly JsRe ESCAPE_KEY = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");

    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys
        .OrderByDescending(k => k.Length)
        .Select(k => ESCAPE_KEY.Replace(k, "\\$&")));

    private static readonly string BARE_ALT = string.Join("|", DOTTED_ABBREV.Keys
        .Where(k => k.Contains('.', StringComparison.Ordinal))
        .OrderByDescending(k => k.Length)
        .Select(k => ESCAPE_KEY.Replace(k, "\\$&")));

    private static SignWords SIGN => MANIFEST.SignWords; // afrikaans.jsonc — one word per math/sign symbol
    private static AfrikaansFractionWords FRAC => MANIFEST.FractionWords; // …and the two suppletive halves
    private static IReadOnlyDictionary<string, string> LETTER_NAME => MANIFEST.LetterNames; // the g2p spells these through itself

    /**
     * Afrikaans phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at
     * all?).
     */
    public static readonly Func<string, bool> IsUnreadableAfrikaans = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouy]", "u"),
        LegalOnsets = new HashSet<string>(MANIFEST.Phonotactics.LegalOnsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(MANIFEST.Phonotactics.LegalCodas, StringComparer.Ordinal),
    });

    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(MANIFEST.WordAcronyms, StringComparer.Ordinal); // afrikaans.jsonc

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(l.ToLowerInvariant(), out var v) ? v : null,
        AcronymLetters = new HashSet<string>(MANIFEST.AcronymLetters, StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = w => IsUnreadableAfrikaans(w),
    });

    /**
     * The initialism pass, exported so the engine can re-apply it to the symbol tier's output (whose currency
     * nouns carry caps: "VS-dollar" from U$/VS$ must read *vee-es-dollar*).
     */
    public static string NormalizeAfrikaansInitialisms(string text) => NormalizeInitialisms(text);

    private static readonly JsRe AMP = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe ARTICLE_QUOTE = JsRegex.Compile("(?<![\\p{L}\\p{M}])[‘’ʼ`´]n(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ARTICLE_NACUTE = JsRegex.Compile("(?<![\\p{L}\\p{M}])ń(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[ \u00a0]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOT_OR_SPACE = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe ORDINAL = JsRegex.Compile("(?<![\\d,.])(\\d{1,4})(?:ste[n]?|de[n]?|e)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.]?\\d)(\\s*(?:vm|nm))?", "giu");
    private static readonly JsRe CLOCK_DOT = JsRegex.Compile(
        "(?<![\\d.,:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?![\\d.,:-])(?=\\s*(?:GUT|UTC|SAST|GMT|vm|nm))(\\s*(?:vm|nm))?", "giu");
    private static readonly JsRe CLOCK_MILITARY = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3])([0-5]\\d)(?=\\s*(?:UTC|GUT))", "gu");
    private static readonly JsRe CLOCK_BARE_VM = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3])(vm)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe GROUPED = JsRegex.Compile("(\\d),(\\d{3})(?!\\d)", "gu");
    private static readonly JsRe COMMA_DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,.])", "gu");
    private static readonly JsRe VERSION_DOT = JsRegex.Compile("(?<![\\d.,])(\\d{3,})\\.(\\d+)(?=[a-z](?![a-z]))", "giu");
    private static readonly JsRe FIGURE_DOT = JsRegex.Compile("Figuur (\\d+)\\.(\\d+)", "giu");
    private static readonly JsRe MBIT = JsRegex.Compile("(\\d+)\\s*Mbit\\/s(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe REGNAL = JsRegex.Compile("W[êe]reld ?[Oo]orlog (\\d+|I{1,3}V?|IV)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ALL_DIGITS = JsRegex.Compile("^\\d+$", "u");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{Nd}])-(\\d+)(?!\\s*[-\\d])", "gu");
    private static readonly JsRe AMP_LETTERS = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})&(\\p{Lu})(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMP_SPACED = JsRegex.Compile("\\s&\\s", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\S)\\s*=\\s*(\\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(\\d)", "gu");
    private static readonly JsRe DIVIDED_BY = JsRegex.Compile("(\\d)\\s*÷\\s*(\\d)", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");

    // The dotted-abbreviation alternations are built from manifest keys, so they are compiled once here
    // rather than per call — `new RegExp` inside the TS pass is a per-call construction the port need not
    // repeat.
    private static readonly JsRe ABBREV_MID = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\d])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe ABBREV_BARE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({BARE_ALT})(?=\\s*(?:[\\p{{L}}\\d(]|[,.;:!?»)]|$))", "giu");

    private static readonly List<(JsRe End, JsRe Any, string Word)> MULTI_DOT_RES = MULTI_DOT
        .Select(pair => (
            JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){pair[0]}\\.(?=\\s*$)", "giu"),
            JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){pair[0]}", "giu"),
            pair[1]))
        .ToList();

    /**
     * Normalize one Afrikaans input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its
     * coupling.
     */
    public static string NormalizeAfrikaans(string input)
    {
        var s = input;

        s = AMP.Replace(s, " & ");

        s = ARTICLE_QUOTE.Replace(s, "'n");
        s = ARTICLE_NACUTE.Replace(s, "'n");

        foreach (var (end, any, word) in MULTI_DOT_RES)
        {
            s = end.Replace(s, $"{word}.");
            s = any.Replace(s, word);
        }

        s = DOTTED_CAPS.Replace(s, m => DOT_OR_SPACE.Replace(m.Value, ""));

        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");
        s = ABBREV_BARE.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}");

        s = ORDINAL.Replace(s, m => OrdinalWord(Js.Number(m.Groups[1].Value)) ?? m.Value);

        static string Clock(string h, string min, string period) =>
            $"{Numbers.NumberToWords(Js.Number(h))}" +
            (Js.Number(min) == 0 ? "" : $" {Numbers.NumberToWords(Js.Number(min))}") + period;
        static string Period(string? p) =>
            p is null ? "" : $" {(MANIFEST.ClockPeriods.TryGetValue(p.Trim().ToLowerInvariant(), out var v) ? v : p.Trim())}";
        // The trailing guard rejects a further `:` or `.` FOLLOWED BY A DIGIT — a sports time, not a clock.
        // A plain `.` may NOT be rejected outright: a clock at a sentence end is followed by one.
        s = CLOCK_COLON.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value,
            Period(m.Groups[3].Success ? m.Groups[3].Value : null)));
        s = CLOCK_DOT.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value,
            Period(m.Groups[3].Success ? m.Groups[3].Value : null)));
        s = CLOCK_MILITARY.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value, ""));
        s = CLOCK_BARE_VM.Replace(s, m =>
            $"{Numbers.NumberToWords(Js.Number(m.Groups[1].Value))} {MANIFEST.ClockPeriods["vm"]}");

        for (var i = 0; i < 2; i++) s = GROUPED.Replace(s, "$1$2");

        s = COMMA_DECIMAL.Replace(s, "$1.$2");

        s = VERSION_DOT.Replace(s, "$1 punt $2");
        s = FIGURE_DOT.Replace(s, "Figuur $1 punt $2");

        s = MBIT.Replace(s, "$1 megabit per sekonde");

        s = REGNAL.Replace(s, m =>
        {
            var d = m.Groups[1].Value;
            var roman = new Dictionary<string, double> { ["I"] = 1, ["II"] = 2, ["III"] = 3, ["IV"] = 4 };
            double? n = ALL_DIGITS.IsMatch(d) ? Js.Number(d) : roman.TryGetValue(d, out var rv) ? rv : null;
            var ord = n is null ? null : OrdinalWord(n.Value);
            return ord is null ? m.Value : $"{ord} Wêreldoorlog";
        });

        s = DEG_C.Replace(s, "$1 grade Celsius");
        s = DEG_F.Replace(s, "$1 grade Fahrenheit");
        s = DEG.Replace(s, "$1 grade");

        s = PLUS_MINUS.Replace(s, $" {SIGN.PlusMinus} ");
        s = PLUS.Replace(s, $" {SIGN.Plus} ");
        s = MINUS.Replace(s, $"{SIGN.Minus} $1");
        s = AMP_LETTERS.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            var an = LETTER_NAME.TryGetValue(a.ToLowerInvariant(), out var av) ? av : a;
            var bn = LETTER_NAME.TryGetValue(b.ToLowerInvariant(), out var bv) ? bv : b;
            return $"{an} {SIGN.Ampersand} {bn}";
        });
        s = AMP_SPACED.Replace(s, $" {SIGN.Ampersand} ");
        s = EQUALS.Replace(s, $"$1 {SIGN.Equals} $2");
        s = LESS_THAN.Replace(s, $"$1 {SIGN.LessThan} $2");
        s = GREATER_THAN.Replace(s, $"$1 {SIGN.GreaterThan} $2");
        s = TIMES.Replace(s, $"$1 {SIGN.Times} $2");
        s = DIVIDED_BY.Replace(s, $"$1 {SIGN.DividedBy} $2");

        s = FRACTION.Replace(s, m =>
        {
            double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
            if (den == 2) return num == 1 ? FRAC.OneHalf : $"{Numbers.NumberToWords(num)} {FRAC.Halves}";
            var ord = OrdinalWord(den);
            return ord is null ? m.Value : $"{Numbers.NumberToWords(num)} {ord}";
        });

        s = NormalizeInitialisms(s);

        return s;
    }
}
