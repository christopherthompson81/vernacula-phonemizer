/**
 * Standard Malay (zsm) TEXT NORMALIZATION — a PRE-PASS in front of the inherited Indonesian
 * normalization, claiming only the shapes where Malay's conventions disagree (comma thousands, dot
 * decimal — the inverse of Indonesian's).
 * Ported from src/languages/malay/normalize.ts — see that file for the corpus evidence.
 *
 * ⚠ ORDERING IS LOAD-BEARING throughout: every rule consuming a GLUED unit runs before the decimal
 * rule, and the clock runs before the ranges.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malay;

public static class Normalize
{
    /**
     * Dotted abbreviations where MALAY differs from Indonesian's table; the shapes identical in both stay with
     * the inherited layer.
     */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dr"] = "doktor",   // Indonesian: dokter
        ["no"] = "nombor",   // Indonesian: nomor
        ["en"] = "Encik",    // no Indonesian entry at all — read as the bare letter pair plus a phrase break
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /**
     * RATES. Malay forms the denominator with the `se-` prefix where Indonesian says `per jam` / `per detik`.
     * Keyed on the whole slash unit, so a bare `s` or `j` can never match standalone.
     */
    private static readonly IReadOnlyDictionary<string, string> RATE_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km/j"] = "kilometer sejam", ["km/jam"] = "kilometer sejam", ["batu/jam"] = "batu sejam",
        ["km/s"] = "kilometer sesaat", ["m/s"] = "meter sesaat", ["m/saat"] = "meter sesaat",
        ["Mbit/s"] = "megabit sesaat", ["kbit/s"] = "kilobit sesaat",
        ["bsj"] = "batu sejam", ["kmj"] = "kilometer sejam",
    };
    private static readonly string RATE_ALT = string.Join("|", RATE_WORD.Keys.OrderByDescending(k => k.Length));

    /** Frequency units, glued to their number (`2.4Ghz`). */
    private static readonly IReadOnlyDictionary<string, string> FREQ_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ghz"] = "gigahertz", ["mhz"] = "megahertz", ["khz"] = "kilohertz", ["hz"] = "hertz",
    };

    /** Compass letters after a degree sign (`35°W`), keyed lowercase. */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["n"] = "utara", ["s"] = "selatan", ["e"] = "timur", ["w"] = "barat",
    };

    private const string L = "(?<![\\p{L}\\p{M}])"; // ⚠ never `\b`: it is ASCII-defined and finds no boundary against non-Latin script
    private const string R = "(?![\\p{L}\\p{M}])";

    /**
     * A clock is only a clock when something says so, and in this corpus something always does: `pukul`/`jam`
     * earlier in the clause, or a meridiem / zone / part-of-day word just after.
     */
    private const string CLOCK_BEFORE = "(?<=" + L + "(?:pukul|jam)" + R + "[^.!?]{0,24})";
    private const string MERIDIEM = "a\\.m\\.|p\\.m\\.|pm";
    private const string CLOCK_AFTER = "(?=[^.!?]{0,12}?(?:" + MERIDIEM + "|pg|pagi|petang|malam|GMT|UTC|MDT|waktu)" + R + ")";

    /** Malay says the part of the day, not the Latin abbreviation: `pukul 1.15 pagi`, `pukul 10.08 malam`. */
    private static string MeridiemWord(double hour, string mark)
    {
        var pm = mark.ToLowerInvariant().StartsWith("p", StringComparison.Ordinal);
        if (hour == 12) return pm ? "tengah hari" : "tengah malam";
        if (!pm) return "pagi";
        return hour >= 1 && hour <= 6 ? "petang" : "malam";
    }

    /** Nouns that mark a hyphenated pair as a RANGE rather than a score. */
    private static readonly string RANGE_NOUN = string.Join("|", new[]
    {
        "minit", "jam", "saat", "hari", "malam", "petang", "pagi", "bulan", "minggu", "tahun", "abad",
        "km", "kilometer", "meter", "sentimeter", "milimeter", "batu", "ela", "inci", "kaki", "kg", "kilogram",
        "juta", "bilion", "ribu", "peratus", "darjah", "kali", "orang", "ekor", "pm", "GMT", "UTC", "MDT",
    });

    private const string MAGNITUDE = "ribu|juta|bilion|billion|trilion";
    private static readonly IReadOnlyDictionary<string, string> CURRENCY_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["$"] = "dolar", ["€"] = "euro", ["£"] = "pound", ["¥"] = "yen",
    };
    private const string AMOUNT = "\\d[\\d.]*(?:\\s+(?:" + MAGNITUDE + "))?";
    private const string NUM = "\\d+(?:\\.\\d+)?";

    private static readonly IReadOnlyDictionary<string, string> CUBED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilometer", ["cm"] = "sentimeter", ["mm"] = "milimeter",
    };
    private static readonly string CUBE_ALT = string.Join("|", CUBED.Keys.OrderByDescending(k => k.Length));

    private const string CLOCK_BODY = "([01]?\\d|2[0-3])[.:]\\s?([0-5]\\d)(?![\\d]|\\.\\d)";

    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*(?:&amp;|&(?!\\w+;))\\s*", "gu");
    private static readonly JsRe COMMA_THOUSANDS = JsRegex.Compile("(?<!\\d)(\\d{1,3}(?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOT_G = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe CURRENCY_CODE_PREFIX = JsRegex.Compile($"({L}(?:US|AS|HK|NZ|CAD?))\\$(?=\\d)", "gu");
    private static readonly JsRe CURRENCY_REDUNDANT =
        JsRegex.Compile($"[$€£¥]\\s?(?={AMOUNT}\\s+(?:AUD|USD|MYR|SGD|EUR|GBP|JPY|NZD|CAD|HKD){R})", "gu");
    private static readonly JsRe CURRENCY_MAGNITUDE =
        JsRegex.Compile($"([$€£¥])\\s?(\\d[\\d.]*)(\\s+(?:{MAGNITUDE})){R}", "gu");
    private static readonly JsRe CURRENCY_DECIMAL = JsRegex.Compile("([$€£¥])\\s?(\\d+\\.\\d+)", "gu");
    private static readonly JsRe PERCENT_REDUNDANT = JsRegex.Compile("(\\d)\\s?%(?=\\s*peratus)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d)\\s?%", "gu");
    private static readonly JsRe ERA_SM = JsRegex.Compile($"(\\d)(\\s*)SM{R}", "gu");
    private static readonly JsRe DOTTED_CAPS_MID = JsRegex.Compile("(?<![\\p{L}\\p{M}.])((?:[A-Z]\\.){2,})(?=\\s+\\p{L})", "gu");
    private static readonly JsRe DOTTED_CAPS_END = JsRegex.Compile("(?<![\\p{L}\\p{M}.])((?:[A-Z]\\.){2,})(?=\\s*(?:[,;:!?)]|$))", "gu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"{L}({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"{L}({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?)]|$))", "giu");
    private static readonly JsRe NOMBOR = JsRegex.Compile($"{L}no\\.\\s?(?=\\d)", "giu");
    private static readonly JsRe RATE_RE = JsRegex.Compile($"(\\d)\\s?({RATE_ALT}){R}", "gu");
    private static readonly JsRe KM2_GLUED = JsRegex.Compile($"(?<=\\d)km[²2]{R}", "gu");
    private static readonly JsRe KM2_BARE = JsRegex.Compile($"{L}km[²2]{R}", "gu");
    private static readonly JsRe M2 = JsRegex.Compile("(\\d\\s?)m²", "gu");
    private static readonly JsRe CUBE_GLUED = JsRegex.Compile($"(?<=\\d)\\s?({CUBE_ALT})[³3]{R}", "gu");
    private static readonly JsRe CUBE_BARE = JsRegex.Compile($"{L}({CUBE_ALT})[³3]{R}", "gu");
    private static readonly JsRe M3 = JsRegex.Compile("(\\d\\s?)m³", "gu");
    private static readonly JsRe FREQ = JsRegex.Compile($"(\\d)\\s?(GHz|Ghz|gHz|ghz|MHz|Mhz|mhz|kHz|khz|Hz){R}", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?°\\s?([NSEWnsew])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe CLOCK_MERIDIEM = JsRegex.Compile(
        $"(?<![\\d.:]){CLOCK_BODY}\\s?({MERIDIEM})(?![\\p{{L}}\\p{{M}}])(?!\\s*(?:pagi|petang|malam|tengah))", "gu");
    private static readonly JsRe CLOCK_MARKED_BEFORE = JsRegex.Compile($"{CLOCK_BEFORE}(?<![\\d.:]){CLOCK_BODY}", "gu");
    private static readonly JsRe CLOCK_MARKED_AFTER = JsRegex.Compile($"(?<![\\d.:]){CLOCK_BODY}{CLOCK_AFTER}", "gu");
    private static readonly JsRe BARE_HOUR_MERIDIEM = JsRegex.Compile(
        $"(?<![\\d.:])(\\d{{1,2}})\\s?({MERIDIEM})(?![\\p{{L}}\\p{{M}}])(?!\\s*(?:pagi|petang|malam|tengah))", "gu");
    private static readonly JsRe PG = JsRegex.Compile($"(?<=\\d[^.!?]{{0,20}}){L}pg\\.?{R}", "gu");
    private static readonly JsRe COLON_ZERO = JsRegex.Compile("(?<![\\d.:])([01]?\\d|2[0-3]):00(?![\\d.:])", "gu");
    private static readonly JsRe COLON_PAIR = JsRegex.Compile("(?<![\\d.:])(\\d{1,4}):(\\d{1,4})(?!\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(?=\\d)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(?=\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(?=\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("(\\S)\\s*=\\s*(?=\\S)", "gu");
    private static readonly JsRe RANGE_MEASURE =
        JsRegex.Compile($"(?<![\\d.])({NUM})\\s?[-–]\\s?({NUM})(?=\\s*(?:{RANGE_NOUN}){R})", "gu");
    private static readonly JsRe RANGE_YEARS = JsRegex.Compile("(?<!\\d)([12]\\d{3})\\s?[-–]\\s?([12]\\d{3})(?!\\d)", "gu");
    private static readonly JsRe VERSION_DOT = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)([a-z])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d])", "gu");

    /**
     * Malay is not a mutating or case-marking language, so no agreement is lost by rewriting around DIGITS —
     * the clock and range rewrites can leave their operands as digits for the engine's number path to read.
     */
    public static string NormalizeMalay(string input)
    {
        var s = input;

        s = AMPERSAND.Replace(s, " dan ");

        s = COMMA_THOUSANDS.Replace(s, m => COMMA_G.Replace(m.Value, ""));

        s = CURRENCY_CODE_PREFIX.Replace(s, "$1 $");
        // The magnitude word has to be got out from between the number and its currency, and the SIGN cannot
        // simply be moved: the shared tier keys the currency word on adjacency to the digits, so a moved sign
        // is dropped and the currency vanishes. It is consumed here and re-emitted as the tier's own word.
        s = CURRENCY_REDUNDANT.Replace(s, "");
        s = CURRENCY_MAGNITUDE.Replace(s, m =>
            $"{m.Groups[2].Value}{m.Groups[3].Value} {CURRENCY_WORD[m.Groups[1].Value]}");
        s = CURRENCY_DECIMAL.Replace(s, "$2 $1");

        s = PERCENT_REDUNDANT.Replace(s, "$1");
        s = PERCENT.Replace(s, "$1 peratus");

        s = ERA_SM.Replace(s, "$1$2sebelum Masihi");

        s = DOTTED_CAPS_MID.Replace(s, m => DOT_G.Replace(m.Groups[1].Value, ""));
        s = DOTTED_CAPS_END.Replace(s, m => $"{DOT_G.Replace(m.Groups[1].Value, "")}.");
        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");
        s = NOMBOR.Replace(s, "nombor ");

        // Rates before the shared tier can claim the bare `km`, and before the decimal rule below.
        s = RATE_RE.Replace(s, m => $"{m.Groups[1].Value} {RATE_WORD[m.Groups[2].Value]}");

        // Exponent, cube and frequency units, all BEFORE the decimal rule: a glued unit (`19,500km²`,
        // `2.4Ghz`) looks exactly like the version-dot guard's "a letter follows the fraction digits".
        s = KM2_GLUED.Replace(s, " kilometer persegi"); // glued: `19,500km²`
        s = KM2_BARE.Replace(s, "kilometer persegi");
        s = M2.Replace(s, "$1meter persegi");
        s = CUBE_GLUED.Replace(s, m => $" {CUBED[m.Groups[1].Value.ToLowerInvariant()]} padu");
        s = CUBE_BARE.Replace(s, m => $"{CUBED[m.Groups[1].Value.ToLowerInvariant()]} padu");
        s = M3.Replace(s, "$1meter padu");

        s = FREQ.Replace(s, m => $"{m.Groups[1].Value} {FREQ_WORD[m.Groups[2].Value.ToLowerInvariant()]}");

        s = DEG_C.Replace(s, "$1 darjah Celsius");
        s = DEG_F.Replace(s, "$1 darjah Fahrenheit");
        s = DEG_COMPASS.Replace(s, m => $"{m.Groups[1].Value} darjah {COMPASS[m.Groups[2].Value.ToLowerInvariant()]}");
        s = DEG.Replace(s, "$1 darjah");

        // A clock is only claimed when a marker says so — `pukul`/`jam` before, or a meridiem/zone/part-of-day
        // word after — because Malay's dot is the DECIMAL point, so digit count cannot separate the two the way
        // it does in Indonesian, and a colon pair may be a score.
        string Clock(string h, string min, string? mark)
        {
            var mv = Js.Number(min);
            var time = mv == 0 ? $"{Js.NumberToString(Js.Number(h))}" : $"{Js.NumberToString(Js.Number(h))} {Js.NumberToString(mv)}";
            return mark is null ? time : $"{time} {MeridiemWord(Js.Number(h), mark)}";
        }
        // The pass REPEATS to a fixed point: the `pukul` window is bounded by `[^.!?]`, and a first clock's own
        // dot closes that window for a second one coordinated with it (`antara pukul 06.30 dan 07.30`). Once
        // pass 1 has removed that dot, pass 2 can claim the second clock. Bounded, and idempotent after.
        for (var pass = 0; pass < 4; pass++)
        {
            var before = s;
            s = CLOCK_MERIDIEM.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value));
            s = CLOCK_MARKED_BEFORE.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value, null));
            s = CLOCK_MARKED_AFTER.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value, null));
            if (s == before) break;
        }

        s = BARE_HOUR_MERIDIEM.Replace(s, m =>
            $"{m.Groups[1].Value} {MeridiemWord(Js.Number(m.Groups[1].Value), m.Groups[2].Value)}");
        s = PG.Replace(s, "pagi");

        // A colon pair that survived the clock rules is not a clock (score, aspect ratio, degree class): no
        // single Malay word fits all three senses, so the MARK is dropped and both operands kept. A sports time
        // must be claimed HERE, or the inherited Indonesian clock rule takes it once the decimal rule below has
        // rewritten the hundredths that were protecting it. `H:00` is exempted first: it is a clock regardless.
        s = COLON_ZERO.Replace(s, "$1");
        s = COLON_PAIR.Replace(s, "$1 $2");

        s = TIMES.Replace(s, "$1 kali ");
        s = LESS_THAN.Replace(s, "$1 kurang daripada ");
        s = GREATER_THAN.Replace(s, "$1 lebih daripada ");
        s = EQUALS_RE.Replace(s, "$1 sama dengan ");

        // Ranges fire ONLY for a pair a measure/period noun follows, or a pair of four-digit years — which is
        // what keeps them off sports scores. The year arm's trailing guard is `(?!\d)` and NOT `(?![\d.,])`, so
        // a year range ending on a clause comma still joins.
        s = RANGE_MEASURE.Replace(s, "$1 hingga $2");
        s = RANGE_YEARS.Replace(s, "$1 hingga $2");

        // A version dot is `titik`, not `perpuluhan`: `802.11` is not a quantity. Its trailing letter is
        // re-emitted behind a HYPHEN, which the tokenizer drops — that breaks the number-adjacency the shared
        // unit tier matches on, so `802.11g` cannot read as *sebelas GRAM*.
        s = VERSION_DOT.Replace(s, "$1 titik $2-$3");
        // Decimals LAST, once every glued-unit rule has run. The fraction is read DIGIT BY DIGIT. A fraction of
        // exactly `000` behind at most three digits is excluded: that is Indonesian-convention thousands
        // grouping leaking through translation, and the inherited tokenizer already reads it correctly.
        s = DECIMAL_RE.Replace(s, m =>
        {
            var intPart = m.Groups[1].Value;
            var frac = m.Groups[2].Value;
            return intPart.Length <= 3 && frac == "000"
                ? m.Value
                : $"{intPart} perpuluhan {string.Join(" ", Js.CodePoints(frac))}";
        });

        return s;
    }
}
