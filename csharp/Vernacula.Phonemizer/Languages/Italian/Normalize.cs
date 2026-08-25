/**
 * Italian (it) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/italian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Italian;

/** Singular/plural pair for a currency noun. */
public sealed record CurrencyForms(string Singular, string Plural);

public static class Normalize
{
    /** Word boundaries as explicit lookarounds. `\b` is ASCII-defined and matches INSIDE `città`/`perché` at
     *  the accent, which is precisely how the French rule came to fire in the middle of `siècle`. */
    private const string L = "(?<![\\p{L}\\p{M}])";
    private const string R = "(?![\\p{L}\\p{M}])";

    /**
     * Dotted abbreviations → the spoken words. `n.` is handled separately below, because it only means
     * *numero* before a digit.
     */
    private static ItalianDef DEF => ItalianPhonemizer.DEF;
    /** ⚠ ONE SOURCE with the symbol tier in Italian.cs. See italian.jsonc `signWords` for why the relational
     *  readings carry the copula, and `degree` for the agreement defect this lift did NOT fix. */
    private static SignWords SIGN => DEF.SignWords;
    private static ItalianDegree DEG => DEF.Degree;

    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = DEF.DottedAbbrev;

    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(a => a.Length));

    /**
     * Italian letter names, each verified through this engine's own g2p. The five letters outside the
     * native 21 take their conventional Italian names: j *i lunga*, k *cappa*, w *doppia vu*, x *ics*,
     * y *ipsilon*.
     */
