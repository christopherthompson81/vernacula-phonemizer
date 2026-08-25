/**
 * Tajik (tg) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/tajik/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tajik;

public static class Normalize
{
    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile("[аоеиуӯёюяӣэ]$", "u");

    /** Tajik ordinal ending: -юм after a vowel, -ум after a consonant. */
    private static string OrdinalEnding(string word)
    {
        if (word == "сӣ") return "сиюм";
        return ENDS_VOWEL.IsMatch(word) ? $"{word}юм" : $"{word}ум";
    }

    /** Integer → the Tajik ordinal in ORTHOGRAPHY (emitted as text, phonemized by the g2p). */
    public static string? TajikOrdinal(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n > 999_999) return null;
        var parts = TajikPhonemizer.NumberWords(n).Split(' ');
        var last = parts.Length > 0 ? parts[^1] : null;
        if (last is null || last == "") return null;
        parts[^1] = OrdinalEnding(last);
        return string.Join(" ", parts);
    }

    /** Glue a bound suffix to the LAST WORD of a spoken number. */
    private static string GlueSuffix(string words, string suffix)
    {
        var parts = words.Split(' ');
        parts[^1] = $"{parts[^1]}{suffix}";
        return string.Join(" ", parts);
    }

    /** The Tajik enclitics that appear glued to a numeral, a percent sign or a unit in the corpus. */
    private const string SUFFIX = "ро|и|ест|аш|ат|ам|он|ҳо";

    /** Tajik phonotactics for the OOV half of `core/initialisms.ts`. */
    public static readonly Func<string, bool> IsUnreadableTajik = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{Manifest.MANIFEST.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Codas, StringComparer.Ordinal),
    });

    private static IReadOnlyDictionary<string, string> LETTER_NAME => Manifest.MANIFEST.LetterNames;
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    /** Spell an unreadable all-caps run with Tajik letter names. */
    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableTajik,
    });

    public static string NormalizeTajikInitialisms(string text) => INITIALISMS(text);

    /**
     * ⚠ CALLED FROM INSIDE `NormalizeTajik`, not wrapped around it — the tier matches a number
     * ADJACENT to its sign and still carrying its decimal comma, and three later steps destroy that.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        RateDenominators = Manifest.MANIFEST.SymbolTier.RateDenominators,
        UnitPer = Manifest.MANIFEST.SymbolTier.UnitPer,
        Magnitudes = Manifest.MANIFEST.SymbolTier.Magnitudes,
        Ampersand = Manifest.MANIFEST.SymbolTier.Ampersand,
    });

    private static string[] MONTHS => Manifest.MANIFEST.Months;

    // The step patterns. The TS builds each inline in `normalizeTajik`; JsRegex.Compile caches, so hoisting
    // them is a readability choice and not a behaviour one.
    private static readonly JsRe SOFT_HYPHEN = JsRegex.Compile("\\u00ad", "gu");
    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;?", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile("(\\d)[ \u00a0\u202f\u2009](\\d{3})(?![\\d])", "gu");
    private static readonly JsRe SOLI = JsRegex.Compile("(?<![\\p{L}\\p{M}])[Сс]\\.\\s?(?=\\d{3,4}(?![\\d]))", "gu");
    private static readonly JsRe DIGAR = JsRegex.Compile("(?<![\\p{L}\\p{M}])диг\\.", "gu");
    private static readonly JsRe GHAYRA = JsRegex.Compile("(?<![\\p{L}\\p{M}])ғ\\.(?=\\s|$|\\))", "gu");
    private static readonly JsRe MLRD_DOT = JsRegex.Compile("(?<=\\d\\s?)млрд\\.(?=\\s+[\\p{Ll}\\d])", "gu");
    private static readonly JsRe MLN_DOT = JsRegex.Compile("(?<=\\d\\s?)млн\\.(?=\\s+[\\p{Ll}\\d])", "gu");
    private static readonly JsRe HAZ_DOT = JsRegex.Compile("(?<=\\d\\s?)ҳаз\\.(?=\\s+[\\p{Ll}\\d])", "gu");
    private static readonly JsRe MLRD = JsRegex.Compile("(?<=\\d\\s?)млрд(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe MLN = JsRegex.Compile("(?<=\\d\\s?)млн(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe HAZ = JsRegex.Compile("(?<=\\d\\s?)ҳаз(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTTED_DATE = JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})(?![\\d.])", "gu");
    private static readonly JsRe DIGIT_COLON = JsRegex.Compile("(?<=\\d):(?=\\d)", "gu");
    private static readonly JsRe ORDINAL = JsRegex.Compile("(?<![\\d.,])(\\d+)-(ум|юм)([\\p{L}\\p{M}]*)", "gu");
    private static readonly JsRe PERCENT_ENCLITIC = JsRegex.Compile($"(\\d[\\d,]*)\\s?%-({SUFFIX})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe NUMBER_ENCLITIC = JsRegex.Compile($"(?<![\\d.,])(\\d+)-({SUFFIX})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)\\s?[-–—]\\s?(\\d)", "gu");
    private static readonly JsRe SPACED_DASH = JsRegex.Compile("\\s+[–—]\\s+", "gu");
    private static readonly JsRe DEG_CELSIUS = JsRegex.Compile($"(\\d)\\s?°\\s?[CСcс](?:-({SUFFIX}))?(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_FAHRENHEIT = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?°\\s?([NSEW])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile($"(\\d)\\s?°(?:-({SUFFIX}))?", "gu");
    private static readonly JsRe DENSITY = JsRegex.Compile("(?<![\\p{L}\\p{M}])([Ѐ-ӿ]{2,})\\s?\\/\\s?км(²|2)(?![\\p{L}\\p{M}\\d])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d./])(\\d{1,2})\\s?\\/\\s?(\\d{1,2})(?![\\d./])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<=\\d),(?=\\d)", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("([\\dЀ-ӿ])\\s*=\\s*([\\dЀ-ӿ])", "gu");

    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "шимолӣ", ["S"] = "ҷанубӣ", ["E"] = "шарқӣ", ["W"] = "ғарбӣ",
    };

    /** Normalize one Tajik input string. Pure text→text. */
    public static string NormalizeTajik(string input)
    {
        var s = input;

        s = JsRegex.Replace(JsRegex.Replace(s, SOFT_HYPHEN, _ => ""), NBSP_ENTITY, _ => " ");

        for (var i = 0; i < 3; i++) s = JsRegex.Replace(s, GROUP_SPACE, m => m.Groups[1].Value + m.Groups[2].Value);

        s = JsRegex.Replace(s, SOLI, _ => "соли ");
        s = JsRegex.Replace(s, DIGAR, _ => "дигар");
        s = JsRegex.Replace(s, GHAYRA, _ => "ғайра");
        s = JsRegex.Replace(s, MLRD_DOT, _ => "миллиард");
        s = JsRegex.Replace(s, MLN_DOT, _ => "миллион");
        s = JsRegex.Replace(s, HAZ_DOT, _ => "ҳазор");
        s = JsRegex.Replace(s, MLRD, _ => "миллиард");
        s = JsRegex.Replace(s, MLN, _ => "миллион");
        s = JsRegex.Replace(s, HAZ, _ => "ҳазор");

        s = JsRegex.Replace(s, DOTTED_DATE, m =>
        {
            double dv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            if (dv < 1 || dv > 31 || mv < 1 || mv > 12) return m.Value;
            return $"{Js.NumberToString(dv)} {MONTHS[(int)mv - 1]} соли {m.Groups[3].Value}";
        });

        s = JsRegex.Replace(s, DIGIT_COLON, _ => " ");

        s = JsRegex.Replace(s, ORDINAL, m =>
        {
            var ord = TajikOrdinal(Js.Number(m.Groups[1].Value));
            return ord is null ? m.Value : GlueSuffix(ord, m.Groups[3].Value);
        });

        s = JsRegex.Replace(s, PERCENT_ENCLITIC, m => $"{m.Groups[1].Value} дарсад{m.Groups[2].Value}");
        s = JsRegex.Replace(s, NUMBER_ENCLITIC, m =>
        {
            var w = TajikPhonemizer.NumberWords(Js.Number(m.Groups[1].Value));
            return w == "" ? m.Value : GlueSuffix(w, m.Groups[2].Value);
        });

        s = JsRegex.Replace(s, RANGE, m => $"{m.Groups[1].Value} то {m.Groups[2].Value}");

        s = JsRegex.Replace(s, SPACED_DASH, _ => " , ");

        s = JsRegex.Replace(s, DEG_CELSIUS,
            m => $"{m.Groups[1].Value} дараҷаи Селсий{(m.Groups[2].Success ? m.Groups[2].Value : "")}");
        s = JsRegex.Replace(s, DEG_FAHRENHEIT, m => $"{m.Groups[1].Value} дараҷаи Фаренгейт");
        s = JsRegex.Replace(s, DEG_COMPASS,
            m => $"{m.Groups[1].Value} дараҷаи {COMPASS[m.Groups[2].Value.ToUpperInvariant()]}");
        s = JsRegex.Replace(s, DEG_BARE,
            m => $"{m.Groups[1].Value} дараҷа{(m.Groups[2].Success ? m.Groups[2].Value : "")}");

        s = JsRegex.Replace(s, DENSITY, m => $"{m.Groups[1].Value} дар километри мураббаъ");

        s = SYMBOLS(s);

        s = JsRegex.Replace(s, FRACTION, m =>
        {
            double n = Js.Number(m.Groups[1].Value), d = Js.Number(m.Groups[2].Value);
            if (!(n >= 1 && n < d && d <= 10)) return m.Value;
            var den = TajikOrdinal(d);
            return den is null ? m.Value : $"{TajikPhonemizer.NumberWords(n)} {den}";
        });

        s = JsRegex.Replace(s, DECIMAL_COMMA, _ => " ");
        s = JsRegex.Replace(s, DECIMAL_DOT, m => $"{m.Groups[1].Value} {m.Groups[2].Value}");

        s = JsRegex.Replace(s, EQUALS, m => $"{m.Groups[1].Value} баробар аст ба {m.Groups[2].Value}");

        return s;
    }
}
