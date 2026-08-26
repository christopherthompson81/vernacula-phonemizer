/**
 * Catalan (ca) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/catalan/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Catalan;

public static class Normalize
{
    /** Catalan ordinal words 1–10, masculine / feminine. */
    private static readonly string[] ORD_MASC_1_10 =
    {
        "", "primer", "segon", "tercer", "quart", "cinquè", "sisè", "setè", "vuitè", "novè", "desè",
    };
    private static readonly string[] ORD_FEM_1_10 =
    {
        "", "primera", "segona", "tercera", "quarta", "cinquena", "sisena", "setena", "vuitena", "novena", "desena",
    };
    private static readonly string[] SMALL_CARDINAL_TAIL =
    {
        "", "un", "dos", "tres", "quatre", "cinc", "sis", "set", "vuit", "nou",
    };

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");
    private static readonly JsRe STEM_FINAL_AE = JsRegex.Compile("[ae]$", "u");
    private static readonly JsRe TRAILING_SEGON = JsRegex.Compile("segon$", "u");

    /**
     * Integer → the Catalan ordinal (masculine or feminine). Below 10 the irregular table; from 10 up the
     * cardinal + -è / -ena on the LAST word.
     */
    public static string? OrdinalWords(double n, bool fem = false)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 1) return null;
        if (n <= 10) return fem ? ORD_FEM_1_10[(int)n] : ORD_MASC_1_10[(int)n];
        var card = Numbers.NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        var words = card.Split(' ');
        var stem = words[^1];
        var small = fem ? ORD_FEM_1_10 : ORD_MASC_1_10;
        var mod10 = (int)(n % 10);
        if (mod10 != 0 && mod10 < 10 && n % 100 > 10)
        {
            var tail = mod10 < 10 ? SMALL_CARDINAL_TAIL[mod10] : "";
            if (tail != "" && card.EndsWith(tail, StringComparison.Ordinal))
                return $"{card[..^tail.Length]}{small[mod10]}";
        }
        stem = stem.EndsWith("ó", StringComparison.Ordinal) ? $"{stem[..^1]}on"
            : stem == "cents" ? "cent"
            : STEM_FINAL_AE.Replace(stem, "");
        words[^1] = fem ? $"{stem}ena" : $"{stem}è";
        return string.Join(" ", words);
    }

    /** `dC` = després de Crist (AD), `aC` = abans de Crist (BC). */
    private static readonly (JsRe Re, string Word)[] MULTI_DOT =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])dC(?![\\p{L}\\p{M}])", "giu"), "després de Crist"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])aC(?![\\p{L}\\p{M}])", "giu"), "abans de Crist"),
    };

    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>
    {
        ["dr"] = "doctor",
        ["etc"] = "etcètera",
    };

    /** Catalan letter names — the standard alphabet. The g2p spells them through itself. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "ce", ["d"] = "de", ["e"] = "e", ["f"] = "efa", ["g"] = "ge",
        ["h"] = "hac", ["i"] = "i", ["j"] = "jota", ["k"] = "ca", ["l"] = "ela", ["m"] = "ema", ["n"] = "ena",
        ["o"] = "o", ["p"] = "pe", ["q"] = "cu", ["r"] = "erra", ["s"] = "essa", ["t"] = "te", ["u"] = "u",
        ["v"] = "ve", ["w"] = "ve doble", ["x"] = "ics", ["y"] = "i grega", ["z"] = "zeta",
    };

    /** Catalan phonotactics, for the OOV rule in Core/Initialisms.cs. */
    public static readonly Func<string, bool> IsUnreadableCatalan = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouàèéíòóú]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "ps", "sk", "sl", "sm",
            "sn", "sp", "st", "tr", "ts",
            "ll", "ny", "tx", "gn", "mn",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "b", "bs", "cc", "ck", "ct", "ds", "ft", "ks", "kt", "lc", "ld", "lf", "lg", "lk", "ll",
            "lm", "lp", "ls", "lt", "mp", "ms", "mt", "nc", "nd", "ng", "nk", "ns", "nt", "nz", "ps",
            "pt", "rc", "rd", "rf", "rg", "rk", "rl", "rm", "rn", "rp", "rs", "rt", "sc", "sk", "sp",
            "ss", "st", "ts", "tz", "xt", "ny", "ll", "l·l",
            "mb", "ys", "cs", "gs", "nx",
        }, StringComparer.Ordinal),
        Digraphs = new HashSet<string>(new[] { "ll", "ny", "qu", "gu", "tx", "ix", "ig", "rr", "ss", "tj", "tg", "tz" },
            StringComparer.Ordinal),
    });

    /** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(new[] { "onu", "nato", "covid", "fifa", "opec", "unesco", "aids", "laser" }, StringComparer.Ordinal);

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(Js.ToLowerCase(l)),
        AcronymLetters = new HashSet<string>(new[] { "eua", "fbi", "nhk", "fic", "ns", "nsw", "irm", "rmn", "ocde", "bmt" },
            StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = w => IsUnreadableCatalan(w),
    });

    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[ \\u00a0]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOTS_AND_SPACE = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe CAP_DOT_CAP = JsRegex.Compile("(?<=\\p{Lu})\\.(?=\\s+\\p{Lu})", "gu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile("(?<![\\p{L}\\p{M}])(dr|etc)\\.(\\s+)(?=[\\p{L}\\d])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])(dr|etc)\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe ORDINAL = JsRegex.Compile("(?<![\\d.,])(\\d+)(è|a|r|n|ns|t)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DECADE = JsRegex.Compile("(?<![\\d.,])((?:1\\d|20)\\d{2}|\\d0)s(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        "(?<![\\d:,])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.\\d])\\s*(h)?\\s*([Aa]\\.?[Mm]\\.?|[Pp]\\.?[Mm]\\.?)?", "giu");
    private static readonly JsRe AP_DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe VERSION_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?![\\d.])", "giu");
    private static readonly JsRe FRAC_THREE_QUARTERS = JsRegex.Compile("(\\d+)¾", "gu");
    private static readonly JsRe FRAC_HALF = JsRegex.Compile("(\\d+)½", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe ORD_E_END = JsRegex.Compile("è$", "u");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?[°º]\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?[°º]\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?[°º]\\s?([NSOE])(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?[°º](?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe GHZ = JsRegex.Compile("(\\d+(?: punt \\d+)?)\\s?Ghz?(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{Nd}])[-−](\\d+)(?!\\s*[-\\d])", "gu");
    private static readonly JsRe AMPERSAND_INITIALS = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\p{Lu})&(\\p{Lu})(s?)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMPERSAND_SPACED = JsRegex.Compile("\\s&\\s", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\S)\\s*=\\s*(\\S)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\S)\\s*÷\\s*(\\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(\\d)", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>
    {
        ["N"] = "nord", ["S"] = "sud", ["E"] = "est", ["O"] = "oest",
    };

    /** Normalize one Catalan input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeCatalan(string input)
    {
        var s = input;

        // 1) ERA MARKERS and MULTI-DOT ABBREVIATIONS, before the single-dot rule.
        foreach (var (re, word) in MULTI_DOT) s = re.Replace(s, word);

        // 2) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
        s = DOTTED_CAPS.Replace(s, m => DOTS_AND_SPACE.Replace(m.Value, ""));
        s = CAP_DOT_CAP.Replace(s, "");

        // 3) SINGLE-DOT ABBREVIATIONS.
        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}.");

        // 4) ORDINALS — the `Nè`/`Na`/`Nr`/`Nn`/`Nt`/`Nns` form.
        s = ORDINAL.Replace(s, m0 =>
        {
            var n = Js.Number(m0.Groups[1].Value);
            var sfx = m0.Groups[2].Value;
            var fem = Js.ToLowerCase(sfx) == "a";
            var ord = OrdinalWords(n, fem);
            if (ord is null) return m0.Value;
            var last = ord.Split(' ')[^1];
            var mm = Js.ToLowerCase(sfx);
            if (mm == "r" && !(last == "primer" || last == "tercer")) return m0.Value;
            if (mm == "n" && last != "segon") return m0.Value;
            if (mm == "ns" && last != "segon") return m0.Value;
            if (mm == "t" && last != "quart") return m0.Value;
            if (mm == "ns") return TRAILING_SEGON.Replace(ord, "segons");
            return ord;
        });

        // 4b) DECADES — `1920s`, `90s`. Drop the plural marker; the number itself is the decade.
        s = DECADE.Replace(s, "$1");

        // 5) CLOCK, in the COLON form.
        s = CLOCK.Replace(s, m0 =>
        {
            double hv = Js.Number(m0.Groups[1].Value), mv = Js.Number(m0.Groups[2].Value);
            if (hv > 23 || mv > 59) return m0.Value;
            var head = mv == 0 ? Numbers.NumberToWords(hv) : $"{Numbers.NumberToWords(hv)} {Numbers.NumberToWords(mv)}";
            var ap = m0.Groups[4].Success ? m0.Groups[4].Value : null;
            var suffix = ap is not null && ap != "" ? $" {AP_DOTS.Replace(ap, "").ToUpperInvariant()}" : "";
            return $"{head}{suffix}";
        });

        // 6) VERSION DOTS and DOT DECIMALS.
        s = VERSION_DOT.Replace(s, "$1 punt $2");

        // 7) FRACTIONS.
        s = FRAC_THREE_QUARTERS.Replace(s, "$1 i tres quarts");
        s = FRAC_HALF.Replace(s, "$1 i mig");
        s = FRACTION.Replace(s, m0 =>
        {
            double num = Js.Number(m0.Groups[1].Value), den = Js.Number(m0.Groups[2].Value);
            if (den == 2) return num == 1 ? "mig" : $"{Numbers.NumberToWords(num)} mitjos";
            var noun = den == 3 ? "terç" : den == 4 ? "quart" : OrdinalWords(den, false);
            if (noun is null) return m0.Value;
            var plural = den == 3 ? "terços" : den == 4 ? "quarts" : ORD_E_END.Replace(noun, "ens");
            return $"{Numbers.NumberToWords(num)} {(num == 1 ? noun : plural)}";
        });

        // 8) DEGREES.
        s = DEG_C.Replace(s, "$1 graus Celsius");
        s = DEG_F.Replace(s, "$1 graus Fahrenheit");
        s = DEG_COMPASS.Replace(s, m => $"{m.Groups[1].Value} graus {COMPASS[m.Groups[2].Value.ToUpperInvariant()]}");
        s = DEG_BARE.Replace(s, "$1 graus");

        // 9) GIGAHERTZ — AFTER the version rule, BEFORE the tier.
        s = GHZ.Replace(s, "$1 gigahercis");

        // 10) SIGNS.
        s = PLUS_MINUS.Replace(s, " més menys ");
        s = PLUS.Replace(s, " més ");
        s = MINUS.Replace(s, "menys $1");
        s = AMPERSAND_INITIALS.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return $"{LETTER_NAME.GetValueOrDefault(Js.ToLowerCase(a)) ?? a} i {LETTER_NAME.GetValueOrDefault(Js.ToLowerCase(b)) ?? b}{m.Groups[3].Value}";
        });
        s = AMPERSAND_SPACED.Replace(s, " i ");
        s = EQUALS.Replace(s, "$1 és igual a $2");
        s = DIVIDE.Replace(s, "$1 dividit per $2");
        s = LESS_THAN.Replace(s, "$1 és menor que $2");
        s = GREATER_THAN.Replace(s, "$1 és major que $2");
        s = TIMES.Replace(s, "$1 per $2");

        // 11) INITIALISMS, LAST of the letter rules.
        s = NormalizeInitialisms(s);

        return MULTI_SPACE.Replace(s, " ");
    }
}