public static readonly Func<string, bool> IsUnreadableItalian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{DEF.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(DEF.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(DEF.Phonotactics.Codas, StringComparer.Ordinal),
    });

    /** A canonical Roman numeral must never be letter-spelled. */
    private static bool IsRomanNumeral(string lower) => lower.Length >= 2 && Roman.RomanToInt(lower) is not null;

    /** LEXICAL: readable letter runs that Italian nevertheless spells out. */
    /** LEXICAL: readable letter runs Italian nevertheless spells out (italian.jsonc `acronymLetters`).
     *  ⚠ It was a bare set literal here — Italian was the only ported language whose acronym list was not
     *  in its manifest. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(DEF.AcronymLetters, StringComparer.Ordinal);

    /** Italian has no pronunciation dictionary — the g2p is fully rule-based — so nothing is "recorded" in the
     *  sense core/initialisms.ts means except the Roman-numeral guard above. */
    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => DEF.LetterNames.GetValueOrDefault(l),
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = IsRomanNumeral,
        IsUnreadable = IsUnreadableItalian,
    });

    public static string NormalizeItalianInitialisms(string text) => INITIALISMS(text);

    /** Masculine ordinal for n, from the language's own Roman-numeral policy (cardinal − final vowel + -esimo,
     *  with the 1–10 irregulars), so the ordinal data is authored once. */
    private static string? Ordinal(double n) =>
        double.IsInteger(n) && n >= int.MinValue && n <= int.MaxValue
            ? RomanOrdinals.ItalianOrdinal((int)n)
            : null;

    private static readonly JsRe FINAL_O = JsRegex.Compile("o$", "u");
    /** Feminine ordinal: the final -o becomes -a (decimo → decima). */
    private static string Feminine(string masc) => JsRegex.Replace(masc, FINAL_O, _ => "a");

    /** Fraction denominators with a suppletive name; the rest take the ordinal (1/5 = un quinto). Plural is the
     *  regular masculine -o → -i (tre quarti). */
    private static readonly IReadOnlyDictionary<string, string> DENOMINATOR = DEF.Fractions.Denominators;
    private static readonly JsRe FINAL_O_TO_I = JsRegex.Compile("o$", "u");

    private static string? FractionWords(double num, double den)
    {
        if (den < 2 || num < 1) return null;
        var basew = DENOMINATOR.TryGetValue(Js.NumberToString(den), out var sup)
            ? sup
            : Ordinal(den);
        if (basew is null) return null;
        return $"{(num == 1 ? DEF.Fractions.NumeratorOne : Js.NumberToString(num))} {(num > 1 ? JsRegex.Replace(basew, FINAL_O_TO_I, _ => "i") : basew)}";
    }

    /** The currency noun already spelled out right after the amount — see step 10. */
    private static readonly JsRe CURRENCY_WORD = JsRegex.Compile($"^\\s*(?:di\\s+)?(?:{string.Join("|", DEF.Symbols.CurrencyStems)})", "iu");

    /**
     * Compass letters after a degree sign — a geographic coordinate, not a temperature and not an ordinal.
     */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = DEF.Compass;

    // The step patterns. The TS builds several inline; JsRegex.Compile caches, so hoisting them here is a
    // readability choice and not a behaviour one.
    private static readonly JsRe DEGROUP = JsRegex.Compile("(\\d)\\.(\\d{3})(?!\\d)", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile($"{L}a\\.\\s?C\\.", "gu");
    private static readonly JsRe ERA_AD = JsRegex.Compile($"{L}d\\.\\s?C\\.", "gu");
    private static readonly JsRe NUMERO = JsRegex.Compile($"{L}(?:n\\.º|n\\.|nr\\.|nº)\\s?(?=\\d)", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"{L}({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\p{{N}}])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"{L}({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)\\]]|$))", "giu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?°\\s?([NSEW])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ORDINAL_IND = JsRegex.Compile("(\\d+)\\.?(?:º|ª|°)", "gu");
    private static readonly JsRe FEM_IND = JsRegex.Compile("ª", "u");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe CLOCK_DOT = JsRegex.Compile("((?:all[e'’]|alle ore|ore|dalle|verso le|le)\\s?)([01]?\\d|2[0-3])\\.([0-5]\\d)(?![\\d.])", "giu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<!\\d)(\\d{1,3})\\/(\\d{1,3})(?![\\d\\/])", "gu");
    private static readonly JsRe PLUS_JOINER = JsRegex.Compile("(?<=[\\p{L}\\p{M}])\\+(?=[\\p{L}\\p{M}])", "gu");
    private static readonly JsRe CURRENCY_PRE = JsRegex.Compile("([€$£¥])\\s?(\\d[\\d.,]*)(\\s+(?:miliardi|miliardo|milioni|milione|mila))?", "gu");
    private static readonly JsRe LEADING_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe SEPARATORS = JsRegex.Compile("[.,]", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d),(\\d)", "gu");

    /** Normalize one Italian input string. */
    public static string NormalizeItalian(string input)
    {
        var s = input;

        // 1) DIGIT DE-GROUPING — FIRST: `.` is clause punctuation, so `19.500` would read as two numbers
        //    with a pause. Applied twice so a two-separator number (5.000.000) collapses fully. Every later
        //    step — the clock, the ordinal, the unit tier — depends on seeing one unbroken digit run.
        s = JsRegex.Replace(s, DEGROUP, m => m.Groups[1].Value + m.Groups[2].Value);
        s = JsRegex.Replace(s, DEGROUP, m => m.Groups[1].Value + m.Groups[2].Value);

        // 2) ERA MARKERS, before the generic dotted-abbreviation rule (multi-dot before single-dot, or the
        //    interior dot of `a.C.` survives as a phrase break).
        s = JsRegex.Replace(s, ERA_BC, _ => DEF.EraMarkers.BeforeChrist);
        s = JsRegex.Replace(s, ERA_AD, _ => DEF.EraMarkers.AfterChrist);

        s = JsRegex.Replace(s, NUMERO, _ => $"{DEF.NumberSign} ");

        s = JsRegex.Replace(s, ABBREV_MID, m =>
            $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = JsRegex.Replace(s, ABBREV_END, m =>
            $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        // 5) DEGREE SIGN, in three senses, and they must be separated IN THIS ORDER because the ordinal rule
        //    in step 6 claims every remaining `\d°`. Temperature and coordinate are identified by the LETTER
        //    glued to the sign; the ordinal never has one. Also before the shared unit tier, which would
        //    otherwise leave the bare sign behind.
        s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} {DEG.Word} {DEG.Celsius}");
        s = JsRegex.Replace(s, DEG_F, m => $"{m.Groups[1].Value} {DEG.Word} {DEG.Fahrenheit}");
        s = JsRegex.Replace(s, DEG_COMPASS, m =>
            $"{m.Groups[1].Value} {DEG.Word} {COMPASS[m.Groups[2].Value.ToLowerInvariant()]}");

        // 6) ORDINAL INDICATORS `°`/`º`/`ª`. The temperature and coordinate senses were consumed in step 5,
        //    so what reaches here is the ordinal.
        s = JsRegex.Replace(s, ORDINAL_IND, m =>
        {
            var masc = Ordinal(Js.Number(m.Groups[1].Value));
            if (masc is null) return m.Value;
            return FEM_IND.IsMatch(m.Value) ? Feminine(masc) : masc;
        });

        // 7) CLOCK, before the unit tier so nothing claims the hour, and after de-grouping so the hour is a
        //    clean digit run. Minutes must be two digits, which keeps the grade `2:2` out of the rule.
        s = JsRegex.Replace(s, CLOCK_COLON, m =>
            Js.Number(m.Groups[2].Value) == 0 ? m.Groups[1].Value : $"{m.Groups[1].Value} e {m.Groups[2].Value}");
        s = JsRegex.Replace(s, CLOCK_DOT, m =>
            $"{m.Groups[1].Value}{(Js.Number(m.Groups[3].Value) == 0 ? m.Groups[2].Value : $"{m.Groups[2].Value} e {m.Groups[3].Value}")}");

        s = JsRegex.Replace(s, PLUSMINUS, _ => $" {SIGN.PlusMinus} ");
        s = JsRegex.Replace(s, PLUS_AFTER, m => $"{m.Groups[1].Value} {SIGN.Plus} {m.Groups[2].Value}");
        s = JsRegex.Replace(s, PLUS_START, m => $"{m.Groups[1].Value}{SIGN.Plus} {m.Groups[2].Value}");
        s = JsRegex.Replace(s, MINUS, m => $"{m.Groups[1].Value}{SIGN.Minus} {m.Groups[2].Value}");

        s = JsRegex.Replace(s, EQUALS, _ => $" {SIGN.Equals} ");
        s = JsRegex.Replace(s, LESS_THAN, _ => $" {SIGN.LessThan} ");
        s = JsRegex.Replace(s, GREATER_THAN, _ => $" {SIGN.GreaterThan} ");
        s = JsRegex.Replace(s, DIVIDE, _ => $" {SIGN.DividedBy} ");

        s = JsRegex.Replace(s, FRACTION, m =>
            FractionWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)) ?? m.Value);

        s = JsRegex.Replace(s, PLUS_JOINER, _ => $" {SIGN.Plus} ");

        // 10) CURRENCY WRITTEN BEFORE THE AMOUNT — claimed here because the shared tier's magnitude hop emits
        //     `5 milioni dollari` and Italian needs the partitive *di*. After step 1, so the amount is one run.
        var whole10 = s;
        s = JsRegex.Replace(s, CURRENCY_PRE, m =>
        {
            var sign = m.Groups[1].Value;
            var num = m.Groups[2].Value;
            var mag = m.Groups[3].Success ? m.Groups[3].Value : null;
            var after = whole10[(m.Index + m.Length)..];
            // The currency NOUN may already be written out beside the sign. Checked against the remaining
            // text rather than as a lookahead in the pattern: a lookahead after an OPTIONAL group is defeated
            // by backtracking — the engine drops the magnitude and matches anyway.
            if (CURRENCY_WORD.IsMatch(after)) return $"{num}{mag ?? ""}";
            var forms = CURRENCY[sign];
            var word = mag is not null || Js.Number(JsRegex.Replace(num, SEPARATORS, _ => "")) != 1 ? forms.Plural : forms.Singular;
            // ⚠ The noun must not FUSE with what follows: `$110m` welded into *dollˈarim*, one plausible-looking
            // word. The separator keeps *110 dollari* and leaves the `m` visible to RAW-LATIN.
            var tail = LEADING_LETTER.IsMatch(after) ? " " : "";
            return $"{num}{mag ?? ""} {(mag is null ? "" : "di ")}{word}{tail}";
        });

        return s;
    }

    /** Currency names, singular and plural. *euro* and *yen* are invariable in Italian (Accademia della Crusca:
     *  «euro» is unchanged in the plural), so both forms are the same word. Kept here rather than only in
     *  italian.ts because step 10 above needs them for the preposed form. */
    public static readonly IReadOnlyDictionary<string, CurrencyForms> CURRENCY = new Dictionary<string, CurrencyForms>(StringComparer.Ordinal)
    {
        ["€"] = new("euro", "euro"),
        ["$"] = new("dollaro", "dollari"),
        ["£"] = new("sterlina", "sterline"),
        ["¥"] = new("yen", "yen"),
    };

    /**
     * The DECIMAL COMMA, split out because of an ordering coupling: the shared unit/percent/currency tier
     * matches a unit only when a NUMBER is adjacent, and rewriting `1,5 km/s` first would leave the tier
     * looking at `5 km/s`. ItalianPhonemizer therefore calls this AFTER the symbol tier.
     */
    public static string NormalizeItalianDecimals(string input) =>
        JsRegex.Replace(input, DECIMAL_COMMA, m => $"{m.Groups[1].Value} {DEF.DecimalWord} {m.Groups[2].Value}");
}
