/**
 * German (de) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/german/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.German;

public static class Normalize
{
    private const string MONTHS = "Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
    /** Nouns that follow an ordinal numeral. `Jahrunderts` is the corpus's own misspelling, kept so the rule
     *  still fires on it. */
    private const string ORDINAL_NOUN = MONTHS + "|Jahrhundert|Jahrhunderts|Jahrunderts|Jh";
    /**
     * Articles and prepositions that license an ordinal reading, and which of the two endings they govern.
     */
    private static readonly IReadOnlySet<string> WEAK_EN = new HashSet<string>(new[]
    {
        "am", "im", "vom", "zum", "beim", "dem", "des", "den", "ins", "seit", "bis", "ab", "nach", "vor", "zur",
    }, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> LICENSER =
        new HashSet<string>(WEAK_EN.Concat(new[] { "das", "der", "die", "ein", "eine", "sein", "ihr" }), StringComparer.Ordinal);

    /** Integer → the German ordinal STEM. */
    private static readonly IReadOnlyDictionary<int, string> IRREGULAR_STEM = new Dictionary<int, string>
    {
        [1] = "erst", [3] = "dritt", [7] = "siebt", [8] = "acht",
    };

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");

    private static string? OrdinalStem(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 1) return null;
        if (IRREGULAR_STEM.TryGetValue((int)n, out var irr)) return irr;
        var card = Numbers.NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        return n < 20 ? $"{card}t" : $"{card}st";
    }

    /** Dotted abbreviations → the spoken words; unexpanded, each reads as a consonant cluster plus a
     *  spurious phrase break. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["bzw"] = "beziehungsweise", ["usw"] = "und so weiter", ["ca"] = "circa", ["evtl"] = "eventuell", ["ggf"] = "gegebenenfalls",
        ["inkl"] = "inklusive", ["exkl"] = "exklusive", ["bzgl"] = "bezüglich", ["einschl"] = "einschließlich",
        ["dr"] = "Doktor", ["prof"] = "Professor", ["st"] = "Sankt", ["hr"] = "Herr", ["fr"] = "Frau", ["nr"] = "Nummer",
        ["mio"] = "Millionen", ["mrd"] = "Milliarden", ["jh"] = "Jahrhundert", ["bd"] = "Band", ["s"] = "Seite", ["vgl"] = "vergleiche",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** German letter names, for initialisms: USA is [uː ʔɛs ʔaː], not the word *usa*. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "ze", ["d"] = "de", ["e"] = "e", ["f"] = "eff", ["g"] = "ge", ["h"] = "ha", ["i"] = "i", ["j"] = "jott",
        ["k"] = "ka", ["l"] = "ell", ["m"] = "emm", ["n"] = "enn", ["o"] = "o", ["p"] = "pe", ["q"] = "ku", ["r"] = "err", ["s"] = "ess", ["t"] = "te",
        ["u"] = "u", ["v"] = "vau", ["w"] = "we", ["x"] = "iks", ["y"] = "üpsilon", ["z"] = "zett", ["ä"] = "ä", ["ö"] = "ö", ["ü"] = "ü",
    };

    /** German phonotactics, for the OOV rule in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadableGerman = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouäöüy]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "ch", "dr", "fl", "fr", "gl", "gr", "kl", "kn", "kr", "pf", "pl", "pr", "ps",
            "qu", "sc", "sch", "sh", "sk", "sl", "sm", "sn", "sp", "st", "sw", "th", "tr", "tw", "vl", "vr", "zw",
            "ph", "gn", "schw", "wl",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ch", "ck", "ft", "ht", "lb", "ld", "lf", "lk", "lm", "ln", "lp", "ls", "lt", "lz", "mm",
            "mp", "ms", "nd", "nf", "ng", "nk", "ns", "nt", "nz", "pf", "ps", "rb", "rd", "rf", "rg",
            "rk", "rl", "rm", "rn", "rp", "rs", "rt", "rz", "sch", "sk", "sp", "st", "ss", "tt", "tz", "ts", "ks",
            "nn", "bt", "hl", "gt", "hr", "kt", "hn", "zt", "hm", "mt", "ll", "rr", "cht", "ngt",
        }, StringComparer.Ordinal),
        Digraphs = new HashSet<string>(new[] { "ch", "sch", "tz", "ck", "ph", "th", "ng", "qu", "ss", "sh" }, StringComparer.Ordinal),
    });

    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer =
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => LETTER_NAME.GetValueOrDefault(l),
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = _ => false,
            IsUnreadable = IsUnreadableGerman,
        });

    /** German's lexicon is a stress/length correction table rather than a wordlist of attested forms, so it
     *  cannot serve as the "is this recorded" test. Acronyms are decided by the list plus the OOV rule. */
    public static string NormalizeGermanInitialisms(string text) => InitialismNormalizer(text);

    /** Measure-noun STEMS, matched with a trailing `\p{L}*` because German inflects them — the guard that
     *  keeps a counted quantity from being read as a year. */
    private static readonly string MEASURE_STEM = string.Join("|", new[]
    {
        "Prozent", "Grad", "Euro", "Cent", "Dollar", "Pfund", "Franken", "Kilometer", "Meter", "Zentimeter",
        "Millimeter", "Meile", "Kilogramm", "Gramm", "Tonne", "Liter", "Hektar", "Quadrat", "Kubik", "Volt",
        "Watt", "Stück", "Mal", "mal", "Million", "Milliarde", "Jahr", "Monat", "Tag", "Stunde", "Minute",
        "Sekunde", "Mann", "Mensch", "Einwohner", "Person", "Soldat", "Mitarbeiter", "Teilnehmer", "Besucher",
    });
    private static readonly string NOT_A_YEAR = $"(?!\\s*(?:{MEASURE_STEM})\\p{{L}}*)";
    private static readonly JsRe YEAR_RE =
        JsRegex.Compile($"(?<![\\d.,€$£¥₽₴])(1[1-9]\\d\\d)(?![.,]?\\d)(?![\\p{{L}}\\p{{M}}]){NOT_A_YEAR}", "giu");
    private static readonly JsRe DECADE_RE = JsRegex.Compile("(?<![\\d.,])(1[1-9]\\d\\d)(ern?)(?![\\p{L}\\p{M}])", "gu");

    private static string YearWords(double y)
    {
        double hi = Math.Floor(y / 100), lo = y % 100;
        return $"{Numbers.NumberToWords(hi)}hundert{(lo == 0 ? "" : Numbers.NumberToWords(lo))}";
    }

    /**
     * A 4-digit year → the hundreds form German reads it in: 1945 → *neunzehnhundertfünfundvierzig*.
     *
     * ⚠ RUNS AFTER THE SHARED SYMBOL TIER, not inside NormalizeGerman: every symbol rule is keyed on a DIGIT
     * beside the symbol, so rewriting the digits to words first leaves `%`/`€`/`$`/`×` with nothing to attach
     * to and they are dropped in silence.
     */
    public static string NormalizeGermanYears(string input) =>
        YEAR_RE.Replace(
            DECADE_RE.Replace(input, m => $"{YearWords(Js.Number(m.Groups[1].Value))}{m.Groups[2].Value}"),
            m => YearWords(Js.Number(m.Groups[1].Value)));

    private static readonly JsRe ERA_BC = JsRegex.Compile("\\bv\\.\\s?Chr\\.", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile("\\bn\\.\\s?Chr\\.", "giu");
    private static readonly JsRe ZB = JsRegex.Compile("\\bz\\.\\s?B\\.", "gu");
    private static readonly JsRe DH = JsRegex.Compile("\\bd\\.\\s?h\\.", "gu");
    private static readonly JsRe UA = JsRegex.Compile("\\bu\\.\\s?a\\.", "gu");
    private static readonly JsRe UAE = JsRegex.Compile("\\bu\\.\\s?Ä\\.", "gu");
    private static readonly JsRe ORD = JsRegex.Compile("(?:(\\p{L}+)(\\s+))?(\\d{1,4})\\.(?=\\s+(\\p{L}+))", "gu");
    private static readonly JsRe ORDINAL_NOUN_RE = JsRegex.Compile($"^(?:{ORDINAL_NOUN})$", "iu");
    private static readonly JsRe UPPER_START = JsRegex.Compile("^\\p{Lu}", "u");
    private static readonly JsRe BARE_DAY_MONTH =
        JsRegex.Compile($"(?:(\\p{{L}}+)(\\s+))?(\\d{{1,2}})(\\s+)(?=(?:{MONTHS})(?![\\p{{L}}\\p{{M}}]))", "giu");
    private static readonly JsRe ABBREV_MID =
        JsRegex.Compile($"(?<!\\p{{Lu}}\\.[ \u00a0])\\b({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\d])", "giu");
    private static readonly JsRe ABBREV_END =
        JsRegex.Compile($"\\b({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe CLOCK = JsRegex.Compile("\\b([01]?\\d|2[0-3])[:.]([0-5]\\d)\\b(?!\\.?\\d)(\\s*Uhr)?", "giu");
    private static readonly JsRe KMH = JsRegex.Compile("(\\d)\\s?km\\/h\\b", "gu");
    private static readonly JsRe MS = JsRegex.Compile("(\\d)\\s?m\\/s\\b", "gu");
    // ⚠ `(?![\\p{L}\\p{M}])`, NOT `\\b`. JS defines `\\b` on ASCII `\\w`, so a following NON-ASCII letter
    // counted as a boundary and this fired when it must not — `25°Cölner` ate the ⟨C⟩ as Celsius. See
    // src/languages/*/normalize.ts, which carries the finding.
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "giu");
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

    /** Normalize one German input string. Pure text→text. */
    public static string NormalizeGerman(string input)
    {
        var s = input;

        s = ERA_BC.Replace(s, "vor Christus");
        s = ERA_AD.Replace(s, "nach Christus");
        s = ZB.Replace(s, "zum Beispiel");
        s = DH.Replace(s, "das heißt");
        s = UA.Replace(s, "unter anderem");
        s = UAE.Replace(s, "und Ähnliches");

        s = ORD.Replace(s, m =>
        {
            var prev = m.Groups[1].Success ? m.Groups[1].Value : null;
            var sp = m.Groups[2].Success ? m.Groups[2].Value : null;
            var digits = m.Groups[3].Value;
            var next = m.Groups[4].Value;
            var day = Js.Number(digits);
            var licensed = (day <= 31 && ORDINAL_NOUN_RE.IsMatch(next))
                || (prev is not null && LICENSER.Contains(prev.ToLowerInvariant()) && UPPER_START.IsMatch(next));
            if (!licensed) return m.Value;
            var stem = OrdinalStem(Js.Number(digits));
            if (stem is null) return m.Value;
            var ending = prev is not null && WEAK_EN.Contains(prev.ToLowerInvariant()) ? "en" : "e";
            return $"{prev ?? ""}{sp ?? ""}{stem}{ending}";
        });

        s = BARE_DAY_MONTH.Replace(s, m =>
        {
            var prev = m.Groups[1].Success ? m.Groups[1].Value : null;
            var sp = m.Groups[2].Success ? m.Groups[2].Value : null;
            var digits = m.Groups[3].Value;
            var sp2 = m.Groups[4].Value;
            var stem = OrdinalStem(Js.Number(digits));
            if (stem is null) return m.Value;
            var ending = prev is not null && WEAK_EN.Contains(prev.ToLowerInvariant()) ? "en" : "e";
            return $"{prev ?? ""}{sp ?? ""}{stem}{ending}{sp2}";
        });

        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        s = CLOCK.Replace(s, m =>
        {
            var h = Js.Number(m.Groups[1].Value);
            var min = Js.Number(m.Groups[2].Value);
            var head = $"{Numbers.NumberToWords(h)} Uhr";
            return min == 0 ? head : $"{head} {Numbers.NumberToWords(min)}";
        });

        s = KMH.Replace(s, "$1 Kilometer pro Stunde");
        s = MS.Replace(s, "$1 Meter pro Sekunde");
        s = DEG_C.Replace(s, "$1 Grad Celsius");
        s = DEG_F.Replace(s, "$1 Grad Fahrenheit");
        s = DEG.Replace(s, "$1 Grad");

        s = MINUS.Replace(s, "$1minus $2");
        s = PLUS_MINUS.Replace(s, " plus minus ");
        s = PLUS_ATTACHED.Replace(s, "$1 plus $2");
        s = PLUS_LEADING.Replace(s, "$1plus $2");

        s = EQUALS_RE.Replace(s, " gleich ");
        s = LESS_THAN.Replace(s, " kleiner als ");
        s = GREATER_THAN.Replace(s, " größer als ");
        s = DIVIDE.Replace(s, " geteilt durch ");

        s = FRACTION.Replace(s, m =>
        {
            var num = Js.Number(m.Groups[1].Value);
            var den = Js.Number(m.Groups[2].Value);
            if (den == 2) return num == 1 ? "ein halb" : $"{Numbers.NumberToWords(num)} halbe";
            var stem = OrdinalStem(den);
            return stem is null ? m.Value : $"{(num == 1 ? "ein" : Numbers.NumberToWords(num))} {stem}el";
        });

        return s;
    }
}
