/**
 * Indonesian (id) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the pipeline speaks. Indonesian writes BOTH the thousands grouping and the
 * clock with a period (`9.000`, `11.00`); only the DIGIT COUNT after the dot separates them.
 * Ported from src/languages/indonesian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

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
        s = Rewrite(s, CLOCK, m =>
        {
            var h = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            return mv == 0 ? $"{Js.NumberToString(h)}" : $"{Js.NumberToString(h)} lewat {Js.NumberToString(mv)}";
        });

        s = Rewrite(s, DOLLAR_CODE, "$");

        s = Rewrite(s, RUPIAH, "$1 rupiah");

        s = Rewrite(s, NOMOR, "nomor ");

        s = Rewrite(s, ABBREV_MID, m =>
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122). The pattern is built from this table's OWN keys but
            // carries `i`+`u`, so JS's fold widens it — `ſ`→`s`, and the Cyrillic `ᲀᲃᲅ` forms onto theirs —
            // and a near-miss MATCHES while its key is absent. The TS asserted non-null and spoke the word
            // "undefined"; this indexer THREW. Refuse the whole match.
            DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}{m.Groups[2].Value}" : m.Value);
        s = Rewrite(s, ABBREV_END, m =>
            DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}." : m.Value);

        // Slash units, before the shared symbol tier claims the bare `km`.
        s = Rewrite(s, SLASH_UNIT, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

        // The three named senses of `°` before the bare arm, or the bare arm strands the scale/compass letter.
        s = Rewrite(s, DEG_C, "$1 derajat Celsius");
        s = Rewrite(s, DEG_F, "$1 derajat Fahrenheit");
        s = Rewrite(s, DEG_COORD, m =>
            // ⚠ REFUSE THE WHOLE MATCH ON AN UNKNOWN DIRECTION (#1122). The pattern carries `i` AND `u`, so
            // JS folds U+017F LONG S onto `s` and `12°ſ` MATCHES `[NSEW]` — while `ſ` is no COMPASS key. The
            // TS asserted non-null and spoke the word "undefined"; the C# indexer THREW.
            COMPASS.TryGetValue(m.Groups[2].Value.ToLowerInvariant(), out var dir)
                ? $"{m.Groups[1].Value} derajat {dir}"
                : m.Value);
        s = Rewrite(s, DEG, "$1 derajat");

        s = Rewrite(s, MINUS, "$1minus $2");
        // ± is a SINGLE character (U+00B1), not a `+`, so no `+` rule can ever match inside it.
        s = Rewrite(s, PLUS_MINUS, " plus minus ");
        s = Rewrite(s, PLUS_ATTACHED, "$1 plus $2");
        s = Rewrite(s, PLUS_LEADING, "$1plus $2");

        s = Rewrite(s, EQUALS_RE, " sama dengan ");
        s = Rewrite(s, LESS_THAN, " lebih kecil dari ");
        s = Rewrite(s, GREATER_THAN, " lebih besar dari ");
        s = Rewrite(s, DIVIDE, " dibagi ");

        s = Rewrite(s, FRACTION, m =>
            Js.Number(m.Groups[1].Value) == 1 && Js.Number(m.Groups[2].Value) == 2
                ? "setengah"
                : $"{m.Groups[1].Value} per {m.Groups[2].Value}");

        return s;
    }
}
