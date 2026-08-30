/**
 * Galician (gl) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/galician/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Galician;

public static class Normalize
{
    /** Galician masculine ordinals, 1 … 100 (standard RAG); `null` outside that. */
    private static readonly string[] ORD_UNITS =
        ["", "primeiro", "segundo", "terceiro", "cuarto", "quinto", "sexto", "sétimo", "oitavo", "noveno"];
    private static readonly string[] ORD_TENS =
        ["", "décimo", "vixésimo", "trixésimo", "cuadraxésimo", "quincuaxésimo",
         "sexaxésimo", "septuaxésimo", "octoxésimo", "nonaxésimo"];

    public static string? GalicianOrdinal(double n)
    {
        if (!(double.IsInteger(n)) || n < 1 || n > 100) return null;
        if (n == 100) return "centésimo";
        if (n < 10) return ORD_UNITS[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        return u == 0 ? ORD_TENS[t] : $"{ORD_TENS[t]} {ORD_UNITS[u]}";
    }

    private static readonly JsRe FEMINAL_O = JsRegex.Compile("o(?=\\s|$)", "gu");

    /** The feminine of a Galician ordinal: every element ends in -o and takes -a (vixésima primeira). */
    /** ⚠ `JsRe.Replace`, NOT the `Rewrite` seam — `masc` is a word this file COMPOSED, never the pipeline
     *  string, so declaring it to the provenance tracker reports a span against a string it has never seen.
     *  The TypeScript uses `rewrite` at all three of this file's equivalent sites and poisons for it (see
     *  #1179); the C# side is spelled the way ee/chv/fo already spell it. Behaviour is identical. */
    private static string FeminineOrdinal(string masc) => FEMINAL_O.Replace(masc, "a");

    private const double ORDINAL_INDICATOR_MAX = 100;

    private static readonly (JsRe Re, string Word)[] ERA =
    [
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])a\\.\\s?e\\.\\s?c\\.(?![\\p{L}\\p{M}])", "giu"), "antes da Era común"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])a\\.\\s?C\\.(?![\\p{L}\\p{M}])", "gu"), "antes de Cristo"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])d\\.\\s?C\\.(?![\\p{L}\\p{M}])", "gu"), "despois de Cristo"),
    ];

    /** Single-dot abbreviations → the spoken words. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>
    {
        ["etc"] = "etcétera", ["dr"] = "doutor", ["dra"] = "doutora", ["sr"] = "señor", ["sra"] = "señora",
        ["prof"] = "profesor", ["vol"] = "volume", ["páx"] = "páxina", ["séc"] = "século",
    };
    // Verbatim of the TS `Object.keys(DOTTED_ABBREV).join("|")` — insertion order, which the `i`-fold and the
    // following `\.` make order-independent (a shorter prefix key cannot match where the dot does not follow).
    private const string ABBREV_ALT = "etc|dr|dra|sr|sra|prof|vol|páx|séc";

    /** Galician letter names (RAG), spelled through the g2p like any other word. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "ce", ["d"] = "de", ["e"] = "e", ["f"] = "efe", ["g"] = "gue",
        ["h"] = "hache", ["i"] = "i", ["j"] = "iota", ["k"] = "ka", ["l"] = "ele", ["m"] = "eme",
        ["n"] = "ene", ["ñ"] = "eñe", ["o"] = "o", ["p"] = "pe", ["q"] = "cu", ["r"] = "erre",
        ["s"] = "ese", ["t"] = "te", ["u"] = "u", ["v"] = "uve", ["w"] = "uve dobre", ["x"] = "xis",
        ["y"] = "i grego", ["z"] = "zeta",
    };

    public static readonly Func<string, bool> IsUnreadableGalician = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouáéíóúü]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "ch", "ll", "rr", "nh", "qu", "gu",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "b", "c", "d", "l", "n", "r", "s", "x", "z", "ls", "ns", "rs", "is", "us", "ct", "cc", "st", "sc",
            "lt", "rt", "nt", "sk", "mp", "mb", "ks", "lc", "rc", "rd", "rn", "rm", "rl", "lg", "nd",
        }, StringComparer.Ordinal),
    });

    /** Lexical: acronyms read as words despite being unreadable by phonotactics, or readable but
     *  conventionally spelled. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(new[] { "onu", "otan", "unesco", "covid", "sida", "ovni", "láser", "radar" }, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = new HashSet<string>(new[]
        {
            "isbn", "pib", "iso", "si", "eeuu", "ue", "cd", "dvd", "utc", "gmt", "pdf", "url",
        }, StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = w => IsUnreadableGalician(w),
    });

    private static string DECIMAL_WORD => Manifest.MANIFEST.Numbers.DecimalConnector;

    /** Digit-grouping spaces: SI thin/narrow/no-break, and the ASCII space Galician also uses. */
    private const string GROUP_SPACE = " \u00a0\u2009\u202f";

    private static readonly JsRe SPACE_GROUP = JsRegex.Compile($"(?<=\\d)(?<!(?<![\\d\\.,])0)[{GROUP_SPACE}](?=\\d{{3}}(?!\\d))", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile($"[{GROUP_SPACE}]", "gu");
    private static readonly JsRe NUMERO = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:n\\.º|nº|n°|núm\\.)\\s?(?=\\d)", "giu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[ \\u00a0]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOTTED_CAPS_MARKS = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe LONE_INITIAL_DOT = JsRegex.Compile("(?<=\\p{Lu})\\.(?=\\s+\\p{Lu})", "gu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\d])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe ORDINAL_IND = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:\\.\\d{3})+|\\d+)\\.?(º|ª)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTS_IN = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?![\\d.])", "gu");
    private static readonly JsRe CURRENCY_CODE = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:US|AUD|CAD)\\$(?=[ \\u00a0]?\\d)", "gu");
    private static readonly JsRe REAL_CODE = JsRegex.Compile("(?<![\\p{L}\\p{M}])R\\$\\s?(\\d[\\d.,]*)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?°\\s?([NSEO])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>
    {
        ["N"] = "norte", ["S"] = "sur", ["E"] = "leste", ["O"] = "oeste",
    };
    private static readonly JsRe TIMESTAMP = JsRegex.Compile("(?<![\\d:])(\\d{1,2}):([0-5]\\d):([0-5]\\d)(?![:\\d])", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:,])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.\\d])", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d+(?:[.,]\\d+)?)(?!\\d*[-–])", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(?<=[\\p{L}\\p{Nd}])\\s?<\\s?(?=[\\p{L}\\p{Nd}])", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(?<=[\\p{L}\\p{Nd}])\\s?>\\s?(?=[\\p{L}\\p{Nd}])", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/.,])(\\d{1,2})\\/(\\d{1,2})(?![\\d/.,])(\\p{L})?", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<=\\d)\\s?[-–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe IDEM = JsRegex.Compile("〃", "gu");
    private static readonly JsRe SPACE_RUNS = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Galician input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
    public static string NormalizeGalician(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING with a space — FIRST, per the playbook: a grouping mark left in place is read as
        //    clause punctuation or splits the number token. Twice, because `299 792 458` has two group
        //    boundaries and the first match consumes the space the second would need.
        s = Rewrite(s, SPACE_GROUP, "");
        s = Rewrite(s, SPACE_GROUP, "");
        s = Rewrite(s, GROUP_SPACES, " "); // the leftover no-break spaces are ordinary ones

        // 1) ERA MARKERS, before the abbreviation rule so the bare `a.`/`d.` is not claimed first.
        foreach (var (re, word) in ERA) s = Rewrite(s, re, word);

        // 2) NÚMERO, only before a digit. The bare `no` is the contraction en+o and is everywhere in
        //    Galician, so it is deliberately NOT an alternative here.
        s = Rewrite(s, NUMERO, "número ");

        // 3) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass (step 14) reads them as
        //    LETTERS. A single initial before a surname: the dot is a break, not a full stop.
        //    ⚠ The INNER call is `JsRe.Replace`: its subject is the MATCHED RUN, not the pipeline string.
        s = Rewrite(s, DOTTED_CAPS, m => DOTTED_CAPS_MARKS.Replace(m.Value, ""));
        s = Rewrite(s, LONE_INITIAL_DOT, "");

        // 4) SINGLE-DOT ABBREVIATIONS. Two branches: mid-sentence the dot is CONSUMED so it cannot become a
        //    phrase break; at a phrase end it is kept, because there it really is the sentence end.
        // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own keys but
        // carries `i`+`u`, so JS's fold widens it — `ſ`→`s` reaches the `sr`/`sra` keys — and a
        // near-miss matches while its key is absent. The TS asserted non-null and spoke the word
        // "undefined"; this indexer THREW. Refuse the whole match.
        s = Rewrite(s, ABBREV_MID, m =>
            DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}{m.Groups[2].Value}" : m.Value);
        s = Rewrite(s, ABBREV_END, m =>
            DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}." : m.Value);

        // 5) ORDINAL INDICATORS — º (U+00BA) and ª (U+00AA). BOUNDED AT 100: above it the indicator is
        //    STRIPPED and the cardinal stands (this corpus's large `º` are kiln temperatures).
        s = Rewrite(s, ORDINAL_IND, m =>
        {
            var digits = m.Groups[1].Value;
            var n = Js.Number(DOTS_IN.Replace(digits, "")); // a matched group, not the pipeline string
            var masc = n <= ORDINAL_INDICATOR_MAX ? GalicianOrdinal(n) : null;
            if (masc is null) return digits;
            return m.Groups[2].Value == "ª" ? FeminineOrdinal(masc) : masc;
        });

        // 6) THE DOT DECIMAL — the one class this layer had to fix rather than merely add. The discriminator
        //    is the fraction's length: exactly three digits is a thousands group, one or two is a decimal.
        s = Rewrite(s, DOT_DECIMAL, m => $"{m.Groups[1].Value} {DECIMAL_WORD} {m.Groups[2].Value}");

        // 7) CURRENCY CODES → the bare sign, which is what makes the tier's declared key reachable.
        s = Rewrite(s, CURRENCY_CODE, "$");
        s = Rewrite(s, REAL_CODE, "$1 reais");

        // 8) DEGREES, BEFORE the unit tier so the bare sign is not left behind.
        s = Rewrite(s, DEG_C, "$1 graos Celsius");
        s = Rewrite(s, DEG_F, "$1 graos Fahrenheit");
        s = Rewrite(s, DEG_COMPASS, m =>
            $"{m.Groups[1].Value} graos {COMPASS[m.Groups[2].Value]}");
        s = Rewrite(s, DEG_BARE, "$1 graos");

        // 9) CLOCK, and the three-field timestamp that is not one. The three-field form is CLAIMED FIRST, or
        //    the two-field rule takes its head and strands the rest.
        s = Rewrite(s, TIMESTAMP, "$1 $2 $3");
        s = Rewrite(s, CLOCK, m => ClockWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)));

        // 10) SIGNS.
        s = Rewrite(s, PLUS_MINUS, " máis menos ");
        s = Rewrite(s, MINUS, "$1menos $2");
        s = Rewrite(s, PLUS_ATTACHED, "$1 máis ");
        s = Rewrite(s, PLUS_LEADING, "$1máis ");
        s = Rewrite(s, EQUALS, " igual a ");
        s = Rewrite(s, LESS_THAN, " menor que ");
        s = Rewrite(s, GREATER_THAN, " maior que ");
        s = Rewrite(s, DIVIDE, " dividido por ");

        // 11) FRACTIONS. Galician names 2 and 3 with NOUNS (*medio*, *terzo*) and everything from 4 up with
        //     the ordinal, pluralised above one. The denominator is bounded at twelve.
        s = Rewrite(s, FRACTION, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            var num = Js.Number(a);
            var den = Js.Number(b);
            if (den < 2 || den > 12 || num < 1 || num > den) return m.Value;
            var tail = m.Groups[3].Success;
            var sep = tail ? $" {m.Groups[3].Value}" : "";
            if (den == 2) return $"{(num == 1 ? "medio" : $"{Numbers.NumberToWords(num)} medios")}{sep}";
            var noun = den == 3 ? "terzo" : GalicianOrdinal(den);
            if (noun is null) return m.Value;
            return $"{Numbers.NumberToWords(num)} {(num == 1 ? noun : $"{noun}s")}{sep}";
        });

        // 12) RANGES. A dash between two numbers is read `a`. NOTHING MAY BE REQUIRED AFTER THE SECOND
        //     NUMBER (trap 58): the guard is only that the right operand does not continue into another dash.
        s = Rewrite(s, RANGE, " a ");

        // 13) THE ÍDEM SIGN 〃.
        s = Rewrite(s, IDEM, " ídem ");

        // 14) INITIALISMS, LAST of the letter rules.
        s = InitialismNormalizer(s);

        return Rewrite(s, SPACE_RUNS, " ");
    }

    /** An hour/minute pair → *once e trinta e cinco* / *once* at a round hour. */
    private static string ClockWords(double h, double min) =>
        min == 0 ? Numbers.NumberToWords(h) : $"{Numbers.NumberToWords(h)} e {Numbers.NumberToWords(min)}";
}
