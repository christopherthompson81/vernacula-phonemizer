/**
 * Native Tigrinya / ትግርኛ (ti) text phonemizer — canonical IPA. North Ethiosemitic, the Ge'ez/Fidäl
 * syllabary-abugida, read by the SHARED Ge'ez engine (Core/Geez.cs) over a Tigrinya fidel table.
 * Ported from src/languages/tigrinya/tigrinya.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tigrinya;

public sealed class TigrinyaNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public string TeenPrefix { get; init; } = "";
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public string Hundred { get; init; } = "";
    public string HundredConjoined { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
    public string Conjunction { get; init; } = "";
}

public sealed class TigrinyaDef
{
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public TigrinyaNumbersDef Numbers { get; init; } = new();
    /** ORDINALS 1–10, the Semitic pattern series. See the jsonc. */
    public IReadOnlyDictionary<string, string> Ordinals { get; init; } = new Dictionary<string, string>();
}

/** Read a Latin run with another language's engine — injected from the registry. */
public delegate string ForeignPhonemizer(string latin);

public sealed class TigrinyaPhonemizer : ILanguage
{
    internal static readonly TigrinyaDef DEF = LoadManifest.Load<TigrinyaDef>("languages/tigrinya", "tigrinya.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static TigrinyaNumbersDef NUM => DEF.Numbers;

    /** One Tigrinya word → canonical IPA: fidel→CV lookup + 6th-order ɨ deletion (shared Ge'ez engine). */
    public static readonly Func<string, string> PhonemizeWord = Geez.MakeGeezG2P("languages/tigrinya", "fidel.tsv");

    // ── Numbers (decimal; Tigrinya — Gaim, arXiv:2601.03403 Table 1 + §3.1-3.3) ───

    /** Suffix the ን conjunction onto a term's last word (ሚእቲ takes its ሚእትን allomorph). */
    private static List<string> Conjoin(List<string> term)
    {
        var last = term[^1];
        return new List<string>(term.Take(term.Count - 1))
        {
            last == NUM.Hundred ? NUM.HundredConjoined : last + NUM.Conjunction,
        };
    }

    /** Decompose n (> 0) into its additive terms, most significant first. */
    private static List<List<string>> Terms(double n)
    {
        foreach (var (value, scale) in new (double, string)[]
                 { (1_000_000_000d, NUM.Billion), (1_000_000d, NUM.Million), (1000d, NUM.Thousand), (100d, NUM.Hundred) })
        {
            if (n >= value)
            {
                double q = Math.Floor(n / value), r = n % value;
                var head = new List<string>();
                if (q != 1) head.AddRange(Words(q));
                head.Add(scale);
                var chain = new List<List<string>> { head };
                if (r != 0) chain.AddRange(Terms(r));
                return chain;
            }
        }
        if (n < 10) return new List<List<string>> { new() { NUM.Units[(int)n] } };
        if (n == 10) return new List<List<string>> { new() { NUM.Ten } };
        if (n < 20) return new List<List<string>> { new() { NUM.TeenPrefix, NUM.Units[(int)n - 10] } };
        double t = Math.Floor(n / 10) * 10, u = n % 10;
        var tens = new List<List<string>> { new() { NUM.Tens[Js.NumberToString(t)] } };
        if (u != 0) tens.Add(new List<string> { NUM.Units[(int)u] });
        return tens;
    }

    /** n ≥ 0 → the Tigrinya number words, conjunctions applied. */
    private static List<string> Words(double n)
    {
        if (n == 0) return new List<string> { NUM.Units[0] };
        var chain = Terms(n);
        var applied = chain.Count > 1 ? chain.Select(Conjoin).ToList() : chain;
        return applied.SelectMany(t => t).ToList();
    }

    private static string NumberToText(double n)
    {
        if (n < 0) return "";
        return string.Join(" ", Words(n));
    }

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // ⚠ OUT OF RANGE MUST STILL BE READ — see the TS; returning `digits` leaks ASCII into the IPA.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.CodePoints(digits).SelectMany(c => Words(Js.Number(c))).Select(w => PhonemizeWord(w)));
        return string.Join(" ", Words(n).Select(w => PhonemizeWord(w)));
    }

    private static readonly JsRe TOKEN = JsRegex.Compile("([ሀ-ፚ]+)|(\\d+)|([።፣፤፥፦፧፨.?!,;:])", "gu");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "ሚእታዊት" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "ዶላር" },
            ["€"] = new[] { "ዩሮ" },
            ["£"] = new[] { "ፓውንድ" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "ኪሎ ሜተር" },
            ["m"] = new[] { "ሜተር" },
            ["kg"] = new[] { "ኪሎ ግራም" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "ትርብዒት" },
            Position = new ExponentPositionSpec { Squared = ExponentPosition.Before },
        },
        Magnitudes = new[] { "ሚልዮን", "ቢልዮን", "ትሪልዮን" },
    });

    /** Text normalization. SYMBOLS is threaded through it — the ordering is load-bearing (normalize.ts §9). */
    private static readonly Func<string, string> NORMALIZE = Normalize.MakeTigrinyaNormalizer(NumberToText, SYMBOLS);

    private readonly ForeignPhonemizer? _foreign;

    public TigrinyaPhonemizer(ForeignPhonemizer? foreign = null) => _foreign = foreign;

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

    /** Build the Tigrinya phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateTigrinya(ForeignPhonemizer? foreign = null) => new TigrinyaPhonemizer(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("tigrinya", () => CreateTigrinya(latin => Registry.ReadAsEnglish(latin)));
}
