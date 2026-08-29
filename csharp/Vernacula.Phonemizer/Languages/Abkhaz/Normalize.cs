/**
 * Abkhaz (ab) TEXT NORMALIZATION — pure text→text, run inside the engine's Text() before tokenization.
 * Rewrites what is not already a pronounceable word into words the existing g2p speaks.
 *
 * ⚠ EVERY RULE HERE IS CORPUS-EVIDENCED; the words live in the manifest's `symbols` / `numbers` blocks.
 * ORDER IS LOAD-BEARING; each step states its coupling.
 *
 * ⚠ THE SHARED SYMBOL TIER CARRIES percent and currency (with the magnitude hop), and this file uses it
 * rather than hand-rolling them — the tier's guards are the accumulated defect list of the fleet. The
 * magnitudes are the SPELLED words — step 3c expands млрд/млн before this runs, so the tier's
 * number→magnitude→currency order lands exactly the attested "8 миллиард доллар" frame.
 *
 * Ported from src/languages/abkhaz/normalize.ts — see that file for the corpus evidence and the
 * per-step coupling notes.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Abkhaz;

public static class Normalize
{
    private static readonly JsRe ESC_RE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    /** The TS `ESC` — regex-escape a literal key before splicing it into a pattern. */
    private static string Esc(string t) => JsRegex.Replace(t, ESC_RE, "\\$&");

    private static readonly string HOUR = Manifest.MANIFEST.Symbols.Hour;
    private static readonly string RANGE_FROM = Manifest.MANIFEST.Numbers.RangeFrom;

    /** The SHARED symbol tier — percent, currency (with the magnitude hop), units, км². */
    private static readonly Func<string, string> SYMBOLIZE = BuildSymbolize();

    private static Func<string, string> BuildSymbolize()
    {
        var m = Manifest.MANIFEST;
        var currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        foreach (var pair in m.Symbols.Currencies) currency[pair[0]] = new[] { pair[1] };
        var units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        foreach (var pair in m.Symbols.Units) units[pair[0]] = new[] { pair[1] };
        return NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
        {
            Percent = new[] { m.Symbols.Percent },
            Currency = currency,
            Magnitudes = new[] { m.Numbers.Milliard, m.Numbers.Million },
            Units = units,
            ExponentWords = new ExponentWordsDef
            {
                Squared = new[] { m.Symbols.Squared },
                Position = "after",
            },
        });
    }

    /**
     * The clock word's "already said" lookback — LEFT-BOUNDED: the и- prefix is productive in Abkhaz (the
     * manifest's own ⟨Цельси иградус⟩), so a word merely ENDING in асааҭ must not suppress the frame word.
     */
    private static readonly JsRe HOUR_SAID = JsRegex.Compile("(?<![\\p{L}])" + Esc(HOUR) + "\\s*$", "u");
    private static bool SaidHour(string whole, int off)
    {
        var from = Math.Max(0, off - HOUR.Length - 4);
        return HOUR_SAID.IsMatch(whole.Substring(from, off - from));
    }

    /** One H:MM(:SS) as spoken digits, or null for a shape no wall clock shows (25:99 stays text).
     *  ⚠ ONLY TRAILING zero components are dropped (the first version dropped them anywhere). */
    private static string? ClockParts(string h, string mm, string? ss)
    {
        if (Js.Number(h) >= 24 || Js.Number(mm) >= 60 || (ss != null && Js.Number(ss) >= 60)) return null;
        var parts = new List<string> { h, Js.NumberToString(Js.Number(mm)) };
        if (ss != null) parts.Add(Js.NumberToString(Js.Number(ss)));
        while (parts.Count > 1 && parts[^1] == "0") parts.RemoveAt(parts.Count - 1);
        return string.Join(" ", parts);
    }

    /**
     * ⚠ THE ORDINAL IS а + CARDINAL + тәи, and 1 IS SUPPLETIVE (акы → актәи, never *акытәи). A MULTI-WORD
     * NUMBER TAKES THE PREFIX ON THE FIRST WORD AND THE SUFFIX ON THE LAST.
     */
    private static string? OrdinalWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n < 1) return null;
        var words = Numbers.NumberToWords(n).Split(' ').ToList();
        var first = words[0];
        words[0] = first.StartsWith("а", StringComparison.Ordinal) ? first : "а" + first; // акы already carries it
        var last = words.Count - 1;
        var unitOne = Manifest.MANIFEST.Numbers.Units[1];
        words[last] = words[last] == unitOne
            ? Manifest.MANIFEST.Numbers.OrdinalOne
            : words[last] + Manifest.MANIFEST.Numbers.OrdinalSuffix;
        return string.Join(" ", words);
    }

    // ─── RULES ────────────────────────────────────────────────────────────────────────────────────────────

    private static readonly JsRe ZW = JsRegex.Compile("[\\u200b\\u200c\\u200d\\ufeff]", "gu");
    private static readonly JsRe SEP_RUN = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");
    private static readonly JsRe DEGROUP_SPACE =
        JsRegex.Compile("(?<!\\d)([1-9]\\d{0,2})(?:[ \\u00a0\\u202f\\u2009](\\d{3}))+(?!\\d)", "gu");
    private static readonly JsRe DEGROUP_COMMA2 =
        JsRegex.Compile("(?<![\\d,])[1-9]\\d{0,2}(?:,\\d{3}){2,}(?![\\d,])", "gu");
    private static readonly JsRe DEGROUP_COMMA1 =
        JsRegex.Compile("(?<![\\d,.])([1-9]\\d{0,2}),(\\d{3})(?![\\d,])", "gu");
    private static readonly JsRe MINUS =
        JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])(?<!\\p{Nd}\\s)\\u2212(?=\\p{Nd})", "gu");

    private const string TIME = "(\\d{1,2}):(\\d{2})(?::(\\d{2}))?";
    private const string DTIME = "(\\d{1,2})\\.(\\d{2})";
    private static readonly string HOUR_ANCHOR = "(?<![\\p{L}])" + Esc(HOUR) + "\\s{1,2}";
    private static readonly JsRe CLOCK_RANGE =
        JsRegex.Compile("(?<![\\d:])" + TIME + "\\s?[-\u2013\u2014]\\s?" + TIME + "(?![\\d:]|[.,]\\d)", "gu");
    private static readonly JsRe CLOCK_SINGLE =
        JsRegex.Compile("(?<![\\d:])" + TIME + "(?![\\d:]|[.,]\\d)", "gu");
    private static readonly JsRe DOT_CLOCK_RANGE =
        JsRegex.Compile(HOUR_ANCHOR + DTIME + "(?:\\s?[-\u2013\u2014]\\s?|\\s+" + Esc(RANGE_FROM) + "\\s+)" + DTIME + "(?!\\d|[.,]\\d)", "gu");
    private static readonly JsRe DOT_CLOCK_SINGLE =
        JsRegex.Compile(HOUR_ANCHOR + DTIME + "(?!\\d|[.,]\\d)", "gu");
    private static readonly JsRe DEGREES_C =
        JsRegex.Compile("(\\d)\\s?\\u00b0\\s?[C\\u0421](?![\\p{L}])", "gui");
    private static readonly JsRe DEGREES_BARE =
        JsRegex.Compile("(\\d)\\s?\\u00b0(?!\\s?[CFK\\u0421\\u0424](?![\\p{L}]))", "gui");
    private static readonly JsRe ASCII_EXP =
        JsRegex.Compile("(?<=\\d\\s?(?:км|см|м))([23])(?![\\d\\p{L}])", "gu");

    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![\\p{L}\\d.,-])(\\d+(?:[.,]\\d+)?)\\s?[-\u2013\u2014]\\s?(\\d+(?:[.,]\\d+)?)(?!\\d|[.,]\\d|-)", "gu");
    private static readonly JsRe TO_SPAID = JsRegex.Compile("[ар]ҟынӡа", "u");
    private static readonly JsRe DECIMAL =
        JsRegex.Compile("(?<![\\d.])(\\d+)[.,](\\d+)(?!\\d|\\.\\d)", "gu");
    private static readonly JsRe ANY_LETTER = JsRegex.Compile("\\p{L}", "u");
    private static readonly JsRe ORDINAL =
        JsRegex.Compile("(\\d+)[- ]" + Esc(Manifest.MANIFEST.Numbers.OrdinalSuffix) + "(?![\\p{L}])", "gu");

    /** Normalize one Abkhaz input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeAbkhaz(string input)
    {
        var s = input;

        // 1) ZERO-WIDTH marks — dropped before anything measures adjacency.
        s = Rewrite(s, ZW, "");

        // 2) DE-GROUP a thousands-separated numeral, FIRST among the number rules.
        //    ⚠ ONLY between digit groups of exactly three, and the LEFT guard keeps a year beside a count apart.
        s = Rewrite(s, DEGROUP_SPACE, m => JsRegex.Replace(m.Value, SEP_RUN, ""));
        //    ⚠ COMMA-GROUPING TOO. Two-plus groups de-group; a single group de-groups unless the integer
        //    part is a leading 0 (which keeps the decimal reading).
        s = Rewrite(s, DEGROUP_COMMA2, m => m.Value.Replace(",", ""));
        s = Rewrite(s, DEGROUP_COMMA1, "$1$2");

        // 2b) THE MINUS — U+2212 ONLY, before the symbol step (step 3 rewrites the °C this sits in front of).
        s = Rewrite(s, MINUS, Manifest.MANIFEST.Symbols.Minus + " ");

        // 3) SYMBOLS — clock, degrees, scale words, exponent, then the SHARED tier.
        //    3a) THE CLOCK. The frame word goes BEFORE the number, said ONCE.
        s = Rewrite(s, CLOCK_RANGE, m =>
        {
            var a = ClockParts(m.Groups[1].Value, m.Groups[2].Value, Opt(m.Groups[3]));
            var b = ClockParts(m.Groups[4].Value, m.Groups[5].Value, Opt(m.Groups[6]));
            if (a is null || b is null) return m.Value;
            var whole = s;
            var after = SliceAfter(whole, m);
            var to = TO_SPAID.IsMatch(after) ? "" : " " + Manifest.MANIFEST.Numbers.RangeTo;
            return $"{(SaidHour(whole, m.Index) ? "" : HOUR + " ")}{a} {RANGE_FROM} {b}{to}";
        });
        s = Rewrite(s, CLOCK_SINGLE, m =>
        {
            var t = ClockParts(m.Groups[1].Value, m.Groups[2].Value, Opt(m.Groups[3]));
            if (t is null) return m.Value;
            var whole = s;
            return $"{(SaidHour(whole, m.Index) ? "" : HOUR + " ")}{t}";
        });
        //    ⚠ THE DOT-SEPARATED CLOCK is anchored on the (letter-bounded) hour word itself; a bare "10.00"
        //    is a decimal, so every dot form is anchored on асааҭ.
        s = Rewrite(s, DOT_CLOCK_RANGE, m =>
        {
            var a = ClockParts(m.Groups[1].Value, m.Groups[2].Value, null);
            var b = ClockParts(m.Groups[3].Value, m.Groups[4].Value, null);
            if (a is null || b is null) return m.Value;
            var whole = s;
            var after = SliceAfter(whole, m);
            var to = TO_SPAID.IsMatch(after) ? "" : " " + Manifest.MANIFEST.Numbers.RangeTo;
            return $"{HOUR} {a} {RANGE_FROM} {b}{to}";
        });
        s = Rewrite(s, DOT_CLOCK_SINGLE, m =>
        {
            var t = ClockParts(m.Groups[1].Value, m.Groups[2].Value, null);
            return t is null ? m.Value : $"{HOUR} {t}";
        });

        //    3b) DEGREES. ⟨°C⟩ takes the attested unit NAME verbatim; a bare ⟨°⟩ is the postposed градус.
        s = Rewrite(s, DEGREES_C, m => $"{m.Groups[1].Value} {Manifest.MANIFEST.Symbols.Celsius}");
        s = Rewrite(s, DEGREES_BARE, m => $"{m.Groups[1].Value} {Manifest.MANIFEST.Symbols.Degree}");

        //    3c) SCALE ABBREVIATIONS (млрд/млн) — BEFORE the symbol tier, so the currency rule can hop the
        //    SPELLED scale word and land the currency name LAST.
        foreach (var kv in Manifest.MANIFEST.Symbols.Scales)
        {
            var abbr = kv.Key;
            var word = kv.Value == "milliard" ? Manifest.MANIFEST.Numbers.Milliard : Manifest.MANIFEST.Numbers.Million;
            s = Rewrite(s, JsRegex.Compile("(?<![\\p{L}])" + Esc(abbr) + "(?:\\.(\\s+\\p{Lu})?|(?![\\p{L}]))", "gu"),
                m => m.Groups[1].Success ? $"{word}.{m.Groups[1].Value}" : word);
        }

        //    3d) THE ASCII EXPONENT — "8 км2" beside "422 000 км²". Folded to the superscript BEFORE the tier.
        s = Rewrite(s, ASCII_EXP, m => m.Groups[1].Value == "2" ? "²" : "³");

        //    3e) PERCENT, CURRENCY, UNITS and КМ² through the SHARED symbol tier.
        s = SYMBOLIZE(s);

        // 4) RANGES. ⚠ BEFORE the decimal rule; the endpoints admit a decimal.
        s = Rewrite(s, RANGE, m =>
        {
            var whole = s;
            var after = SliceAfter(whole, m);
            var said = TO_SPAID.IsMatch(after);
            return $"{m.Groups[1].Value} {RANGE_FROM} {m.Groups[2].Value}{(said ? "" : " " + Manifest.MANIFEST.Numbers.RangeTo)}";
        });

        // 5) DECIMALS. The integer part reads as a numeral and each fractional digit as its own numeral.
        s = Rewrite(s, DECIMAL, m =>
        {
            var whole = s;
            var intPart = m.Groups[1].Value;
            var frac = m.Groups[2].Value;
            if (m.Value.Contains('.') && frac.Length == 4 && intPart.Length <= 2
                && Js.Number(intPart) >= 1 && Js.Number(intPart) <= 12)
                return m.Value; // MM.YYYY
            var next = m.Index + m.Length < whole.Length ? whole[m.Index + m.Length].ToString() : "";
            var sep = ANY_LETTER.IsMatch(next) ? " " : "";
            return $"{intPart} {Numbers.ReadDigits(frac)}{sep}";
        });

        // 6) ORDINALS — AFTER ranges: `13-15` is a range, but `16-тәи` is an ordinal.
        s = Rewrite(s, ORDINAL, m => OrdinalWords(Js.Number(m.Groups[1].Value)) ?? m.Value);

        // 7) ABBREVIATIONS — LONGEST FIRST (the jsonc order); the dot is the abbreviation's, not a sentence's.
        foreach (var pair in Manifest.MANIFEST.Abbreviations)
        {
            var abbr = pair[0];
            var full = pair[1];
            s = Rewrite(s, JsRegex.Compile("(?<![\\p{L}])" + Esc(abbr) + "\\.(\\s+\\p{Lu})?", "gu"),
                m => m.Groups[1].Success ? $"{full}.{m.Groups[1].Value}" : full);
        }

        return s;
    }

    /** The optional seconds group as a string, or null when it did not participate. */
    private static string? Opt(Group g) => g.Success && g.Value.Length > 0 ? g.Value : null;

    /** The up-to-40 characters after the match — the "already said a to" / "already said the hour" window. */
    private static string SliceAfter(string whole, Match m) =>
        whole.Substring(m.Index + m.Length, Math.Min(40, whole.Length - m.Index - m.Length));
}
