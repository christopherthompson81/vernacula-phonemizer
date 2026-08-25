/**
 * Indonesian (id) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the pipeline speaks. Indonesian writes BOTH the thousands grouping and the
 * clock with a period (`9.000`, `11.00`); only the DIGIT COUNT after the dot separates them.
 * Ported from src/languages/indonesian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Indonesian;

public static class Normalize
{
    /** Dotted abbreviations → the spoken words. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dr"] = "dokter", ["prof"] = "profesor", ["ir"] = "insinyur", ["hj"] = "hajjah",
        ["dll"] = "dan lain lain", ["dsb"] = "dan sebagainya", ["dkk"] = "dan kawan kawan", ["tsb"] = "tersebut",
        ["no"] = "nomor", ["hlm"] = "halaman", ["jl"] = "jalan", ["yg"] = "yang", ["tgl"] = "tanggal", ["pt"] = "perseroan terbatas",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Unit abbreviations the shared tier cannot express, plus the slash unit. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km/jam"] = "kilometer per jam", ["m/detik"] = "meter per detik", ["km/j"] = "kilometer per jam",
    };
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length));

    /**
     * Compass points for the COORDINATE sense of `°` (`35°W`), keyed lowercase because the rule matches
     * case-insensitively.
     */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["n"] = "utara", ["s"] = "selatan", ["e"] = "timur", ["w"] = "barat",
    };

    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d.:])([01]?\\d|2[0-3])[.:]([0-5]\\d)\\b(?!\\.?\\d)", "gu");
    private static readonly JsRe DOLLAR_CODE = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:US|AUD)\\$(?=[ \u00a0]?\\d)", "gu");
    private static readonly JsRe RUPIAH = JsRegex.Compile("\\bRp\\.?\\s?(\\d[\\d.,]*)", "gu");
    private static readonly JsRe NOMOR = JsRegex.Compile("\\bno\\.\\s?(?=\\d)", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?)]|$))", "giu");
    private static readonly JsRe SLASH_UNIT = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}])", "gu");
    // ⚠ `(?![\\p{L}\\p{M}])`, NOT `\\b`. JS defines `\\b` on ASCII `\\w`, so a following NON-ASCII letter
    // counted as a boundary and this fired when it must not — `25°Cölner` ate the ⟨C⟩ as Celsius. See
    // src/languages/*/normalize.ts, which carries the finding.
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_COORD = JsRegex.Compile("(\\d)\\s?°\\s?([NSEW])(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})\\/(\\d{1,3})\\b(?!\\s*[/\\d])", "gu");

    /**
     * Every rule here emits DIGITS where a number is involved and lets the engine's own number path speak them,
     * which keeps this layer free of the number words entirely.
     */
    public static string NormalizeIndonesian(string input)
    {
        var s = input;

        // The clock runs FIRST, before anything can treat the dot as grouping. Both lookarounds are needed:
        // the trailing one keeps a race time (`2:11.60`) out, the leading one stops the scan restarting inside
        // one and claiming `09.02` out of `1:09.02`.
        s = CLOCK.Replace(s, m =>
        {
            var h = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            return mv == 0 ? $"{Js.NumberToString(h)}" : $"{Js.NumberToString(h)} lewat {Js.NumberToString(mv)}";
        });

        s = DOLLAR_CODE.Replace(s, "$");

        s = RUPIAH.Replace(s, "$1 rupiah");

        s = NOMOR.Replace(s, "nomor ");

        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        // Slash units, before the shared symbol tier claims the bare `km`.
        s = SLASH_UNIT.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

        // The three named senses of `°` before the bare arm, or the bare arm strands the scale/compass letter.
        s = DEG_C.Replace(s, "$1 derajat Celsius");
        s = DEG_F.Replace(s, "$1 derajat Fahrenheit");
        s = DEG_COORD.Replace(s, m => $"{m.Groups[1].Value} derajat {COMPASS[m.Groups[2].Value.ToLowerInvariant()]}");
        s = DEG.Replace(s, "$1 derajat");

        s = MINUS.Replace(s, "$1minus $2");
        // ± is a SINGLE character (U+00B1), not a `+`, so no `+` rule can ever match inside it.
        s = PLUS_MINUS.Replace(s, " plus minus ");
        s = PLUS_ATTACHED.Replace(s, "$1 plus $2");
        s = PLUS_LEADING.Replace(s, "$1plus $2");

        s = EQUALS_RE.Replace(s, " sama dengan ");
        s = LESS_THAN.Replace(s, " lebih kecil dari ");
        s = GREATER_THAN.Replace(s, " lebih besar dari ");
        s = DIVIDE.Replace(s, " dibagi ");

        s = FRACTION.Replace(s, m =>
            Js.Number(m.Groups[1].Value) == 1 && Js.Number(m.Groups[2].Value) == 2
                ? "setengah"
                : $"{m.Groups[1].Value} per {m.Groups[2].Value}");

        return s;
    }
}
