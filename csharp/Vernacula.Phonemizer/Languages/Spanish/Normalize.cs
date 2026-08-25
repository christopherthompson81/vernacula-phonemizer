/**
 * Spanish (es / es-419) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/spanish/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Spanish;

public sealed class SpanishNormalizeOptions
{
    /** Latin-American usage. */
    public bool Americas { get; init; }
}

public static class Normalize
{
    /** Space characters used as digit-group separators: regular, NBSP, narrow NBSP, thin. */
    private const string GROUP_SPACE = "    ";

    private static SpanishManifest DEF => Manifest.MANIFEST;
    private static readonly string MONTHS = string.Join("|", DEF.Months);

    /** Dotted abbreviations → the spoken words. */
    /** Dotted abbreviations → the spoken words (spanish.jsonc `dottedAbbrev`). `no.` is deliberately absent
     *  there and handled separately — bare "no" is one of the commonest words in Spanish, and only `no.`
     *  followed by a DIGIT is the number sign. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = DEF.DottedAbbrev;

    // ⚠ ONE SOURCE with the symbol tier in Spanish.cs, which applies ⟨×⟩ and ⟨&⟩ in the positions this file
    // does not reach.
    private static SignWords SIGN => DEF.SignWords;

    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Spanish letter names, each verified through this engine. `w`/`x`/`y` are the pan-American names. */
    public static readonly Func<string, bool> IsUnreadableSpanish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{DEF.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(DEF.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(DEF.Phonotactics.Codas, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms spelled out although the OOV rule would leave them alone. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => DEF.LetterNames.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = w => IsUnreadableSpanish(w),
    });

    /** Spanish has no pronunciation dictionary — the g2p is fully rule-based — so nothing is "recorded" in
     *  the sense core/initialisms.ts means. Acronyms rest on the lexical list plus the OOV rule alone. */
    public static string NormalizeSpanishInitialisms(string text) => InitialismNormalizer(text);

    private static readonly JsRe FINAL_O = JsRegex.Compile("o$", "u");

    /** Feminine ordinal: every element of a compound inflects (vigésimo primero → vigésima primera). */
    private static string FeminineOrdinal(string masc) =>
        string.Join(" ", masc.Split(' ').Select(w => FINAL_O.Replace(w, "a")));

    private static readonly JsRe FINAL_UNO = JsRegex.Compile($"{Manifest.MANIFEST.Numbers.Ones[1]}$", "u");

    /** Non-negative integer → words with the final *uno* feminized (hora and minuto agreement). */
    private static string FeminineCardinal(double n) => FINAL_UNO.Replace(Numbers.NumberToWords(n), DEF.FeminineOne);

    /** An hour/minute pair → "las once", "la una quince". `hora` is feminine, so 1 and 21 take *una*. */
    private static string TimeWords(double h, double min)
    {
        var head = FeminineCardinal(h);
        return min == 0 ? head : $"{head} {FeminineCardinal(min)}";
    }

    /** Fraction denominators with a suppletive name (spanish.jsonc `fractions`); the rest take the ordinal
     *  (1/5 = un quinto). */
    private static readonly IReadOnlyDictionary<string, string> DENOMINATOR = DEF.Fractions.Denominators;

    private static string? FractionWords(double num, double den)
    {
        if (den < 2 || num < 1) return null;
        var bas = DENOMINATOR.TryGetValue(Js.NumberToString(den), out var d) ? d
            : double.IsInteger(den) && den >= 1 && den <= 1000 ? RomanOrdinals.SpanishOrdinal((int)den) : null;
        if (bas is null) return null;
        return $"{(num == 1 ? DEF.Fractions.NumeratorOne : Numbers.NumberToWords(num))} {(num > 1 ? $"{bas}s" : bas)}";
    }

    private static readonly JsRe SPACE_GROUP_RE = JsRegex.Compile($"(\\d)[{GROUP_SPACE}](\\d{{3}})(?!\\d)", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space
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

        s = SPACE_GROUP_RE.Replace(s, "$1$2");
        s = SPACE_GROUP_RE.Replace(s, "$1$2");
        s = SPACES.Replace(s, " ");

        s = DOT_DECIMAL.Replace(s, "$1,$2");

        // ⚠ ERA MARKERS before the generic abbreviation rule, or the bare `a.` is claimed first; then
        //   `EE. UU.`, before the generic rule too, or it splits into two abbreviations and two pauses.
        s = ERA_BC.Replace(s, DEF.EraMarkers.BeforeChrist);
        s = ERA_AD.Replace(s, DEF.EraMarkers.AfterChrist);

        s = EEUU_UPPER.Replace(s, DEF.UnitedStates);
        s = EEUU_LOWER.Replace(s, DEF.UnitedStates);

        // ⚠ COMPOSED FROM `LetterNames`, not held as two more literals: the reading IS ⟨a⟩/⟨p⟩ followed by ⟨m⟩,
        // said as letter names, so a change to either name must reach here.
        s = AM_PM.Replace(s, m =>
            $"{DEF.LetterNames[m.Groups[1].Value.ToLowerInvariant()]} {DEF.LetterNames["m"]}");

        s = NUMERO_SIGN.Replace(s, $"{DEF.NumberSign} ");

        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        s = ORDINAL_IND.Replace(s, m =>
        {
            var n = Js.Number(DIGITS_IN.Match(m.Value).Value);
            var masc = double.IsInteger(n) && n >= 1 && n <= 1000 ? RomanOrdinals.SpanishOrdinal((int)n) : null;
            if (masc is null) return m.Value;
            if (HAS_FEM.IsMatch(m.Value)) return FeminineOrdinal(masc);
            if (HAS_ER.IsMatch(m.Value)) return FINAL_O.Replace(masc, ""); // apocopated: primer, tercer
            return masc;
        });

        s = PLUS_MINUS.Replace(s, $" {SIGN.PlusMinus} ");
        s = PLUS_ATTACHED.Replace(s, $"$1 {SIGN.Plus} $2");
        s = PLUS_LEADING.Replace(s, $"$1{SIGN.Plus} $2");
        s = MINUS.Replace(s, $"$1{SIGN.Minus} $2");

        s = EQUALS.Replace(s, $" {SIGN.Equals} ");
        s = LESS_THAN.Replace(s, $" {SIGN.LessThan} ");
        s = GREATER_THAN.Replace(s, $" {SIGN.GreaterThan} ");
        s = DIVIDE.Replace(s, $" {SIGN.DividedBy} ");

        s = FRACTION.Replace(s, m =>
            FractionWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)) ?? m.Value);

        s = CLOCK.Replace(s, m => TimeWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)));

        s = FIRST_OF_MONTH.Replace(s, m =>
            americas ? $"{DEF.Ordinals.Units[1]} de {m.Groups[1].Value}" : ONE_INDICATOR.Replace(m.Value, DEF.Numbers.Ones[1]));

        return s;
    }
}
