/**
 * Swedish (sv) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Swedish g2p cannot
 * read into Swedish words. Pure text→text; the steps are ORDER-DEPENDENT.
 * Ported from src/languages/swedish/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Swedish;

public static class Normalize
{
    private static string HUNDRED => Manifest.MANIFEST.Numbers.Hundred; // "hundra"
    private static string THOUSAND => Manifest.MANIFEST.Numbers.Thousand; // "tusen"

    /** Ordinals 1–19, the irregular table; index 0 is empty. */
    private static readonly string[] ORD_1_19 =
    [
        "", "första", "andra", "tredje", "fjärde", "femte", "sjätte", "sjunde", "åttonde", "nionde",
        "tionde", "elfte", "tolfte", "trettonde", "fjortonde", "femtonde", "sextonde", "sjuttonde",
        "artonde", "nittonde",
    ];

    /** Swedish ordinal for 1 … 100, or null above it. Three branches: the irregular table below 20, the
     *  round tens (cardinal + -nde), and the tens-plus-unit compound. */
    public static string? Ordinal(double n)
    {
        if (n < 1 || !double.IsInteger(n)) return null;
        if (n < 20) return ORD_1_19[(int)n];
        if (n == 100) return $"{HUNDRED}de"; // hundrade
        if (n > 99) return null;
        var tens = Manifest.MANIFEST.Numbers.Tens[(int)Math.Floor(n / 10)];
        var unit = (int)(n % 10);
        return unit == 0 ? $"{tens}nde" : $"{tens}{ORD_1_19[unit]}";
    }

    /** A year in the HUNDREDS reading, as ONE compound word. 1000–1099 takes `tusen`, not *tiohundra*. */
    public static string? HundredsYear(double n)
    {
        if (!double.IsInteger(n)) return null;
        if (n >= 100 && n < 1000) return Numbers.NumberToWords(n); // åttahundra — one word already
        var rest = n % 100;
        var tail = rest != 0 ? Numbers.NumberToWords(rest) : "";
        if (n >= 1000 && n < 1100) return $"{THOUSAND}{tail}"; // tusen, tusenfemtio
        if (n >= 1100 && n < 2000) return $"{Numbers.NumberToWords(Math.Floor(n / 100))}{HUNDRED}{tail}";
        return null;
    }

    /** TS `type KeepFinal = "terminal"` — the abbreviations whose dot may also be the sentence period. */
    private const string TERMINAL = "terminal";

    private static readonly (JsRe Re, string Word, string? KeepFinal)[] ABBREV =
    [
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])f\\.v\\.t\\.", "giu"), "före vår tidräkning", TERMINAL),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])t\\.o\\.m\\.", "giu"), "till och med", null),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])f\\.\\s?Kr\\.", "giu"), "före Kristus", TERMINAL),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])e\\.\\s?Kr\\.", "giu"), "efter Kristus", TERMINAL),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])t\\.\\s?ex\\.", "giu"), "till exempel", null),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])s\\.\\s?k\\.", "giu"), "så kallad", null),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])dvs\\.?", "giu"), "det vill säga", null),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])osv\\.?", "giu"), "och så vidare", TERMINAL),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])etc\\.", "giu"), "etcetera", TERMINAL),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])fvt(?![\\p{L}\\p{M}])", "gu"), "före vår tidräkning", null),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])kl\\.\\s*", "giu"), "klockan ", null),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])Jr\\.", "gu"), "junior", null),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])St\\.(?=\\s+\\p{Lu})", "gu"), "Sankt", null),
    ];

    private static readonly JsRe CLOSERS = JsRegex.Compile("^[\"”'’)\\]]+", "u");
    private static readonly JsRe SENTENCE_START = JsRegex.Compile("^\\s+[\"“(]?\\p{Lu}", "u");

    /** Relational and operator signs — zero corpus instances; read anyway, because a dropped sign is inaudible. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    [
        (JsRegex.Compile("±", "gu"), " plus minus "),
        (JsRegex.Compile("≈", "gu"), " cirka lika med "),
        (JsRegex.Compile("≤", "gu"), " mindre än eller lika med "),
        (JsRegex.Compile("≥", "gu"), " större än eller lika med "),
        (JsRegex.Compile("=", "gu"), " lika med "),
        (JsRegex.Compile("<", "gu"), " mindre än "),
        (JsRegex.Compile(">", "gu"), " större än "),
        (JsRegex.Compile("×", "gu"), " gånger "),
        (JsRegex.Compile("÷", "gu"), " delat med "),
    ];

    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "se", ["d"] = "de", ["e"] = "e", ["f"] = "eff", ["g"] = "gé",
        ["h"] = "hå", ["i"] = "i", ["j"] = "ji", ["k"] = "kå", ["l"] = "ell", ["m"] = "emm", ["n"] = "enn",
        ["o"] = "o", ["p"] = "pe", ["q"] = "ku", ["r"] = "err", ["s"] = "ess", ["t"] = "te", ["u"] = "u",
        ["v"] = "ve", ["w"] = "dubbel ve", ["x"] = "eks", ["y"] = "y", ["z"] = "säta", ["å"] = "å",
        ["ä"] = "ä", ["ö"] = "ö",
    };

    /** Swedish phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
    public static readonly Func<string, bool> IsUnreadableSwedish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouyåäöé]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bj", "bl", "br", "dj", "dr", "dv", "fj", "fl", "fr", "gj", "gl", "gn", "gr", "hj", "kj", "kl",
            "kn", "kr", "kv", "lj", "mj", "nj", "pl", "pr", "ps", "sc", "sf", "sj", "sk", "sl", "sm", "sn",
            "sp", "st", "sv", "tj", "tr", "tv", "vr",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "bb", "ck", "dd", "ff", "ft", "gg", "gn", "ht", "kk", "ks", "kt", "ld", "lf", "lg", "lk", "ll",
            "lm", "lp", "ls", "lt", "lv", "mm", "mp", "ms", "mt", "nd", "ng", "nk", "nn", "ns", "nt", "pp",
            "ps", "pt", "rd", "rg", "rk", "rl", "rm", "rn", "rp", "rr", "rs", "rt", "rv", "sk", "sp", "ss",
            "st", "tt", "ts",
            "gt", "bt", "mn", "vs", "sm", "ln", "ds", "gs", "lj", "ch", "vt",
        }, StringComparer.Ordinal),
        Digraphs = new HashSet<string>(new[] { "sj", "sk", "stj", "skj", "tj", "kj", "ng", "ch", "sh", "rs" },
            StringComparer.Ordinal),
    });

    /** Acronyms read letter-by-letter although their lowercase form is pronounceable. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(new[] { "usa", "os", "ai", "usoc" }, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = w => IsUnreadableSwedish(w),
    });

    /** Swedish has no pronunciation dictionary recording ACRONYM readings, so `isRecorded` is always false and
     *  the lexical facts live entirely in ACRONYM_LETTERS. Must run after the Roman-numeral pass and after
     *  abbreviation expansion — see the TS. */
    public static string NormalizeSwedishInitialisms(string text) => InitialismNormalizer(ResolveColonInflection(text));

    private static readonly JsRe COLON_INFLECTION =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{L}[\\p{L}\\p{M}]*):(s|n)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ALL_CAPS_2PLUS = JsRegex.Compile("^\\p{Lu}{2,}$", "u");

    /** The Swedish colon as an INFLECTIONAL JOINT (`USA:s`, `TV:n`) — not a pause. */
    private static string ResolveColonInflection(string text) => COLON_INFLECTION.Replace(text, m =>
    {
        string head = m.Groups[1].Value, suf = m.Groups[2].Value;
        var glued = $"{head}{suf}";
        if (!ALL_CAPS_2PLUS.IsMatch(head)) return glued;
        var lower = head.ToLowerInvariant();
        if (!ACRONYM_LETTERS.Contains(lower) && !IsUnreadableSwedish(lower)) return glued;
        var names = Js.CodePoints(lower).Select(l => LETTER_NAME.TryGetValue(l, out var v) ? v : null).ToList();
        return names.All(x => x is not null) ? $"{string.Join(" ", names)}{suf}" : glued;
    });

    // ── THE PASS ────────────────────────────────────────────────────────────────────────────────────────

    /** A clock's minute field — `00` as two zeros (*noll noll*), which is what Swedish says. */
    private static string Minutes(string mm) => mm == "00" ? "0 0" : mm;

    private static bool IsClock(string h, string mm) => Js.Number(h) < 24 && Js.Number(mm) < 60;

    private static readonly JsRe SPACE_GROUP = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[ \\u00a0\\u202f\\u2009](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe COMMA_GROUP = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[,](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe SPORTS_TIME = JsRegex.Compile("(?<![\\d:,])(\\d{1,2}):(\\d{2})[.,](\\d{1,2})(?!\\d)", "gu");
    private static readonly JsRe CLOCK_DOT_RANGE = JsRegex.Compile("(?<![\\d:,])(?<!\\.\\d)(\\d{1,2})\\.(\\d{2})\\s*[-–—]\\s*(\\d{1,2})\\.(\\d{2})(?!\\d)", "gu");
    private static readonly JsRe CLOCK_DOT = JsRegex.Compile("(?<![\\d:,])(?<!\\.\\d)(\\d{1,2})\\.(\\d{2})(?![\\d.])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d:,])(\\d{1,2}):(\\d{2})(?![\\d.,])", "gu");
    private static readonly JsRe SCORE_COLON = JsRegex.Compile("(?<![\\d:.,])(\\d{1,2}):(\\d{1,2})(?![\\d\\p{L}])", "gu");
    private static readonly JsRe ORDINAL_COLON = JsRegex.Compile("(?<![\\d:.,])(\\d{1,3}):(a|e|s|or)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe CENTURY_RANGE = JsRegex.Compile("(?<![\\d.,:])(\\d{3,4})-(\\d{3,4})-(tal\\p{L}*)", "gu");
    private static readonly JsRe CENTURY = JsRegex.Compile("(?<![\\d.,:])(\\d{3,4})-(tal\\p{L}*)", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![-–—\\d])(\\d[\\d,]*\\d|\\d)\\s*[-–—]\\s*(\\d[\\d,]*\\d|\\d)(?![\\d\\-–—.,])", "gu");
    private static readonly JsRe BARE_YEAR = JsRegex.Compile(
        "(?<![\\d.,:\\p{L}])(1[1-9]\\d\\d)(?![\\d,:])(?!\\.\\d)(?!\\p{L})(?!\\s*(?:%|[$€£°²³]|(?:km|cm|mm|kg|[Gg][Hh][Zz]|[Mm][Bb][Ii][Tt]|m)(?![\\p{L}\\p{M}])))", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s*°\\s*C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s*°\\s*F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_V = JsRegex.Compile("(\\d)\\s*°\\s*V(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s*°", "gu");
    private static readonly JsRe TIMES_X = JsRegex.Compile("(?<=[\\d\\p{L}])\\s+x\\s+(?=\\d)", "gu");
    private static readonly JsRe SIGN_PREFIX = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])([-−+])(\\d)", "gu");
    private static readonly JsRe PLUS_AFTER_LETTER = JsRegex.Compile("(?<=[\\p{L}\\p{M}])\\+(?=\\d)", "gu");
    private static readonly JsRe PLUS_BETWEEN = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("[ \\t]{2,}", "gu");

    public static string NormalizeSwedish(string input)
    {
        var t = input;
        string prev;

        // 1) space-grouped thousands, first — a space is a token boundary.
        do { prev = t; t = SPACE_GROUP.Replace(t, ""); } while (t != prev);

        // 2) English-style comma grouping, before anything reads the comma as a decimal point.
        do { prev = t; t = COMMA_GROUP.Replace(t, ""); } while (t != prev);

        // 3) sports / duration time `M:SS,hh` — before the clock rules, which would claim its tail.
        t = SPORTS_TIME.Replace(t, "$1 $2,$3");

        // 4) clock, period form (the form Swedish writes more often); the range form is claimed first.
        t = CLOCK_DOT_RANGE.Replace(t, m =>
        {
            string h1 = m.Groups[1].Value, m1 = m.Groups[2].Value, h2 = m.Groups[3].Value, m2 = m.Groups[4].Value;
            return IsClock(h1, m1) && IsClock(h2, m2)
                ? $"{h1} {Minutes(m1)} till {h2} {Minutes(m2)}"
                : m.Value;
        });
        t = CLOCK_DOT.Replace(t, m =>
            IsClock(m.Groups[1].Value, m.Groups[2].Value)
                ? $"{m.Groups[1].Value} {Minutes(m.Groups[2].Value)}"
                : m.Value);

        // 5) clock, colon form.
        t = CLOCK_COLON.Replace(t, m =>
            IsClock(m.Groups[1].Value, m.Groups[2].Value)
                ? $"{m.Groups[1].Value} {Minutes(m.Groups[2].Value)}"
                : m.Value);

        // 6) score `N:N` — after the clock, whose two minute digits this looser pattern would eat.
        t = SCORE_COLON.Replace(t, "$1 $2");

        // 7) dotted abbreviations; the dot is re-emitted where it is also the sentence period.
        foreach (var (re, word, keepFinal) in ABBREV)
        {
            var whole = t; // JS hands the callback the string being replaced, not the running result
            t = re.Replace(t, m =>
            {
                if (keepFinal is null || !m.Value.EndsWith(".", StringComparison.Ordinal)) return word;
                var after = CLOSERS.Replace(whole[(m.Index + m.Length)..], "");
                return Js.Trim(after) == "" || SENTENCE_START.IsMatch(after) ? $"{word}." : word;
            });
        }

        // 8) ordinal colon `N:a` / `N:e`, plus the `:s` genitive and the `:or` plural.
        t = ORDINAL_COLON.Replace(t, m =>
        {
            string num = m.Groups[1].Value, suf = m.Groups[2].Value;
            if (suf == "or") return $"{Numbers.NumberToWords(Js.Number(num), num)}or";
            var ord = Ordinal(Js.Number(num));
            return ord is null ? m.Value : suf == "s" ? $"{ord}s" : ord;
        });

        // 9) century / decade `NNNN-tal…`; the range form is claimed first.
        t = CENTURY_RANGE.Replace(t, m =>
        {
            string? first = HundredsYear(Js.Number(m.Groups[1].Value)), second = HundredsYear(Js.Number(m.Groups[2].Value));
            return first is not null && second is not null ? $"{first} till {second}{m.Groups[3].Value}" : m.Value;
        });
        t = CENTURY.Replace(t, m =>
        {
            var word = HundredsYear(Js.Number(m.Groups[1].Value));
            return word is null ? m.Value : $"{word}{m.Groups[2].Value}";
        });

        // 10) ranges — before the year rule, which would leave no digits for this one to match.
        t = RANGE.Replace(t, "$1 till $2");

        // 11) bare four-digit 1100–1999 → the hundreds reading, unless a tier-claimed unit follows.
        t = BARE_YEAR.Replace(t, m => HundredsYear(Js.Number(m.Groups[1].Value)) ?? m.Value);

        // 12) degrees, before any rule that could claim the scale letter.
        t = DEG_C_SIGN.Replace(t, "°C");
        t = DEG_F_SIGN.Replace(t, "°F");
        t = DEG_C.Replace(t, "$1 grader celsius");
        t = DEG_F.Replace(t, "$1 grader fahrenheit");
        t = DEG_V.Replace(t, "$1 grader väst");
        t = DEG.Replace(t, "$1 grader");

        // 13) `x` as multiplication.
        t = TIMES_X.Replace(t, " gånger ");

        // 14) signed numbers — after the ranges, so a range's dash is already gone.
        t = SIGN_PREFIX.Replace(t, m => $"{(m.Groups[1].Value == "+" ? "plus" : "minus")} {m.Groups[2].Value}");
        t = PLUS_AFTER_LETTER.Replace(t, " plus ");
        t = PLUS_BETWEEN.Replace(t, "$1 plus $2");

        // 15) relational and operator signs.
        foreach (var (re, word) in RELATIONAL) t = re.Replace(t, word);

        // 16) ampersand.
        t = AMPERSAND.Replace(t, " och ");

        return SPACE_RUN.Replace(t, " ");
    }
}
