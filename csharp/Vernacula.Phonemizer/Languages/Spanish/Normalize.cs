/**
 * Spanish (es / es-419) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Third language to get this treatment, after English and French, and it reuses the shared tiers:
 * `core/normalizeSymbols.ts` for %, currency and units, `core/initialisms.ts` for acronyms, and the
 * registry's `core/roman.ts` pass for Roman numerals. What is left here is what is genuinely
 * Spanish-specific: its abbreviations, its ordinal indicators, and the shape of its dates and times.
 *
 * ORDERING — the couplings, measured against the es_419 FLEURS corpus (2,796 utterances):
 *   · `EE. UU.` is claimed BEFORE the generic dotted-abbreviation rule, or it splits into two abbreviations
 *     and reads as "ee . uu ." with two spurious pauses. At 31 occurrences it is by far the most frequent
 *     abbreviation in the corpus, and it expands to words (Estados Unidos), not to letters.
 *   · Era markers (`a. C.`, ×11, usually written WITH a space) run before the generic rule too, or the
 *     bare `a.` is claimed first.
 *   · Times run before units, so a unit rule cannot eat an hour.
 *   · Digit degrouping runs first so every later step sees one unbroken digit run.
 * Roman numerals need no ordering care here, unlike in English and French: `es` is not in the registry's
 * ROMAN_NATIVE set, so the shared pass converts them at the registry seam BEFORE this engine's text() is
 * called. By the time the initialism rule runs, `siglo XVIII` is already digits.
 *
 * NOT a problem in Spanish, in contrast to the other two: a bare 4-digit year is read as a plain cardinal
 * (1988 = mil novecientos ochenta y ocho), so there is no pair-wise year rule; the thousands-dot and
 * decimal-comma conventions were already handled by the number tokenizer; and % and currency already
 * worked through the shared symbol tier.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Spanish;

public sealed class SpanishNormalizeOptions
{
    /**
     * Latin-American usage. The one normalization difference between the varieties: the FIRST of the month
     * is an ordinal in America (*el primero de enero*) and a cardinal in Spain (*el uno de enero*). RAE,
     * DPD s.v. «fecha». Every other day is a cardinal in both.
     */
    public bool Americas { get; init; }
}

public static class Normalize
{
    /** Space characters used as digit-group separators: regular, NBSP, narrow NBSP, thin. */
    private const string GROUP_SPACE = "    ";

    private const string MONTHS = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";

