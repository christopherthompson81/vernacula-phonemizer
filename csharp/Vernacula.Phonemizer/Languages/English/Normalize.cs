/**
 * English text normalization — rewrite non-lexical tokens into speakable words BEFORE the tokenizer, so the
 * existing number/ordinal/OOV machinery does the pronouncing.
 * Ported from src/languages/english/normalize.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public static class Normalize
{
    private static readonly IReadOnlyDictionary<string, int> ROMAN = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["ii"] = 2, ["iii"] = 3, ["iv"] = 4, ["vii"] = 7, ["viii"] = 8, ["ix"] = 9, ["xii"] = 12,
        ["xiii"] = 13, ["xiv"] = 14, ["xv"] = 15, ["xvi"] = 16, ["xvii"] = 17, ["xviii"] = 18,
        ["xix"] = 19, ["xx"] = 20,
    };

    private static readonly JsRe ROMAN_CARDINAL_CTX = JsRegex.Compile(
        "\\b(war|chapter|part|act|section|volume|book|phase|stage|grade|class|type|level|apollo|rocky|bowl|wrestlemania|olympiad|super)$", "i");

    private static readonly IReadOnlyDictionary<string, string[]> UNITS = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["km"] = new[] { "kilometer", "kilometers" }, ["cm"] = new[] { "centimeter", "centimeters" },
        ["mm"] = new[] { "millimeter", "millimeters" }, ["kg"] = new[] { "kilogram", "kilograms" },
        ["mg"] = new[] { "milligram", "milligrams" }, ["lb"] = new[] { "pound", "pounds" },
        ["lbs"] = new[] { "pounds", "pounds" }, ["oz"] = new[] { "ounce", "ounces" },
        ["ft"] = new[] { "foot", "feet" }, ["mi"] = new[] { "mile", "miles" },
        ["mph"] = new[] { "miles per hour", "miles per hour" }, ["kph"] = new[] { "kilometers per hour", "kilometers per hour" },
        ["km/h"] = new[] { "kilometer per hour", "kilometers per hour" }, ["m/s"] = new[] { "meter per second", "meters per second" },
        ["miles/hour"] = new[] { "mile per hour", "miles per hour" }, ["mbit/s"] = new[] { "megabit per second", "megabits per second" },
        ["yards/meters"] = new[] { "yard per meter", "yards per meters" },
        ["°c"] = new[] { "degree Celsius", "degrees Celsius" }, ["°f"] = new[] { "degree Fahrenheit", "degrees Fahrenheit" },
        ["℃"] = new[] { "degree Celsius", "degrees Celsius" }, ["℉"] = new[] { "degree Fahrenheit", "degrees Fahrenheit" },
        ["°"] = new[] { "degree", "degrees" },
        ["m"] = new[] { "meter", "meters" },
        ["l"] = new[] { "liter", "liters" }, ["L"] = new[] { "liter", "liters" }, ["ml"] = new[] { "milliliter", "milliliters" },
        ["g"] = new[] { "gram", "grams" }, ["t"] = new[] { "ton", "tons" }, ["W"] = new[] { "watt", "watts" },
        ["ha"] = new[] { "hectare", "hectares" },
        ["hz"] = new[] { "hertz", "hertz" }, ["khz"] = new[] { "kilohertz", "kilohertz" }, ["mhz"] = new[] { "megahertz", "megahertz" },
        ["ghz"] = new[] { "gigahertz", "gigahertz" }, ["kb"] = new[] { "kilobyte", "kilobytes" }, ["mb"] = new[] { "megabyte", "megabytes" },
        ["gb"] = new[] { "gigabyte", "gigabytes" }, ["tb"] = new[] { "terabyte", "terabytes" }, ["kw"] = new[] { "kilowatt", "kilowatts" },
    };

    /** The case-folded index for step 1 (see resolveUnitSymbol) — built once, beside the table it indexes. */
    private static readonly IReadOnlyDictionary<string, string[]> UNITS_FOLDED = BuildFolded();

    private static Dictionary<string, string[]> BuildFolded()
    {
        var d = new Dictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var kv in UNITS.Reverse()) d[kv.Key.ToLowerInvariant()] = kv.Value;
        return d;
    }

    private static readonly IReadOnlyDictionary<string, string[]> CURRENCY = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["$"] = new[] { "dollar", "dollars" }, ["£"] = new[] { "pound", "pounds" },
        ["€"] = new[] { "euro", "euros" }, ["¥"] = new[] { "yen", "yen" },
    };

    /** A MAGNITUDE ABBREVIATION GLUED TO A MONEY FIGURE — `$1.5m`, `£2.3m`, `$2bn`, `£700k`. */
    private static readonly IReadOnlyDictionary<string, string> MONEY_MAGNITUDE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["m"] = "million", ["M"] = "million", ["bn"] = "billion", ["BN"] = "billion",
        ["Bn"] = "billion", ["B"] = "billion", ["k"] = "thousand", ["K"] = "thousand",
    };
    private static readonly string MONEY_MAG_ALT = string.Join("|", MONEY_MAGNITUDE.Keys.OrderByDescending(k => k.Length));

    private const string MONTH_ALT = "january|february|march|april|may|june|july|august|september|october|november|december";

    private static readonly JsRe ABBREV_FUNCTION_NEXT = JsRegex.Compile(
        "^(?:in|on|at|and|or|but|the|a|an|is|was|were|are|to|for|with|of|from|by|near|that|this|it|he|she|they|we|you|i|as|his|her|its|their|there|then|when|where|which|who|had|has|have)$", "i");

    private static readonly JsRe UPPER_INITIAL = JsRegex.Compile("^\\p{Lu}", "u");
    private static bool IsName(string next) => UPPER_INITIAL.IsMatch(next);

    private static readonly IReadOnlyDictionary<string, Func<string, string>> DOTTED_ABBREV =
        new Dictionary<string, Func<string, string>>(StringComparer.Ordinal)
        {
            ["st"] = next => !IsName(next) && ABBREV_FUNCTION_NEXT.IsMatch(next) ? "street" : "saint",
            ["dr"] = next => !IsName(next) && ABBREV_FUNCTION_NEXT.IsMatch(next) ? "drive" : "doctor",
            ["mt"] = _ => "mount",
            ["mr"] = _ => "mister",
            ["mrs"] = _ => "missus",
        };

    private const string NOT_VERSION = "(?<![\\d.,])(?!802[.,]11\\w)(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))";

    private static readonly JsRe UNIT_RE = JsRegex.Compile(
        NOT_VERSION + "(\\d[\\d,]*(?:\\.\\d+)?)(\\s+(?:hundred|thousand|million|billion|trillion))?\\s?("
        + string.Join("|", UNITS.Keys.OrderByDescending(k => k.Length)) + ")([²³23])?(?![\\p{L}\\p{M}])",
        "giu");

    /** Dotted abbreviations with a single fixed reading (no neighbour test needed). `No.` otherwise reads as
     *  the word "no". */
    private static readonly IReadOnlyDictionary<string, string> PLAIN_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["jr"] = "junior", ["sr"] = "senior", ["prof"] = "professor", ["rev"] = "reverend", ["sgt"] = "sergeant",
        ["cpl"] = "corporal", ["lt"] = "lieutenant", ["col"] = "colonel", ["gen"] = "general", ["gov"] = "governor",
        ["sen"] = "senator", ["rep"] = "representative", ["no"] = "number", ["nos"] = "numbers", ["ave"] = "avenue",
        ["blvd"] = "boulevard", ["rd"] = "road", ["ln"] = "lane", ["dept"] = "department", ["est"] = "established",
        ["approx"] = "approximately", ["vs"] = "versus", ["vol"] = "volume", ["ch"] = "chapter", ["fig"] = "figure",
        ["pp"] = "pages", ["ed"] = "edition", ["eds"] = "editors", ["inc"] = "incorporated", ["ltd"] = "limited",
        ["corp"] = "corporation", ["univ"] = "university",
        ["etc"] = "etc", ["ibid"] = "ibid", ["cf"] = "compare", ["viz"] = "namely",
    };
    private static readonly string PLAIN_ABBREV_ALT = string.Join("|", PLAIN_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Fraction denominators. 2/3/4 are suppletive (half, third, quarter); the rest are the ordinal word,
     *  spelled out here rather than emitted as "5th" because the ordinal-suffix path has no plural form and
     *  "2/5" needs "fifths". Beyond 20 a fraction is vanishingly rare in prose and is left as digits. */
    private static readonly IReadOnlyDictionary<int, string> DENOMINATOR = new Dictionary<int, string>
    {
        [2] = "half", [3] = "third", [4] = "quarter", [5] = "fifth", [6] = "sixth", [7] = "seventh",
        [8] = "eighth", [9] = "ninth", [10] = "tenth", [11] = "eleventh", [12] = "twelfth",
        [16] = "sixteenth", [20] = "twentieth",
    };

    private static string? FractionWords(double num, double den)
    {
        if (den < 2 || num < 1) return null;
        if (!DENOMINATOR.TryGetValue((int)den, out var bas)) return null;
        var plural = num > 1 ? (bas == "half" ? "halves" : $"{bas}s") : bas;
        return $"{Js.NumberToString(num)} {plural}";
    }

    private static readonly string[] MONTHS = MONTH_ALT.Split('|');

    /** English ordinal suffix for a day-of-month (1st, 2nd, 3rd, 4th … 21st, 22nd, 23rd). */
    private static string OrdinalSuffix(double n)
    {
        double mod10 = n % 10, mod100 = n % 100;
        if (mod10 == 1 && mod100 != 11) return "st";
        if (mod10 == 2 && mod100 != 12) return "nd";
        if (mod10 == 3 && mod100 != 13) return "rd";
        return "th";
    }

    /** A numeric date → "march 14th 2011", the word order English speaks and the shape the date/year rules
     *  below already handle. Null if the fields are not a real date, so the caller leaves it alone. */
    private static string? IsoDate(double year, double month, double day)
    {
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return $"{MONTHS[(int)month - 1]} {Js.NumberToString(day)}{OrdinalSuffix(day)} {Js.NumberToString(year)}";
    }

    /** A 4-digit year in its English pair-wise reading, emitted as tokens the number path already handles:
     *  1998 → "19 98" (nineteen ninety-eight), 1905 → "19 oh 5", 1900 → "19 hundred", 2000 → "2 thousand",
     *  2007 → "2 thousand 7", 2011 → "20 11" (twenty eleven). */
    private static string YearWords(double y)
    {
        double hi = Math.Floor(y / 100), lo = y % 100;
        if (y >= 2000 && y < 2010) return lo == 0 ? "2 thousand" : $"2 thousand {Js.NumberToString(lo)}";
        if (lo == 0) return $"{Js.NumberToString(hi)} hundred";
        if (lo < 10) return $"{Js.NumberToString(hi)} oh {Js.NumberToString(lo)}";
        return $"{Js.NumberToString(hi)} {Js.NumberToString(lo)}";
    }

    /** Superscript digits → ASCII, so an exponent reaches the number path as a readable numeral. */
    private static readonly IReadOnlyDictionary<string, string> SUPERSCRIPT_DIGIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["⁻"] = "-", // SUPERSCRIPT MINUS — a negative exponent, `10⁻³¹`
        ["⁰"] = "0", ["¹"] = "1", ["²"] = "2", ["³"] = "3", ["⁴"] = "4",
        ["⁵"] = "5", ["⁶"] = "6", ["⁷"] = "7", ["⁸"] = "8", ["⁹"] = "9",
    };

    // Compiled once rather than per call — the TS builds several of these with `new RegExp` inside the pass.
    private static readonly JsRe TITLE_ABBREV = JsRegex.Compile("\\b(st|dr|mt|mr|mrs)\\.\\s+([a-zà-ÿ']+)", "gi");
    private static readonly JsRe TITLE_ABBREV_END = JsRegex.Compile("\\b(st|dr|mt)\\.(?=\\s*(?:[.,;:!?]|$))", "gi");
    private static readonly JsRe SAINT_UNDOTTED = JsRegex.Compile("\\bst\\s+([a-z']+)", "gi");
    private static readonly JsRe PLAIN_MID = JsRegex.Compile($"\\b({PLAIN_ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe PLAIN_END = JsRegex.Compile($"\\b({PLAIN_ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?)]|$))", "giu");
    private static readonly JsRe ET_AL_MID = JsRegex.Compile("\\bet\\s+al\\.(\\s+)(?=\\p{L})", "giu");
    private static readonly JsRe ET_AL_END = JsRegex.Compile("\\bet\\s+al\\.(?=\\s*(?:[.,;:!?)]|$))", "giu");
    private static readonly JsRe CIRCA = JsRegex.Compile("\\bca?\\.\\s*(?=\\d{3,4}(?!\\d))", "gi");
    private static readonly JsRe NUMBER_SIGN = JsRegex.Compile("\\bnos?\\.\\s*(?=\\d)", "gi");
    private static readonly JsRe EG_MID = JsRegex.Compile("\\be\\.\\s?g\\.(\\s+)(?=[\\p{L}\\d])", "giu");
    private static readonly JsRe EG_END = JsRegex.Compile("\\be\\.\\s?g\\.(?=\\s*(?:[,;:!?)]|$))", "giu");
    private static readonly JsRe IE_MID = JsRegex.Compile("\\bi\\.\\s?e\\.(\\s+)(?=[\\p{L}\\d])", "giu");
    private static readonly JsRe IE_END = JsRegex.Compile("\\bi\\.\\s?e\\.(?=\\s*(?:[,;:!?)]|$))", "giu");
    private static readonly JsRe AM_PM = JsRegex.Compile("\\b([ap])\\.\\s?m\\.", "gi");
    private static readonly JsRe DOTTED_INITIALS = JsRegex.Compile("\\b([A-Za-z](?:\\.[A-Za-z]){1,4})\\.(?!\\w)", "g");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "g");
    private static readonly JsRe ERA = JsRegex.Compile("\\b(BCE|BC|CE|AD)\\b", "g");
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        $"(?<!(?:{MONTH_ALT})[ \u00a0\u202f\u2009])(?<![\\d.,])\\d{{1,3}}(?:[ \u00a0\u202f\u2009]\\d{{3}})+(?![\\d])", "giu");
    private static readonly JsRe SPACE_GROUP_SEPS = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe SCI_EXPONENT = JsRegex.Compile(
        "(?<=[×x·]\\s?)(10)\\s?(\\u207b?[\\u2070\\u00b9\\u00b2\\u00b3\\u2074-\\u2079]+|-\\d+)", "gu");
    private static readonly JsRe NEGATIVE = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("(^|[\\s(])±\\s?(\\d)", "gu");
    private static readonly JsRe ISO_DATE = JsRegex.Compile("\\b(\\d{4})-(\\d{2})-(\\d{2})\\b", "g");
    private static readonly JsRe US_DATE = JsRegex.Compile("\\b(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\b", "g");
    // ⚠ `(?![\\p{L}\\p{M}])`, NOT `\\b` — and the `u` flag is required for it. JS defines `\\b` on ASCII
    // `\\w`, so `$1.50é` read as money while `$1.50a` did not. See src/languages/english/normalize.ts.
    private static readonly JsRe MONEY_CENTS =
        JsRegex.Compile("([$£€¥])\\s?(\\d[\\d,]*)\\.(\\d{2})(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})\\/(\\d{1,3})\\b(?!\\s*[\\/\\d])", "gu");
    private static readonly JsRe CURRENCY_RE = JsRegex.Compile(
        "([$£€¥])\\s?(\\d[\\d,]*(?:\\.\\d+)?)(?:(\\s+(?:million|billion|trillion|thousand))|("
        + MONEY_MAG_ALT + ")(?![\\p{L}\\p{M}\\d]))?", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d)\\s?%", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("\\b(\\d{1,2}):([0-5]\\d)\\b(\\s*[ap]m\\b)?", "gu");
    private static readonly JsRe MONTH_DAY = JsRegex.Compile(
        $"\\b({MONTH_ALT})\\s+(\\d{{1,2}})(?!\\d|\\s*(?:st|nd|rd|th|percent))\\b", "gi");
    private static readonly JsRe YEAR_RANGE = JsRegex.Compile(
        "(?<!\\b(?:pp|p|pages?|nos?|no|rooms?|chapters?|verses?|lines?|sections?|parts?|models?|items?|figs?|figures?|tables?|suites?|apt|ext)\\.?\\s)"
        + "\\b(1[1-9]\\d\\d|20\\d\\d)(\\s*[-–—]\\s*)(1[1-9]\\d\\d|20\\d\\d)\\b(?![.,]?\\d)"
        + "(?!\\s*(?:percent|kilometers?|meters?|km|kg|miles?|feet|ft|dollars?|usd|euros?))", "gi");
    private static readonly JsRe YEAR_CONTEXT = JsRegex.Compile(
        "\\b(in|of|since|from|until|till|by|before|after|around|circa|year|late|early|mid)(\\s+(?:the|a|an))?\\s+(1[1-9]\\d\\d|20\\d\\d)\\b(?![.,]?\\d)(?!\\s*(?:percent|kilometers?|meters?))", "gi");
    private static readonly JsRe YEAR_MONTH = JsRegex.Compile(
        $"\\b({MONTH_ALT})((?:\\s+\\d{{1,2}}(?:st|nd|rd|th))?,?)\\s+(1[1-9]\\d\\d|20\\d\\d)\\b(?![.,]?\\d)", "gi");
    private static readonly JsRe BARE_EXPONENT = JsRegex.Compile(
        "(\\d[\\d.,]*|(?<![A-Za-z])[A-Za-z]{1,3})\\s?(\\u207b?[\\u2070\\u00b9\\u00b2\\u00b3\\u2074-\\u2079]+)", "gu");
    private static readonly JsRe HAS_LOWER = JsRegex.Compile("[a-z]");
    private static readonly JsRe CAPS_ROMAN = JsRegex.Compile("\\b([A-Za-z][A-Za-z']*)\\s+([IVXLCDM]{2,})\\b", "g");
    private static readonly JsRe CAP_INITIAL = JsRegex.Compile("^[A-Z]");
    private static readonly JsRe LOWER_ROMAN = JsRegex.Compile(
        "\\b([a-z']+)\\s+(ii|iii|iv|vii|viii|ix|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\\b", "gi");
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("\\s*&amp;\\s*", "giu");
    private static readonly JsRe AMP = JsRegex.Compile("\\s*&\\s*", "gu");
    private static readonly JsRe TIMES_SIGN = JsRegex.Compile("(\\d)\\s*(×|x)\\s*(?=\\d)", "gu");
    private static readonly JsRe HAS_UNIT_TAIL = JsRegex.Compile("^\\d[\\d.,]*\\s?[A-Za-z]", "u");
    private static readonly JsRe HAS_SPACE = JsRegex.Compile("\\s", "u");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\d)\\s*÷\\s*(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\S)\\s*=\\s*(\\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(?=\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(?=\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "g");
    private static readonly JsRe ONE_EXACT = JsRegex.Compile("^1(?:\\.0+)?$");
    private static readonly JsRe ONE_INT = JsRegex.Compile("^1$");

    /** Normalize one English input string. Pure text→text; no IPA. */
    public static string NormalizeEnglish(string input)
    {
        var s = input;

        s = TITLE_ABBREV.Replace(s, m =>
        {
            var next = m.Groups[2].Value;
            return $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()](next)} {next}";
        });
        s = TITLE_ABBREV_END.Replace(s, m => m.Groups[1].Value.ToLowerInvariant() switch
        {
            "st" => "street", "dr" => "drive", _ => "mount",
        });
        s = SAINT_UNDOTTED.Replace(s, m =>
        {
            var next = m.Groups[1].Value;
            return ABBREV_FUNCTION_NEXT.IsMatch(next) ? m.Value : $"saint {next}";
        });

        s = PLAIN_MID.Replace(s, m => $"{PLAIN_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = PLAIN_END.Replace(s, m => $"{PLAIN_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");
        s = ET_AL_MID.Replace(s, "et al$1");
        s = ET_AL_END.Replace(s, "et al.");
        s = CIRCA.Replace(s, "circa ");
        s = NUMBER_SIGN.Replace(s, "number ");
        s = EG_MID.Replace(s, "for example$1");
        s = EG_END.Replace(s, "for example.");
        s = IE_MID.Replace(s, "that is$1");
        s = IE_END.Replace(s, "that is.");
        s = AM_PM.Replace(s, m => m.Groups[1].Value.ToLowerInvariant() == "a" ? "ay em" : "pee em");
        s = DOTTED_INITIALS.Replace(s, m => DOTS.Replace(m.Value, "").ToUpperInvariant());

        s = ERA.Replace(s, m => m.Value switch
        {
            "BCE" => "bee see ee", "BC" => "bee see", "CE" => "see ee", "AD" => "ay dee", _ => m.Value,
        });

        s = SPACE_GROUP.Replace(s, m => SPACE_GROUP_SEPS.Replace(m.Value, ""));

        s = SCI_EXPONENT.Replace(s, m =>
        {
            var ten = m.Groups[1].Value;
            var sup = m.Groups[2].Value;
            var digits = sup.StartsWith("-", StringComparison.Ordinal)
                ? sup
                : string.Concat(Js.CodePoints(sup).Select(c => SUPERSCRIPT_DIGIT[c]));
            var neg = digits.StartsWith("-", StringComparison.Ordinal);
            return $"{ten} to the power of {(neg ? $"negative {digits[1..]}" : digits)}";
        });

        s = NEGATIVE.Replace(s, "$1negative $2");
        s = PLUS_MINUS.Replace(s, "$1plus or minus $2");

        s = ISO_DATE.Replace(s, m =>
            IsoDate(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value), Js.Number(m.Groups[3].Value)) ?? m.Value);
        s = US_DATE.Replace(s, m =>
            IsoDate(Js.Number(m.Groups[3].Value), Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)) ?? m.Value);

        s = MONEY_CENTS.Replace(s, m =>
        {
            var sym = m.Groups[1].Value;
            var intPart = m.Groups[2].Value;
            var cents = m.Groups[3].Value;
            var forms = CURRENCY[sym];
            var unit = ONE_INT.IsMatch(COMMAS.Replace(intPart, "")) ? forms[0] : forms[1];
            return cents == "00" ? $"{intPart} {unit}" : $"{intPart} {unit} {Js.NumberToString(Js.Number(cents))}";
        });

        s = PLUS_ATTACHED.Replace(s, "$1 plus $2");
        s = PLUS_LEADING.Replace(s, "$1plus $2");

        s = FRACTION.Replace(s, m =>
            FractionWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)) ?? m.Value);

        s = CURRENCY_RE.Replace(s, m =>
        {
            var sym = m.Groups[1].Value;
            var num = m.Groups[2].Value;
            var spelled = m.Groups[3].Success ? m.Groups[3].Value : null;
            var abbrev = m.Groups[4].Success ? m.Groups[4].Value : null;
            var forms = CURRENCY[sym];
            var mag = spelled ?? (abbrev is null ? null : $" {MONEY_MAGNITUDE[abbrev]}");
            var one = ONE_EXACT.IsMatch(COMMAS.Replace(num, ""));
            return $"{num}{mag ?? ""} {(one && mag is null ? forms[0] : forms[1])}";
        });

        s = PERCENT.Replace(s, "$1 percent");

        s = CLOCK.Replace(s, m =>
        {
            var h = m.Groups[1].Value;
            var mm = m.Groups[2].Value;
            var suffix = m.Groups[3].Success ? m.Groups[3].Value : "";
            if (mm == "00") return suffix.Length > 0 ? $"{h}{suffix}" : $"{h} o'clock";
            if (mm.StartsWith("0", StringComparison.Ordinal)) return $"{h} oh {Js.NumberToString(Js.Number(mm))}{suffix}";
            return $"{h} {mm}{suffix}";
        });

        s = MONTH_DAY.Replace(s, m =>
        {
            var mon = m.Groups[1].Value;
            var d = m.Groups[2].Value;
            var n = Js.Number(d);
            if (n < 1 || n > 31) return m.Value;
            var suf = d.EndsWith("1", StringComparison.Ordinal) && n != 11 ? "st"
                : d.EndsWith("2", StringComparison.Ordinal) && n != 12 ? "nd"
                : d.EndsWith("3", StringComparison.Ordinal) && n != 13 ? "rd" : "th";
            return $"{mon} {d}{suf}";
        });

        s = YEAR_RANGE.Replace(s, m =>
        {
            double a = Js.Number(m.Groups[1].Value), b = Js.Number(m.Groups[3].Value);
            return b >= a ? $"{YearWords(a)}{m.Groups[2].Value}{YearWords(b)}" : m.Value;
        });
        s = YEAR_CONTEXT.Replace(s, m =>
        {
            var ctx = m.Groups[1].Value;
            var det = m.Groups[2].Success ? m.Groups[2].Value : null;
            var y = Js.Number(m.Groups[3].Value);
            return det is not null && y >= 2010 ? m.Value : $"{ctx}{det ?? ""} {YearWords(y)}";
        });
        s = YEAR_MONTH.Replace(s, m =>
            $"{m.Groups[1].Value}{m.Groups[2].Value} {YearWords(Js.Number(m.Groups[3].Value))}");

        s = UNIT_RE.Replace(s, m =>
        {
            var num = m.Groups[1].Value;
            var mag = m.Groups[2].Success ? m.Groups[2].Value : null;
            var u = m.Groups[3].Value;
            var exp = m.Groups[4].Success ? m.Groups[4].Value : null;
            var forms = NormalizeSymbols.ResolveUnitSymbol(UNITS, UNITS_FOLDED, u);
            if (forms is null) return m.Value; // unresolvable → leave the text alone
            var measure = exp == "²" || exp == "2" ? "square " : exp == "³" || exp == "3" ? "cubic " : "";
            var one = mag is null && ONE_EXACT.IsMatch(COMMAS.Replace(num, ""));
            return $"{num}{mag ?? ""} {measure}{(one ? forms[0] : forms[1])}";
        });

        s = BARE_EXPONENT.Replace(s, m =>
        {
            var bas = m.Groups[1].Value;
            var digits = string.Concat(Js.CodePoints(m.Groups[2].Value).Select(c => SUPERSCRIPT_DIGIT[c]));
            var neg = digits.StartsWith("-", StringComparison.Ordinal);
            var mag = neg ? digits[1..] : digits;
            var power = neg ? $"negative {mag}" : mag;
            return mag == "2" && !neg ? $"{bas} squared"
                : mag == "3" && !neg ? $"{bas} cubed"
                : $"{bas} to the power of {power}";
        });

        if (HAS_LOWER.IsMatch(s))
        {
            s = CAPS_ROMAN.Replace(s, m =>
            {
                var prev = m.Groups[1].Value;
                var n = Roman.RomanToInt(m.Groups[2].Value);
                if (n is null) return m.Value;
                var evidence = ROMAN_CARDINAL_CTX.IsMatch(prev) || CAP_INITIAL.IsMatch(prev);
                if (!evidence) return m.Value;
                if (ROMAN_CARDINAL_CTX.IsMatch(prev)) return $"{prev} {n}";
                var v = n.Value;
                var suf = v % 10 == 1 && v % 100 != 11 ? "st" : v % 10 == 2 && v % 100 != 12 ? "nd"
                    : v % 10 == 3 && v % 100 != 13 ? "rd" : "th";
                return $"{prev} the {v}{suf}";
            });
        }

        s = LOWER_ROMAN.Replace(s, m =>
        {
            var prev = m.Groups[1].Value;
            var n = ROMAN[m.Groups[2].Value.ToLowerInvariant()];
            if (ROMAN_CARDINAL_CTX.IsMatch(prev)) return $"{prev} {n}";
            var suf = n % 10 == 1 && n != 11 ? "st" : n % 10 == 2 && n != 12 ? "nd" : n % 10 == 3 && n != 13 ? "rd" : "th";
            return $"{prev} the {n}{suf}";
        });

        s = AMP_ENTITY.Replace(s, " and ");
        s = AMP.Replace(s, " and ");
        s = TIMES_SIGN.Replace(s, m =>
        {
            var left = m.Groups[1].Value;
            var sign = m.Groups[2].Value;
            var tail = s[(m.Index + m.Value.Length)..];
            var hasUnit = HAS_UNIT_TAIL.IsMatch(tail);
            var unspacedAscii = sign == "x" && !HAS_SPACE.IsMatch(m.Value);
            return $"{left} {(hasUnit || unspacedAscii ? "by" : "times")} ";
        });
        s = DIVIDE.Replace(s, "$1 divided by ");
        s = EQUALS.Replace(s, "$1 equals $2");
        s = LESS_THAN.Replace(s, "$1 less than ");
        s = GREATER_THAN.Replace(s, "$1 greater than ");

        return s;
    }

    /** English phonotactics, for the fail-safe guard in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadableEnglish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouy]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "ch", "cl", "cr", "dr", "dw", "fl", "fr", "gh", "gl", "gr", "gn", "kn", "kl", "kr",
            "ph", "pl", "pr", "ps", "qu", "rh", "sc", "sh", "sk", "sl", "sm", "sn", "sp", "sq", "st", "sv",
            "sw", "th", "tr", "tw", "vl", "wh", "wr", "zl",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ch", "ck", "ct", "ff", "ft", "gh", "gs", "ks", "ld", "lf", "lk", "ll", "lm", "ln", "lp", "ls",
            "lt", "lv", "mb", "mn", "mp", "ms", "nc", "nd", "ng", "nk", "ns", "nt", "ph", "pt", "ps", "rb",
            "rc", "rd", "rf", "rg", "rk", "rl", "rm", "rn", "rp", "rs", "rt", "rv", "sh", "sk", "sm", "sp",
            "ss", "st", "th", "ts", "tt", "xt", "zz", "bs", "ds", "ls", "nx", "mf", "lb", "rth", "nth",
        }, StringComparer.Ordinal),
    });

    private static readonly JsRe SINGLE_LOWER_LETTER = JsRegex.Compile("^[a-z]$");

    /** Letter names. */
    private static string? LetterName(string l) =>
        SINGLE_LOWER_LETTER.IsMatch(l) ? (l == "a" ? "ay" : l) : null;

    /** LEXICAL: acronyms spelled out although their lowercase form is a dictionary word. Authored in
     *  english.jsonc alongside the language's other hand-authored facts, not here. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    /** INITIALISMS. */
    public static string NormalizeEnglishInitialisms(string text, Func<string, bool> isRecorded) =>
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = LetterName,
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = isRecorded,
            IsUnreadable = w => IsUnreadableEnglish(w),
        })(text);
}
