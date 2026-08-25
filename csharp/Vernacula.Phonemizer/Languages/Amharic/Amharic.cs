/**
 * Native Amharic / አማርኛ (am) text phonemizer — canonical IPA.
 * Ported from src/languages/amharic/amharic.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Amharic;

public sealed class AmharicNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public string TeenPrefix { get; init; } = "";
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
}

public sealed class AmharicDef
{
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public AmharicNumbersDef Numbers { get; init; } = new();
    /** Cardinal → ordinal, for the FINAL word of a composed numeral. See the jsonc. */
    public IReadOnlyDictionary<string, string> Ordinals { get; init; } = new Dictionary<string, string>();
    /** The non-numeral, non-symbol words this layer speaks: the decimal point and the range frame. */
    public AmharicWords Words { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public AmharicSymbolTier SymbolTier { get; init; } = new();
}

public sealed class AmharicWords
{
    public string DecimalPoint { get; init; } = "";
    /** ⚠ `RangeFrom` WAS A BARE LITERAL in the replacement template on both sides — see the jsonc. */
    public string RangeFrom { get; init; } = "";
    public string RangeUntil { get; init; } = "";
}

/** Read a Latin run with another language's engine — injected from the registry. */
public delegate string ForeignPhonemizer(string latin);

public sealed class AmharicPhonemizer : ILanguage
{
    internal static readonly AmharicDef DEF = LoadManifest.Load<AmharicDef>("languages/amharic", "amharic.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static AmharicNumbersDef NUM => DEF.Numbers;

    /** One Amharic word → canonical IPA: fidel→CV lookup + 6th-order ɨ deletion (shared Ge'ez engine). */
    public static readonly Func<string, string> PhonemizeWord = Geez.MakeGeezG2P("languages/amharic", "fidel.tsv");

    private static string NumberToText(double n)
    {
        if (n < 0) return "";
        if (n < 10) return NUM.Units[(int)n];
        if (n == 10) return NUM.Ten;
        if (n < 20) return $"{NUM.TeenPrefix} {NUM.Units[(int)n - 10]}";
        if (n < 100)
        {
            int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
            return NUM.Tens[Js.NumberToString(t * 10)] + (u != 0 ? $" {NUM.Units[u]}" : "");
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), r = n % 100;
            return $"{(h > 1 ? NUM.Units[(int)h] + " " : "")}{NUM.Hundred}{(r != 0 ? " " + NumberToText(r) : "")}";
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            return $"{(th > 1 ? NumberToText(th) + " " : "")}{NUM.Thousand}{(r != 0 ? " " + NumberToText(r) : "")}";
        }
        foreach (var (value, scale) in new (double, string)[] { (1_000_000_000d, NUM.Billion), (1_000_000d, NUM.Million) })
        {
            if (n >= value)
            {
                double q = Math.Floor(n / value), r = n % value;
                return $"{NumberToText(q)} {scale}{(r != 0 ? " " + NumberToText(r) : "")}";
            }
        }
        return Js.NumberToString(n);
    }

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.CodePoints(digits).Select(c => PhonemizeWord(NumberToText(Js.Number(c)))));
        return string.Join(" ", NumberToText(n).Split(' ').Select(w => PhonemizeWord(w)));
    }

    private static readonly JsRe TOKEN = JsRegex.Compile("([ሀ-ፚ]+)|(\\d+)|([።፣፤፥፦፧፨.?!,;:])", "gu");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = DEF.SymbolTier.Percent,
        Currency = DEF.SymbolTier.Currency,
        Units = DEF.SymbolTier.Units,
        ExponentWords = DEF.SymbolTier.ExponentWords,
        Magnitudes = DEF.SymbolTier.Magnitudes,
        Ampersand = DEF.SymbolTier.Ampersand,
        Multiply = DEF.SymbolTier.Multiply,
    });

    /**
     * Text normalization. SYMBOLS is threaded through it — the ordering is load-bearing (normalize.ts §9).
     */
    private static readonly Func<string, string> NORMALIZE = Normalize.MakeAmharicNormalizer(NumberToText, SYMBOLS);

    private readonly ForeignPhonemizer? _foreign;

    public AmharicPhonemizer(ForeignPhonemizer? foreign = null) => _foreign = foreign;

    public string Text(string input)
    {
        return Clauses.AssembleClauses(NORMALIZE(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Number(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Amharic phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateAmharic(ForeignPhonemizer? foreign = null) => new AmharicPhonemizer(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("amharic", () => CreateAmharic(latin => Registry.ReadAsEnglish(latin)));
}

public sealed class AmharicSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}