    /**
     * Dotted abbreviations → the spoken words. `no.` is deliberately absent from this table and handled
     * separately, because bare "no" is one of the commonest words in Spanish.
     */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["sr"] = "señor", ["sra"] = "señora", ["srta"] = "señorita", ["sres"] = "señores",
        ["dr"] = "doctor", ["dra"] = "doctora", ["lic"] = "licenciado", ["ing"] = "ingeniero", ["prof"] = "profesor",
        ["d"] = "don", ["dña"] = "doña", ["dna"] = "doña", ["ud"] = "usted", ["uds"] = "ustedes",
        ["vd"] = "usted", ["vds"] = "ustedes",
        ["etc"] = "etcétera", ["pág"] = "página", ["págs"] = "páginas", ["pag"] = "página",
        ["núm"] = "número", ["num"] = "número", ["cap"] = "capítulo", ["art"] = "artículo", ["vol"] = "volumen",
        ["av"] = "avenida", ["avda"] = "avenida", ["cía"] = "compañía", ["cia"] = "compañía",
        ["sto"] = "santo", ["sta"] = "santa", ["vs"] = "versus", ["aprox"] = "aproximadamente", ["dpto"] = "departamento",
    };

    /** Longest first, so `págs` is not matched as `pág` plus a stray s. */
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Spanish letter names, each verified through this engine. `w` and `x`/`y` are the pan-American names. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "ce", ["d"] = "de", ["e"] = "e", ["f"] = "efe", ["g"] = "ge",
        ["h"] = "hache", ["i"] = "i", ["j"] = "jota", ["k"] = "ka", ["l"] = "ele", ["m"] = "eme", ["n"] = "ene",
        ["ñ"] = "eñe", ["o"] = "o", ["p"] = "pe", ["q"] = "cu", ["r"] = "erre", ["s"] = "ese", ["t"] = "te",
        ["u"] = "u", ["v"] = "uve", ["w"] = "doble uve", ["x"] = "equis", ["y"] = "ye", ["z"] = "zeta",
    };

    /** Spanish phonotactics, for the OOV rule in core/initialisms.ts. Spanish syllable structure is strict —
     *  `CD` [kð] and `ADN` [aðn] were both unpronounceable output. */
    public static readonly Func<string, bool> IsUnreadableSpanish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouáéíóúü]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "tl",
            "ch", "ll", "rr", "qu", "gu", "ps", "gn", "mn",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ch", "ll", "rr", "ns", "rs", "ls", "ds", "bs", "st", "rt", "rd", "rn", "rl", "rm",
            "lt", "ld", "ln", "nt", "nd", "nz", "nc", "ng", "rz", "rc", "rg", "sc", "sm", "cs", "ps",
        }, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms spelled out although the OOV rule would leave them alone. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = w => IsUnreadableSpanish(w),
    });

    /** Spanish has no pronunciation dictionary — the g2p is fully rule-based — so nothing is "recorded" in
     *  the sense core/initialisms.ts means. Acronyms are decided by the lexical list plus the OOV rule alone. */
    public static string NormalizeSpanishInitialisms(string text) => InitialismNormalizer(text);

    private static readonly JsRe FINAL_O = JsRegex.Compile("o$", "u");

    /** Feminine ordinal: every element of a compound inflects (vigésimo primero → vigésima primera). */
    private static string FeminineOrdinal(string masc) =>
        string.Join(" ", masc.Split(' ').Select(w => FINAL_O.Replace(w, "a")));

    private static readonly JsRe FINAL_UNO = JsRegex.Compile("uno$", "u");

    /** Non-negative integer → words with the final *uno* feminized (hora and minuto agreement). */
    private static string FeminineCardinal(double n) => FINAL_UNO.Replace(Numbers.NumberToWords(n), "una");

    /** An hour/minute pair → "las once", "la una quince". `hora` is feminine, so 1 and 21 take *una*. */
    private static string TimeWords(double h, double min)
    {
        var head = FeminineCardinal(h);
        return min == 0 ? head : $"{head} {FeminineCardinal(min)}";
    }

    /** Fraction denominators with a suppletive name; the rest take the ordinal (1/5 = un quinto). */
    private static readonly IReadOnlyDictionary<int, string> DENOMINATOR = new Dictionary<int, string>
    {
        [2] = "medio", [3] = "tercio",
    };

    private static string? FractionWords(double num, double den)
    {
        if (den < 2 || num < 1) return null;
        var bas = DENOMINATOR.TryGetValue((int)den, out var d) ? d
            : double.IsInteger(den) && den >= 1 && den <= 1000 ? RomanOrdinals.SpanishOrdinal((int)den) : null;
        if (bas is null) return null;
        // The numerator apocopates before the fraction noun: "un quinto", not "uno quinto".
        return $"{(num == 1 ? "un" : Numbers.NumberToWords(num))} {(num > 1 ? $"{bas}s" : bas)}";
    }

    private static readonly JsRe SPACE_GROUP_RE = JsRegex.Compile($"(\\d)[{GROUP_SPACE}](\\d{{3}})(?!\\d)", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<![\\d.,:])(?<!:\\d\\d)(\\d+)\\.(\\d{1,2})(?![\\d.,\\p{L}])", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile("\\ba\\.\\s?de\\s?C\\.|\\ba\\.\\s?C\\.", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile("\\bd\\.\\s?de\\s?C\\.|\\bd\\.\\s?C\\.", "giu");
    private static readonly JsRe EEUU_UPPER = JsRegex.Compile("\\bEE\\.\\s?UU\\.?", "gu");
    private static readonly JsRe EEUU_LOWER = JsRegex.Compile("\\bee\\.\\s?uu\\.?", "gu");
    private static readonly JsRe AM_PM = JsRegex.Compile("\\b([ap])\\.\\s?m\\.", "giu");
    private static readonly JsRe NUMERO_SIGN = JsRegex.Compile("\\b(?:n\\.º|nº|n°|n\\.|no\\.)\\s?(?=\\d)", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe ORDINAL_IND = JsRegex.Compile("\\b(\\d+)\\.?(?:er\\b|º|ª)", "gu");
    private static readonly JsRe DIGITS_IN = JsRegex.Compile("\\d+");
    private static readonly JsRe HAS_FEM = JsRegex.Compile("ª", "u");
    private static readonly JsRe HAS_ER = JsRegex.Compile("er$", "u");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})\\/(\\d{1,3})\\b(?!\\s*[/\\d])", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("\\b([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe FIRST_OF_MONTH = JsRegex.Compile($"\\b1\\.?º?\\s+de\\s+({MONTHS})\\b", "giu");
    private static readonly JsRe ONE_INDICATOR = JsRegex.Compile("1\\.?º?", "u");

    /** Normalize one Spanish input string. Pure text→text. */
    public static string NormalizeSpanish(string input, SpanishNormalizeOptions? options = null)
    {
        var americas = options?.Americas ?? false;
        var s = input;

        // 0) DIGIT GROUPING with a space. Spanish groups thousands with a period (17.000), which the number
        //    tokenizer already reads, but the SI space form also occurs and the number token cannot span a
        //    space, so "5 000 años" read as "cinco cero años".
        s = SPACE_GROUP_RE.Replace(s, "$1$2");
        s = SPACE_GROUP_RE.Replace(s, "$1$2");
        s = SPACES.Replace(s, " ");

        // 0b) ⚠ THE DOT ALSO DECIMATES, AND THE THREE-DIGIT TEST TELLS THE TWO APART: `2.3 millones` read as
        //     *veintitrés millones* — a silent 10× error. Measured over es_419: dot+3 digits ×5 (all
        //     grouping), dot+1–2 ×15 (all decimal). ⚠ SO THE COMMA IS LEFT ALONE — neither corpus writes a
        //     comma-grouped figure. ⚠ AND A FOLLOWING LETTER BLOCKS IT (`802.11n`, `2.4Ghz`); a preceding
        //     colon blocks the sports times.
        s = DOT_DECIMAL.Replace(s, "$1,$2");

        // 1) ERA MARKERS, before the generic abbreviation rule so the bare `a.` is not claimed first.
        s = ERA_BC.Replace(s, "antes de Cristo");
        s = ERA_AD.Replace(s, "después de Cristo");

        // 2) EE. UU. — the most frequent abbreviation in the corpus, and it expands to WORDS.
        s = EEUU_UPPER.Replace(s, "Estados Unidos");
        s = EEUU_LOWER.Replace(s, "Estados Unidos");

        // 2b) a. m. / p. m. — read as the LETTER NAMES in Spanish ([a ˈeme], [pe ˈeme]).
        s = AM_PM.Replace(s, m => m.Groups[1].Value.ToLowerInvariant() == "a" ? "a eme" : "pe eme");

        // 3) NÚMERO. `no.` only counts before a digit — bare "no" is one of the commonest Spanish words.
        //    `n.º` — n + period + the ORDINAL INDICATOR — is the form that actually occurs.
        s = NUMERO_SIGN.Replace(s, "número ");

        // 4) DOTTED ABBREVIATIONS. The dot is CONSUMED when the sentence continues; at a phrase end it stays.
        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        // 5) ORDINAL INDICATORS. `1º`/`1ª`/`1er`/`1.º` were reaching the phoneme string RAW. ° (U+00B0) is
        //    deliberately NOT an ordinal indicator: "20 °C" and "35°" are temperatures. Only º and ª.
        s = ORDINAL_IND.Replace(s, m =>
        {
            var n = Js.Number(DIGITS_IN.Match(m.Value).Value);
            var masc = double.IsInteger(n) && n >= 1 && n <= 1000 ? RomanOrdinals.SpanishOrdinal((int)n) : null;
            if (masc is null) return m.Value;
            if (HAS_FEM.IsMatch(m.Value)) return FeminineOrdinal(masc);
            if (HAS_ER.IsMatch(m.Value)) return FINAL_O.Replace(masc, ""); // apocopated: primer, tercer
            return masc;
        });

        // 6) SIGNS. A dropped sign is silent content loss, and for a temperature it inverts the meaning.
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
        s = PLUS_MINUS.Replace(s, " más menos ");
        s = PLUS_ATTACHED.Replace(s, "$1 más $2");
        s = PLUS_LEADING.Replace(s, "$1más $2");
        s = MINUS.Replace(s, "$1menos $2");

        // 6b) RELATIONAL AND DIVISION SIGNS. ⚠ SEARCH FOR THE WORDS, NEVER FOR THE SIGN. The División
        //     article reads the operation aloud in exactly this slot: "veinte dividido por cinco es igual a
        //     cuatro" — sourcing the division word AND the equals word in one sentence. The copula is dropped
        //     (`igual a`, not `es igual a`).
        s = EQUALS.Replace(s, " igual a ");
        s = LESS_THAN.Replace(s, " menor que ");
        s = GREATER_THAN.Replace(s, " mayor que ");
        s = DIVIDE.Replace(s, " dividido por ");

        // 7) FRACTIONS, guarded against a date and a unit ratio by requiring digits both sides.
        s = FRACTION.Replace(s, m =>
            FractionWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)) ?? m.Value);

        // 8) TIMES. The colon was becoming a PHRASE BREAK. `hora` is feminine, so 1 takes *una*.
        s = CLOCK.Replace(s, m => TimeWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)));

        // 9) DATES. The day is a cardinal, except the first of the month in American usage.
        s = FIRST_OF_MONTH.Replace(s, m =>
            americas ? $"primero de {m.Groups[1].Value}" : ONE_INDICATOR.Replace(m.Value, "uno"));

        return s;
    }
}
