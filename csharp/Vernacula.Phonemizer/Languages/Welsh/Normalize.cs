/**
 * Welsh (cy) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Ported from src/languages/welsh/normalize.ts — see that file for the measured evidence behind every rule.
 *
 * ⚠ THE DEFINING RULES: the VIGESIMAL ordinal (60fed reads trigainfed, not chwe degfed), the comma-thousands
 * (Welsh groups with commas; the dot is a decimal "pwynt"), the era markers O.C./C.C., the p.m./a.m. clocks,
 * the -au decades, and the letter-spelled initialisms.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Welsh;

public static class Normalize
{
    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // DATA
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Welsh letter names — the standard alphabet, per the National Reading System. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "bi", ["c"] = "ec", ["d"] = "edi", ["e"] = "e", ["f"] = "ef", ["g"] = "eg",
        ["h"] = "aitsh", ["i"] = "i", ["j"] = "je", ["k"] = "ec", ["l"] = "el", ["m"] = "em", ["n"] = "en",
        ["o"] = "o", ["p"] = "pi", ["q"] = "fi", ["r"] = "er", ["s"] = "es", ["t"] = "ti", ["u"] = "u",
        ["v"] = "fi", ["w"] = "u ddybl", ["x"] = "ecs", ["y"] = "y", ["z"] = "zed",
    };

    /** Welsh phonotactics, for the OOV rule in Core/Initialisms.cs (can this letter run be a word at all?). */
    public static readonly Func<string, bool> IsUnreadableWelsh = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouwyâêîôûŵŷàèìòùïëöäü]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "gw", "pl", "pr", "sb", "sc", "sg",
            "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw", "ch", "dd", "ff", "ll", "ph", "rh", "th",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "b", "d", "f", "g", "l", "m", "n", "p", "r", "s", "t", "v", "w", "y", "x", "ch", "dd", "ff",
            "ll", "ng", "ph", "th", "nt", "st", "mb", "nd", "rd", "ld", "mp", "nc", "ng",
            "bl", "ml", "dl", "fl", "gl", "tl", "fn", "lt", "sg", "rn", "sb", "tr", "str",
        }, StringComparer.Ordinal),
        // ONE phoneme each — see PhonotacticsData.Digraphs.
        Digraphs = new HashSet<string>(new[]
        {
            "ch", "dd", "ff", "ng", "ll", "ph", "rh", "th", "si", "nh", "mh", "ngh",
        }, StringComparer.Ordinal),
    });

    /** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(new[] { "nato", "covid", "fifa", "opec", "unesco", "aids", "laser" }, StringComparer.Ordinal);

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(Js.ToLowerCase(l), out var v) ? v : null,
        AcronymLetters = new HashSet<string>(new[]
        {
            // US/AU agencies and Olympic bodies (letter-said, not words like "uda")
            "usoc", "usgs", "usaf", "usda", "upa", "faa", "nsa", "usc",
            // media and telecoms
            "cbs", "cctv", "cnn", "bbc", "itv", "s4c", "csi", "qvc", "aol",
            // medical and legal
            "add", "mri", "acpa", "mip", "aclu",
            // sports leagues
            "afc", "nfl", "nba", "nhl", "mlb", "mls",
            // organisations that are said as letters in Welsh text
            "cep", "oha", "acta", "meti", "fic", "knu", "knp", "nsw", "npws", "aub", "us", "ucla", "pa",
            // codes
            "xdr-tb", "as", "afo", "awc",
        }, StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = w => IsUnreadableWelsh(w),
    });

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE VIGESIMAL ORDINAL
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Ordinal words 1–19, masculine. Vigesimal (index 0 unused; the 0 form is "dimfed", below). */
    private static readonly string[] ORD_1_19 =
    {
        "", "cyntaf", "ail", "trydydd", "pedwerydd", "pumed", "chweched", "seithfed", "wythfed", "nawfed",
        "degfed", "unfed ar ddeg", "deuddegfed", "trydydd ar ddeg", "pedwerydd ar ddeg", "pymthegfed",
        "unfed ar bymtheg", "ail ar bymtheg", "deunawfed", "pedwerydd ar bymtheg",
    };

    /** The compound 1–19 base used INSIDE a vigesimal block: 21 is *unfed ar hugain* (not *cyntaf*). */
    private static readonly string[] ORD_COMPOUND = BuildOrdCompound();

    private static string[] BuildOrdCompound()
    {
        var a = (string[])ORD_1_19.Clone();
        a[1] = "unfed";
        return a;
    }

    /** The round vigesimal tens — and nothing else. The non-round 40s–90s have inconsistent connectors and
     *  the corpus writes no such digit, so they return null. */
    private static readonly IReadOnlyDictionary<int, string> ROUND_TENS = new Dictionary<int, string>
    {
        [20] = "ugeinfed", [30] = "degfed ar hugain", [40] = "deugainfed", [50] = "degfed ar ddeugain",
        [60] = "trigainfed", [70] = "degfed ar trigain", [80] = "pedwar ugeinfed", [90] = "degfed a phedwar ugain",
    };

    /** Integer → the vigesimal ordinal. ATTESTED FORMS ONLY, and every branch pinned; anything else → null,
     *  so the caller leaves the digit untouched rather than emitting a guess the corpus never exercises. */
    public static string? OrdinalWords(double n)
    {
        if (!Numbers.IsSafeInteger(n) || n < 0) return null;
        if (n <= 19) return n == 0 ? "dimfed" : ORD_1_19[(int)n];
        if (n == 20) return ROUND_TENS[20]; // the branch BOUNDARY: `low` is 0 here, so the 21-39 arm below
                                            // returned null and ugeinfed was unreachable.
        if (n < 40)
        {
            // 21–39: the compound 1–19 base + "ar hugain". 31 = unfed ar ddeg ar hugain (11 on 20),
            // 37 = ail ar bymtheg ar hugain (17 on 20).
            var low = n - 20;
            if (low < 1 || low > 19) return null;
            return $"{ORD_COMPOUND[(int)low]} ar hugain";
        }
        if (n < 100) return ROUND_TENS.TryGetValue((int)n, out var t) ? t : null;
        if (n == 100) return "canfed";
        if (n == 200) return "dau ganfed";
        if (n == 190) return "degfed a naw ugain"; // 10 a naw ugain — the corpus's only >100 ordinal
        if (n == 1000) return "milfed";
        return null;
    }

    /**
     * SOFT MUTATION (treiglad meddal) of a word's initial consonant. Obligatory after the preposition `i` (to).
     *
     * THE DIGRAPHS COME FIRST and this is the whole trap: `ch`, `dd`, `ff`, `ng`, `ph`, `th` do not mutate,
     * so `chwech` must not be read as c → g (*ghwech*), while `ll` → `l` and `rh` → `r` do mutate.
     */
    public static string Soften(string text)
    {
        var two = Js.ToLowerCase(text.Length >= 2 ? text[..2] : text);
        if (two == "ll") return "l" + (text.Length > 2 ? text[2..] : "");
        if (two == "rh") return "r" + (text.Length > 2 ? text[2..] : "");
        if (two is "ch" or "dd" or "ff" or "ng" or "ph" or "th") return text;
        var SOFT = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["p"] = "b", ["t"] = "d", ["c"] = "g", ["b"] = "f", ["d"] = "dd", ["g"] = "", ["m"] = "f",
        };
        return SOFT.TryGetValue(Js.ToLowerCase(text[0].ToString()), out var soft) ? soft + text[1..] : text;
    }

    /** The tier's unit words, needed when a rule converts a number to WORDS and so breaks the number-unit
     *  adjacency the shared tier matches on. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "cilometr", ["kg"] = "cilogram", ["mm"] = "milimetr", ["cm"] = "centimetr", ["m"] = "metr",
    };

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE PATTERNS
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    private static readonly JsRe OC_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])O\\.C\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe CC_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])C\\.C\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe OC_RANGE = JsRegex.Compile("(?<![\\p{L}\\p{M}])OC(?=\\s*(?:\\d+)\\s*[–-]\\s*\\d+)", "giu");
    private static readonly JsRe AUD_PREFIX = JsRegex.Compile("(?<![\\p{L}\\p{M}])AUD\\$?(?=\\s?\\d)", "giu");
    private static readonly JsRe US_PREFIX = JsRegex.Compile("(?<![\\p{L}\\p{M}])US\\$?(?=\\s?\\d)", "giu");
    private static readonly JsRe UD_DOTTED = JsRegex.Compile("(?<![\\p{L}\\p{M}])U\\.D\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe UD_BARE = JsRegex.Compile("(?<![\\p{L}\\p{M}])UD(?=[\\s,.]|$)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DU_ABBR = JsRegex.Compile("(?<![\\p{L}\\p{M}])DU(?=[\\s,.]|$)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe UDA_ABBR = JsRegex.Compile("(?<![\\p{L}\\p{M}])UDA(?=[\\s,.]|$)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AS_ABBR = JsRegex.Compile("(?<![\\p{L}\\p{M}])AS(?=[\\s,.]|$)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[ \\u00a0]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOTTED_CAPS_MARKS = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe LONE_INITIAL_DOT = JsRegex.Compile("(?<=\\p{Lu})\\.(?=\\s+\\p{Lu})", "gu");
    private static readonly JsRe AYB_MID = JsRegex.Compile("(?<![\\p{L}\\p{M}])ayb\\.(\\s+)(?=[\\p{L}\\d])", "giu");
    private static readonly JsRe AYB_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])ayb\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe ORDINAL = JsRegex.Compile("(?<![\\d.,])(\\d[\\d,]*)(fed|ed|af|eg|ydd|ain)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe DECADE = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])(\\d[\\d,]*)(au)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe TZ_HYPHEN = JsRegex.Compile("(?<=\\p{L})[-–](?=\\d)", "gu");
    private static readonly JsRe CLOCK_RANGE = JsRegex.Compile(
        "(?<![\\d:,])([01]?\\d|2[0-3]):([0-5]\\d)\\s*[-–]\\s*([01]?\\d|2[0-3]):([0-5]\\d)(?![:.\\d])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\d.,])(\\d(?:[\\d,]*\\d)?)\\s*[-–]\\s*(\\d(?:[\\d,]*\\d)?)(?![\\d]|\\.\\d)(\\s?(?:km|kg|mm|cm|m)(?![\\p{L}\\p{M}]))?(?![%\\p{Sc}])", "gu");
    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        "(?<![\\d:,])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.\\d])(?:\\s*(p\\.?m\\.?|a\\.?m\\.?)(?![\\p{L}\\p{M}]))?", "giu");
    private static readonly JsRe CLOCK_TZ = JsRegex.Compile("(?<![\\d.,])([01]?\\d|2[0-3])\\.([0-5]\\d)\\s*(UTC|GMT)", "giu");
    private static readonly JsRe DECIMAL_RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+\\.\\d+)\\s*[-–]\\s*(\\d+\\.\\d+)(?![\\d.])", "gu");
    private static readonly JsRe GIGAHERTZ = JsRegex.Compile("(?<![\\d.,])(\\d+\\.\\d+)\\s?Ghz?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe VERSION_LETTER = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?=[a-z](?![\\p{L}\\p{M}]))", "giu");
    private static readonly JsRe DECIMAL_UNIT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)\\s?(km|m|kg|mm|cm)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DECIMAL_PLAIN = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d.])", "giu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");
    private static readonly JsRe THREE_QUARTERS = JsRegex.Compile("(\\d+)¾", "gu");
    private static readonly JsRe ONE_HALF = JsRegex.Compile("(\\d+)½", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?[°º]\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?[°º]\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?[°º](?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RATE_KMH = JsRegex.Compile("(?<![\\p{L}\\p{M}])cilomedr\\/awr(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RATE_LLATH = JsRegex.Compile("(?<![\\p{L}\\p{M}])llath\\/metr(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{Nd}])[-−](\\d+)(?!\\s*[-\\d])", "gu");
    private static readonly JsRe AMP_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})&(\\p{Lu})(s?)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMP_SPACED = JsRegex.Compile("\\s&\\s", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\S)\\s*=\\s*(\\S)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\S)\\s*÷\\s*(\\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(\\d)", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACE = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** The fraction digits of a decimal, read one at a time. */
    private static string SpellDigits(string f) =>
        string.Join(" ", Js.CodePoints(f).Select(d => Numbers.NumberToWords(Js.Number(d))));

    private static string ClockWords(string h, string min) =>
        Js.Number(min) == 0
            ? Numbers.NumberToWords(Js.Number(h))
            : $"{Numbers.NumberToWords(Js.Number(h))} {Numbers.NumberToWords(Js.Number(min))}";

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE PASS
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Normalize one Welsh input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
    public static string NormalizeWelsh(string input)
    {
        var s = input;

        // 1) ERA MARKERS — `O.C.` (Oed Crist, AD) and `C.C.` (Cyn Crist, BC), plus the undotted `OC` range
        //    form. FIRST, before the dotted-capital rule: otherwise the interior dot becomes a break.
        s = Rewrite(s, OC_DOTTED, "Oed Crist");
        s = Rewrite(s, CC_DOTTED, "Cyn Crist");
        s = Rewrite(s, OC_RANGE, "Oed Crist");

        // 1b) CURRENCY PREFIXES and the bare `UD`/`U.D.` (yr Unol Daleithiau = the US).
        s = Rewrite(s, AUD_PREFIX, "doler Awstralia ");
        s = Rewrite(s, US_PREFIX, "doler yr Unol Daleithiau ");
        s = Rewrite(s, UD_DOTTED, "Unol Daleithiau");
        s = Rewrite(s, UD_BARE, "Unol Daleithiau");

        // 1c) WELSH ABBREVIATIONS with STANDARD EXPANSIONS. CASE-SENSITIVE: the lowercase "du" is the Welsh
        //     for "black" and "as" is a real word — only the UPPERCASE abbreviations expand.
        s = Rewrite(s, DU_ABBR, "Deyrnas Unedig");
        s = Rewrite(s, UDA_ABBR, "Unol Daleithiau America");
        s = Rewrite(s, AS_ABBR, "Aelod Seneddol");

        // 2) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
        //    ⚠ THE INNER `Replace` IS `JsRe.Replace`: its subject is the MATCHED RUN, not the pipeline
        //    string, so the seam is not declared for it.
        s = Rewrite(s, DOTTED_CAPS, m => DOTTED_CAPS_MARKS.Replace(m.Value, ""));
        //    ⚠ `\p{Lu}`, NOT `[A-Z]` — here it is Welsh's own circumflexed ⟨Â Ê Î Ô Û Ŵ Ŷ⟩.
        s = Rewrite(s, LONE_INITIAL_DOT, "");

        // 3) SINGLE-DOT ABBREVIATIONS. `ayb.` = ac yn y blaen (etc.).
        s = Rewrite(s, AYB_MID, "ac yn y blaen$1");
        s = Rewrite(s, AYB_END, "ac yn y blaen.");

        // 4) ORDINALS — the `Naf`/`Nydd`/`Ned`/`Nfed`/`Neg`/`Nain` form. BEFORE the clock rule so a digit
        //    run is not first claimed as a time.
        s = Rewrite(s, ORDINAL, m =>
        {
            var n = Js.Number(COMMAS.Replace(m.Groups[1].Value, "")); // a matched group, not the pipeline string
            if (!double.IsFinite(n) || n < 0 || n >= 100000) return m.Value;
            var ord = OrdinalWords(n);
            return ord is null ? m.Value : ord;
        });

        // 5) DECADES — `1970au`, `1920au`, `90au`. Read as the decade number (the -au is a plural of the year).
        s = Rewrite(s, DECADE, "$1");

        // 5a) THE TIMEZONE-OFFSET HYPHEN IS A SIGN, NOT A WORD HYPHEN — `UTC-08:00`, `GMT-0:44`. Settled
        //     HERE, before the clock rule turns the digits into WORDS.
        //     ⚠ Gated on a preceding LETTER and a following DIGIT: a hyphen between two letter runs is
        //     load-bearing elsewhere in the fleet, which is why this is not a shared rule.
        s = Rewrite(s, TZ_HYPHEN, " ");

        // 5b) RANGES and SCORES — `6-6`, `5-3`, `1894-1895`, `10:00-11:00`, `10-60 munud`. The joiner `i`
        //     MUTATES what follows it, which a digit-level `$1 i $2` cannot do — the SECOND operand is
        //     emitted as words here and softened. The clock range is claimed first, for the same reason.
        s = Rewrite(s, CLOCK_RANGE, m =>
        {
            var m1 = Js.Number(m.Groups[2].Value);
            var m2 = Js.Number(m.Groups[4].Value);
            return m1 > 59 || m2 > 59
                ? m.Value
                : $"{ClockWords(m.Groups[1].Value, m.Groups[2].Value)} i {Soften(ClockWords(m.Groups[3].Value, m.Groups[4].Value))}";
        });
        s = Rewrite(s, RANGE, m =>
        {
            var n = Js.Number(COMMAS.Replace(m.Groups[2].Value, ""));
            if (!Numbers.IsSafeInteger(n)) return m.Value;
            var words = Numbers.NumberToWords(n);
            if (words == "" || HAS_DIGIT.IsMatch(words)) return m.Value;
            // The pattern carries no `i`, so the captured unit is always one of the table's own keys — the
            // miss branch is the defensive guard against the TS's `!` stringifying a miss as "undefined".
            var u = m.Groups[3].Success && UNIT_WORD.TryGetValue(Js.ToLowerCase(m.Groups[3].Value.Trim()), out var uw)
                ? $" {uw}" : "";
            return $"{m.Groups[1].Value} i {Soften(words)}{u}";
        });

        // 6) CLOCK, in the COLON form. The p.m./a.m. marker (WITH the dots) expands to the Welsh time-of-day.
        //    THE MARKER NEEDS A BOUNDARY: `a\.?m\.?` with nothing after it matched the first two letters of a
        //    following Welsh word (`11:00 amser` read as a time-of-day and ate half a word).
        s = Rewrite(s, CLOCK, m =>
        {
            var hv = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            if (hv > 23 || mv > 59) return m.Value;
            var head = ClockWords(m.Groups[1].Value, m.Groups[2].Value);
            var apLower = Js.ToLowerCase(m.Groups[3].Success ? m.Groups[3].Value : "");
            var suffix = apLower.StartsWith("p", StringComparison.Ordinal) ? " y prynhawn"
                : apLower.StartsWith("a", StringComparison.Ordinal) ? " y bore" : "";
            return $"{head}{suffix}";
        });

        // 6b) CLOCK, in the DOT form before a timezone — `15.00 UTC`, `12.00 GMT`. BEFORE the version-dot
        //     rule so it is not claimed as "15 pwynt 00".
        s = Rewrite(s, CLOCK_TZ, m => $"{ClockWords(m.Groups[1].Value, m.Groups[2].Value)} {m.Groups[3].Value}");

        // 7) VERSION DOTS and DOT DECIMALS. Read "pwynt" (point), with the FRACTION read digit-by-digit.
        //    GIGAHERTZ and the version letters are claimed FIRST on the raw digits, because this rule
        //    converts the fraction to WORDS that the unit rules can no longer see.
        s = Rewrite(s, DECIMAL_RANGE, "$1 i $2");
        s = Rewrite(s, GIGAHERTZ, "$1 gigahertz");
        // A VERSION LETTER after the fraction (802.11n) is a separate letter, not glued to the last digit —
        // emit it spaced so it reads as the letter name n.
        s = Rewrite(s, VERSION_LETTER, m => $"{m.Groups[1].Value} pwynt {SpellDigits(m.Groups[2].Value)} ");
        // A DECIMAL with a UNIT — `12.8 km`. ⚠ UNITS ARE RESOLVED BEFORE DECIMALS: converting the number to
        // words breaks the tier's number-unit adjacency, so the unit's WORD must be claimed here.
        // ⚠ THE PATTERN CARRIES `i`+`u` AND IS BUILT FROM THIS TABLE'S OWN KEYS, SO A WIDENED-FOLD NEAR-MISS
        // CAN MATCH A KEY THE TABLE NEVER HAD (the `!` in the TS spoke the word "undefined" on such a miss).
        // A table of readings: refuse the whole match.
        s = Rewrite(s, DECIMAL_UNIT, m =>
        {
            if (!UNIT_WORD.TryGetValue(Js.ToLowerCase(m.Groups[3].Value), out var uw)) return m.Value;
            return $"{m.Groups[1].Value} pwynt {SpellDigits(m.Groups[2].Value)} {uw}";
        });
        s = Rewrite(s, DECIMAL_PLAIN, m => $"{m.Groups[1].Value} pwynt {SpellDigits(m.Groups[2].Value)}");

        // 7b) COMMA-DECIMALS — `12,5`. A European-style comma-decimal must not LEAK the comma as a clause
        //     pause: it reads "pwynt" like the dot. A comma followed by a THREE-digit group is thousands
        //     (1,400) and stays for the TOKEN — this rule claims only 1-2 digit fractions.
        s = Rewrite(s, DECIMAL_COMMA, m => $"{m.Groups[1].Value} pwynt {SpellDigits(m.Groups[2].Value)}");

        // 8) FRACTIONS. `1/5 modfedd` → *un pumed*. The denominator's word is the FRACTION NOUN, which is
        //    the ordinal for 5+ but a separate noun for 3 and 4 (traean, chwarter).
        s = Rewrite(s, THREE_QUARTERS, "$1 a thri chwarter");
        s = Rewrite(s, ONE_HALF, "$1 a hanner");
        s = Rewrite(s, FRACTION, m =>
        {
            var num = Js.Number(m.Groups[1].Value);
            var den = Js.Number(m.Groups[2].Value);
            if (den == 2) return num == 1 ? "hanner" : $"{Numbers.NumberToWords(num)} hanner";
            var noun = den == 3 ? "traean" : den == 4 ? "chwarter" : OrdinalWords(den);
            if (noun is null) return m.Value;
            return $"{Numbers.NumberToWords(num)} {noun}";
        });

        // 9) DEGREES. `gradd` is the degree word.
        s = Rewrite(s, DEG_C, "$1 gradd Celsius");
        s = Rewrite(s, DEG_F, "$1 gradd Ffahrenheit");
        s = Rewrite(s, DEG_BARE, "$1 gradd");

        // 10) RATES.
        s = Rewrite(s, RATE_KMH, "cilomedr yr awr");
        s = Rewrite(s, RATE_LLATH, "llath neu fetr");

        // 11) SIGNS. ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside
        //    it. The reading is this language's own two words juxtaposed — SIGN names rather than OPERATION
        //    names: ± marks a TOLERANCE, not an addition.
        s = Rewrite(s, PLUS_MINUS, " plws minws ");
        s = Rewrite(s, PLUS, " plws ");
        // ⚠ U+2212 IS IN THE CLASS AND THE ASCII HYPHEN'S GUARDS ARE UNCHANGED. The hyphen is the ambiguous
        // one and keeps every guard it had, so a range and a negative exponent are still refused.
        s = Rewrite(s, MINUS, "minws $1");
        s = Rewrite(s, AMP_CAPS, m =>
            $"{LetterName(m.Groups[1].Value)} a {LetterName(m.Groups[2].Value)}{m.Groups[3].Value}");
        s = Rewrite(s, AMP_SPACED, " a ");
        s = Rewrite(s, EQUALS, "$1 yn hafal i $2");
        // THE DIVISION SIGN — the reading is this language's own ("a rhannu â b"), corpus- and
        // register-attested.
        s = Rewrite(s, DIVIDE, "$1 rhannu â $2");
        s = Rewrite(s, LESS_THAN, "$1 yn llai na $2");
        s = Rewrite(s, GREATER_THAN, "$1 yn fwy na $2");
        s = Rewrite(s, TIMES, "$1 gwaith $2");

        // 12) INITIALISMS, LAST of the letter rules: after the era markers and after the dotted-capital rule.
        s = NormalizeInitialisms(s);

        // A padded replacement (` plws `, ` a `) doubles a space that was already there.
        return Rewrite(Rewrite(s, SPACE_RUN, " "), EDGE_SPACE, "");
    }

    private static string LetterName(string c) =>
        LETTER_NAME.TryGetValue(Js.ToLowerCase(c), out var v) ? v : c;
}
