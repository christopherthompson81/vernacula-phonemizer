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
    private static PortugueseManifest DEF => Manifest.MANIFEST;
    private static readonly string MONTHS = string.Join("|", DEF.Months);
    // ⚠ ONE SOURCE with the symbol tier in Portuguese.cs, which applies ⟨×⟩ and ⟨&⟩ in positions this file
    // does not reach.
    private static SignWords SIGN => DEF.SignWords;
    private static PortugueseDegree DEGREE => DEF.Degree;

    /**
     * The degree noun, agreeing with the count: *um grau*, *vinte graus*, *zero graus*.
     *
     * ⚠ THIS READS THE WHOLE NUMBER, NOT ITS LAST DIGIT. The three rules below used to capture `(\d)` — one
     * digit — which was invisible while the word was a hard-coded plural (`20 °C` → *vinte graus*, right by
     * luck: the leading digits pass through untouched) and wrong the moment the count is read off the
     * capture, since `21 °C` would have matched the `1` and said *grau*. The same trap is recorded in
     * Ukrainian/Normalize.cs, which hit it first.
     */
    private static string DegreeWord(string n) =>
        Js.Number(Js.ReplaceFirst(n, ",", ".")) == 1 ? DEGREE.Singular : DEGREE.Plural;

    /** Dotted abbreviations → the spoken words. `no.` is deliberately absent and handled separately: bare
     *  "no" is an extremely common Portuguese contraction (em + o), so only `nº`/`n.º`/`no` before a DIGIT
     *  counts. */
    /** Dotted abbreviations → the spoken words (portuguese.jsonc `dottedAbbrev`). `no.` is deliberately
     *  absent there: bare "no" is the contraction em+o and is everywhere, so only `nº`/`n.º`/`no` before a
     *  DIGIT counts. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = DEF.DottedAbbrev;

    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Portuguese letter names, each verified through this engine. */
    public static readonly Func<string, bool> IsUnreadablePortuguese = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{DEF.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(DEF.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(DEF.Phonotactics.Codas, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms spelled out. Authored in portuguese.jsonc beside the other hand-authored facts. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer =
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => DEF.LetterNames.GetValueOrDefault(l),
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
    private static string FeminineCardinal(double n) => FINAL_UM.Replace(Numbers.NumberToWords(n), DEF.FeminineOne);

    /** Suppletive fraction denominators (portuguese.jsonc `fractions`); the rest take the ordinal. */
    private static readonly IReadOnlyDictionary<string, string> DENOMINATOR = DEF.Fractions.Denominators;

    private static string? FractionWords(int num, int den)
    {
        if (den < 2 || num < 1) return null;
        var baseWord = DENOMINATOR.GetValueOrDefault(Js.NumberToString(den)) ?? RomanOrdinals.PortugueseOrdinal(den);
        if (baseWord is null) return null;
        return $"{Numbers.NumberToWords(num)} {(num > 1 ? $"{baseWord}s" : baseWord)}";
    }

    private static readonly JsRe GROUP_SPACE_RE = JsRegex.Compile($"(?<=\\d)(?<!(?<![\\d\\.,])0)[{GROUP_SPACE}](?=\\d{{3}}(?!\\d))", "gu");
    private static readonly JsRe THIN_SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe ERA_BC = JsRegex.Compile("\\ba\\.\\s?C\\.", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile("\\bd\\.\\s?C\\.", "giu");
    private static readonly JsRe NUMERO = JsRegex.Compile("\\b(?:n\\.º|nº|n°|no|núm\\.)\\s?(?=\\d)", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    // The grouped alternative must come FIRST, or a bare \d+ matches only the tail of `1.000º`. ° (U+00B0
    // DEGREE SIGN) is deliberately not an ordinal indicator here: "35°" is a temperature.
    private static readonly JsRe ORDINAL_INDICATOR = JsRegex.Compile("\\b([1-9]\\d{0,2}(?:\\.\\d{3})+|\\d+)\\.?(?:º|ª)", "gu");
    private static readonly JsRe FEMININE_MARK = JsRegex.Compile("ª", "u");
    private static readonly JsRe GROUPING_DOT = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe REAIS = JsRegex.Compile("R\\$\\s?(\\d[\\d.,]*)", "gu");
    private static readonly JsRe DOLLAR_CODE = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])(?:{string.Join("|", DEF.DollarCodes)})\\$(?=[ \\u00a0]?\\d)", "gu");  // space, NBSP
    // ⚠ `(?![\\p{L}\\p{M}])`, NOT `\\b`. JS defines `\\b` on ASCII `\\w`, so a following NON-ASCII letter
    // counted as a boundary and this fired when it must not — `25°Cölner` ate the ⟨C⟩ as Celsius. See
    // src/languages/*/normalize.ts, which carries the finding.
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?°\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?°\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?°", "gu");
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

        s = GROUP_SPACE_RE.Replace(s, "");
        s = GROUP_SPACE_RE.Replace(s, "");
        s = THIN_SPACES.Replace(s, " ");

        // Era markers run BEFORE the dotted-abbreviation rule, or the bare `a.` is claimed first.
        s = ERA_BC.Replace(s, DEF.EraMarkers.BeforeChrist);
        s = ERA_AD.Replace(s, DEF.EraMarkers.AfterChrist);

        s = NUMERO.Replace(s, $"{DEF.NumberSign} ");

        s = ABBREV_MID.Replace(s, m =>
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122). The pattern is built from this table's OWN keys but
            // carries `i`+`u`, so JS's fold widens it — `ſ`→`s`, and the Cyrillic `ᲀᲃᲅ` forms onto theirs —
            // and a near-miss MATCHES while its key is absent. The TS asserted non-null and spoke the word
            // "undefined"; this indexer THREW. Refuse the whole match.
            DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}{m.Groups[2].Value}" : m.Value);
        s = ABBREV_END.Replace(s, m =>
            DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}." : m.Value);

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
        s = DEG_C.Replace(s, m => $"{m.Groups[1].Value} {DegreeWord(m.Groups[1].Value)} {DEGREE.Celsius}");
        s = DEG_F.Replace(s, m => $"{m.Groups[1].Value} {DegreeWord(m.Groups[1].Value)} {DEGREE.Fahrenheit}");
        s = DEG.Replace(s, m => $"{m.Groups[1].Value} {DegreeWord(m.Groups[1].Value)}");

        s = CLOCK_H.Replace(s, m => ClockWords(
            Js.Number(m.Groups[1].Value),
            m.Groups[2].Success && m.Groups[2].Value.Length > 0 ? Js.Number(m.Groups[2].Value) : null));
        s = CLOCK_COLON.Replace(s, m => ClockWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)));

        s = MINUS.Replace(s, $"$1{SIGN.Minus} $2");
        // ± is a single character (U+00B1), not a `+`, so no `+` rule can ever match inside it.
        s = PLUS_MINUS.Replace(s, $" {SIGN.PlusMinus} ");
        s = PLUS_ATTACHED.Replace(s, $"$1 {SIGN.Plus} $2");
        s = PLUS_LEADING.Replace(s, $"$1{SIGN.Plus} $2");

        s = EQUALS_RE.Replace(s, $" {SIGN.Equals} ");
        s = LESS_THAN.Replace(s, $" {SIGN.LessThan} ");
        s = GREATER_THAN.Replace(s, $" {SIGN.GreaterThan} ");
        s = DIVIDE.Replace(s, $" {SIGN.DividedBy} ");

        s = FRACTION.Replace(s, m =>
            FractionWords((int)Js.Number(m.Groups[1].Value), (int)Js.Number(m.Groups[2].Value)) ?? m.Value);

        if (brazilian)
            s = FIRST_OF_MONTH.Replace(s, m => $"{DEF.Ordinals.Units[1]} de {m.Groups[1].Value}");

        return s;
    }

    /** An hour/minute pair → "sete horas e dezenove" / "uma hora". */
    private static string ClockWords(double h, double? min)
    {
        var head = $"{FeminineCardinal(h)} {(h == 1 ? DEF.Clock.Hour : DEF.Clock.Hours)}";
        return min is null || min == 0 ? head : $"{head} {DEF.Clock.Connector} {FeminineCardinal(min.Value)}";
    }
}
