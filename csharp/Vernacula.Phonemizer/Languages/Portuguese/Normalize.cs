/**
 * Portuguese (pt / pt-BR) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/portuguese/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Portuguese;

public static class Normalize
{
    private const string GROUP_SPACE = "    ";
    private const string MONTHS = "janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

    /** Dotted abbreviations → the spoken words. `no.` is deliberately absent and handled separately: bare
     *  "no" is an extremely common Portuguese contraction (em + o), so only `nº`/`n.º`/`no` before a DIGIT
     *  counts. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["sr"] = "senhor", ["sra"] = "senhora", ["srta"] = "senhorita", ["srs"] = "senhores",
        ["dr"] = "doutor", ["dra"] = "doutora", ["prof"] = "professor", ["profa"] = "professora", ["eng"] = "engenheiro",
        ["etc"] = "etcétera", ["pág"] = "página", ["pag"] = "página", ["págs"] = "páginas",
        ["cap"] = "capítulo", ["art"] = "artigo", ["vol"] = "volume", ["av"] = "avenida", ["ex"] = "exemplo",
        ["ltda"] = "limitada", ["cia"] = "companhia", ["núm"] = "número", ["aprox"] = "aproximadamente",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Portuguese letter names, each verified through this engine. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "bê", ["c"] = "cê", ["d"] = "dê", ["e"] = "é", ["f"] = "éfe", ["g"] = "gê", ["h"] = "agá", ["i"] = "i",
        ["j"] = "jota", ["k"] = "cá", ["l"] = "éle", ["m"] = "eme", ["n"] = "ene", ["o"] = "ó", ["p"] = "pê", ["q"] = "quê",
        ["r"] = "erre", ["s"] = "esse", ["t"] = "tê", ["u"] = "u", ["v"] = "vê", ["w"] = "dábliu", ["x"] = "xis", ["y"] = "ípsilon", ["z"] = "zê",
    };

    /** Portuguese phonotactics, for the OOV rule in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadablePortuguese = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouáéíóúâêôãõà]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr",
            "ch", "lh", "nh", "qu", "gu", "ps", "rr", "ss", "sc", "tl",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ch", "lh", "nh", "rr", "ss", "ns", "rs", "ls", "is", "us", "as", "es", "os",
            "st", "rt", "rd", "rn", "rl", "rm", "lt", "ld", "nt", "nd", "nc", "ng", "mp", "mb",
            "sc", "sm", "cs", "ps", "ts", "ks", "bs", "ds",
        }, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms spelled out. Authored in portuguese.jsonc beside the other hand-authored facts. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer =
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => LETTER_NAME.GetValueOrDefault(l),
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = _ => false,
            IsUnreadable = IsUnreadablePortuguese,
        });

    /** Portuguese has a pronunciation lexicon, but it is a CORRECTION table rather than a wordlist, so it
     *  cannot serve as the "is this recorded" test the way CMUdict or Lexique do. Acronyms are decided by the
     *  lexical list plus the OOV phonotactic rule alone. */
    public static string NormalizePortugueseInitialisms(string text) => InitialismNormalizer(text);

    private static readonly JsRe FINAL_O = JsRegex.Compile("o$", "u");
    private static readonly JsRe FINAL_UM = JsRegex.Compile("um$", "u");

    /** Feminine ordinal: every element of a compound inflects (trigésimo sétimo → trigésima sétima). */
    private static string FeminineOrdinal(string masc) =>
        string.Join(" ", masc.Split(' ').Select(w => FINAL_O.Replace(w, "a")));

    /** Non-negative integer → words with the final *um* feminized (hora and minuto agreement: uma hora). */
    private static string FeminineCardinal(double n) => FINAL_UM.Replace(Numbers.NumberToWords(n), "uma");

    private static readonly IReadOnlyDictionary<int, string> DENOMINATOR = new Dictionary<int, string>
    {
        [2] = "meio", [3] = "terço",
    };

    private static string? FractionWords(int num, int den)
    {
        if (den < 2 || num < 1) return null;
        var baseWord = DENOMINATOR.GetValueOrDefault(den) ?? RomanOrdinals.PortugueseOrdinal(den);
        if (baseWord is null) return null;
        return $"{Numbers.NumberToWords(num)} {(num > 1 ? $"{baseWord}s" : baseWord)}";
    }

    private static readonly JsRe GROUP_SPACE_RE = JsRegex.Compile($"(\\d)[{GROUP_SPACE}](\\d{{3}})(?!\\d)", "gu");
    private static readonly JsRe THIN_SPACES = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile("\\ba\\.\\s?C\\.", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile("\\bd\\.\\s?C\\.", "giu");
    private static readonly JsRe NUMERO = JsRegex.Compile("\\b(?:n\\.º|nº|n°|no|núm\\.)\\s?(?=\\d)", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    // The grouped alternative must come FIRST, or a bare \d+ matches only the tail of `1.000º`. ° (U+00B0
    // DEGREE SIGN) is deliberately not an ordinal indicator here: "35°" is a temperature.
    private static readonly JsRe ORDINAL_INDICATOR = JsRegex.Compile("\\b(\\d{1,3}(?:\\.\\d{3})+|\\d+)\\.?(?:º|ª)", "gu");
    private static readonly JsRe FEMININE_MARK = JsRegex.Compile("ª", "u");
    private static readonly JsRe GROUPING_DOT = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe REAIS = JsRegex.Compile("R\\$\\s?(\\d[\\d.,]*)", "gu");
    private static readonly JsRe DOLLAR_CODE = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:US|AUD)\\$(?=[  ]?\\d)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C\\b", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F\\b", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe CLOCK_H = JsRegex.Compile("\\b([01]?\\d|2[0-3])\\s?h\\s?([0-5]\\d)?(?![\\p{L}\\p{M}\\d])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("\\b([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})/(\\d{1,3})\\b(?!\\s*[/\\d])", "gu");
    private static readonly JsRe FIRST_OF_MONTH = JsRegex.Compile($"\\b1\\s+de\\s+({MONTHS})\\b", "giu");

    /** Normalize one Portuguese input string. */
    public static string NormalizePortuguese(string input, bool brazilian = false)
    {
        var s = input;

        s = GROUP_SPACE_RE.Replace(s, "$1$2");
        s = GROUP_SPACE_RE.Replace(s, "$1$2");
        s = THIN_SPACES.Replace(s, " ");

        // Era markers run BEFORE the dotted-abbreviation rule, or the bare `a.` is claimed first.
        s = ERA_BC.Replace(s, "antes de Cristo");
        s = ERA_AD.Replace(s, "depois de Cristo");

        s = NUMERO.Replace(s, "número ");

        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        // With no ordinal word in range the indicator is STRIPPED, not kept: returning the match unchanged
        // would leak a raw º into the phoneme string, which is the leak this rule exists to prevent.
        s = ORDINAL_INDICATOR.Replace(s, m =>
        {
            var digits = m.Groups[1].Value;
            var n = Js.Number(GROUPING_DOT.Replace(digits, ""));
            var masc = double.IsInteger(n) && n >= 1 && n <= 1000 ? RomanOrdinals.PortugueseOrdinal((int)n) : null;
            if (masc is null) return digits;
            return FEMININE_MARK.IsMatch(m.Value) ? FeminineOrdinal(masc) : masc;
        });

        s = REAIS.Replace(s, "$1 reais");

        // US$/AUD$ fold to the bare sign rather than to a word so the shared currency tier keeps count
        // agreement (US$ 1 → dólar, not dólares). Only where a number follows: a lone $ is dropped instead.
        s = DOLLAR_CODE.Replace(s, "$");

        // Degrees before the unit tier, or the bare sign is left behind.
        s = DEG_C.Replace(s, "$1 graus Celsius");
        s = DEG_F.Replace(s, "$1 graus Fahrenheit");
        s = DEG.Replace(s, "$1 graus");

        s = CLOCK_H.Replace(s, m => ClockWords(
            Js.Number(m.Groups[1].Value),
            m.Groups[2].Success && m.Groups[2].Value.Length > 0 ? Js.Number(m.Groups[2].Value) : null));
        s = CLOCK_COLON.Replace(s, m => ClockWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)));

        s = MINUS.Replace(s, "$1menos $2");
        // ± is a single character (U+00B1), not a `+`, so no `+` rule can ever match inside it.
        s = PLUS_MINUS.Replace(s, " mais menos ");
        s = PLUS_ATTACHED.Replace(s, "$1 mais $2");
        s = PLUS_LEADING.Replace(s, "$1mais $2");

        s = EQUALS_RE.Replace(s, " igual a ");
        s = LESS_THAN.Replace(s, " menor que ");
        s = GREATER_THAN.Replace(s, " maior que ");
        s = DIVIDE.Replace(s, " dividido por ");

        s = FRACTION.Replace(s, m =>
            FractionWords((int)Js.Number(m.Groups[1].Value), (int)Js.Number(m.Groups[2].Value)) ?? m.Value);

        if (brazilian)
            s = FIRST_OF_MONTH.Replace(s, m => $"primeiro de {m.Groups[1].Value}");

        return s;
    }

    /** An hour/minute pair → "sete horas e dezenove" / "uma hora". */
    private static string ClockWords(double h, double? min)
    {
        var head = $"{FeminineCardinal(h)} {(h == 1 ? "hora" : "horas")}";
        return min is null || min == 0 ? head : $"{head} e {FeminineCardinal(min.Value)}";
    }
}
