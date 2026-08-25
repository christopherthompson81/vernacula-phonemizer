/**
 * Asturian (ast) phonemizer — asturianu, Astur-Leonese (Ibero-Romance), Latin script, canonical IPA.
 * Ported from src/languages/asturian/asturian.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Asturian;

public sealed class AsturianDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> FrontLetters { get; init; } = Array.Empty<string>();
    public AsturianNumbers Numbers { get; init; } = new();
    /** The name of the DECIMAL COMMA, between the integer and fractional parts. */
    public string DecimalWord { get; init; } = "";
}

public sealed class AsturianPhonemizer : ILanguage
{
    internal static readonly AsturianDef DEF = LoadManifest.Load<AsturianDef>("languages/asturian", "asturian.jsonc");
    private static IReadOnlyDictionary<string, string> DIGRAPHS => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> G => DEF.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static readonly List<string> ORDER = DEF.Digraphs.Keys.OrderByDescending(k => k.Length).ToList();
    private static readonly IReadOnlySet<string> VOWEL_LETTER = new HashSet<string>(DEF.VowelLetters, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> FRONT_LETTER = new HashSet<string>(DEF.FrontLetters, StringComparer.Ordinal);

    private static bool StartsWithAt(string w, string key, int i) =>
        i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0;

    private static string At(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : "";

    /** Scan a lowercased Asturian word into IPA phone tokens. */
    private static List<string> Scan(string word)
    {
        var w = word.Normalize(NormalizationForm.FormC).ToLowerInvariant();
        var outp = new List<string>();
        var i = 0;
        while (i < w.Length)
        {
            string c = w[i].ToString(), next = At(w, i + 1);
            var matched = false;
            foreach (var key in ORDER)
            {
                if (!StartsWithAt(w, key, i)) continue;
                outp.Add(DIGRAPHS[key]);
                i += key.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            if ((c == "q" || c == "g") && (next == "u" || next == "ü") && VOWEL_LETTER.Contains(At(w, i + 2)))
            {
                var bas = c == "q" ? "k" : "ɡ";
                outp.Add(next == "ü" || !FRONT_LETTER.Contains(At(w, i + 2)) ? bas + "w" : bas);
                i += 2;
                continue;
            }
            if (c == "c") { outp.Add(FRONT_LETTER.Contains(next) ? "θ" : "k"); i += 1; continue; } // distinción
            if (c == "i" && VOWEL_LETTER.Contains(next)) { outp.Add("j"); i += 1; continue; }
            if (c == "u" && VOWEL_LETTER.Contains(next)) { outp.Add("w"); i += 1; continue; }
            if (c == "y") { outp.Add(VOWEL_LETTER.Contains(next) ? "ʝ" : "i"); i += 1; continue; }
            if (c == "r" && i == 0) { outp.Add("r"); i += 1; continue; }
            var ph = G.TryGetValue(c, out var g) ? g : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
            if (ph is not null && ph != "") outp.Add(ph);
            i += 1;
        }
        return outp;
    }

    /** ⟨n⟩ → [m] before a labial [b p m] (bienvenida→bjembenida; ⟨v⟩ is already [b]). */
    private static void LabialNasal(List<string> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
            if (toks[i] == "n" && (toks[i + 1] == "b" || toks[i + 1] == "p" || toks[i + 1] == "m")) toks[i] = "m";
    }

    /**
     * Phonemize a single Asturian word to canonical IPA (segmental; stress + spirantization folded/deferred).
     */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        LabialNasal(toks);
        return string.Concat(toks);
    }

    /** The shared SYMBOL tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "por cientu" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "euru", "euros" }, ["£"] = new[] { "llibra", "llibres" }, ["$"] = new[] { "dólar", "dólares" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "quilómetru", "quilómetros" }, ["m"] = new[] { "metru", "metros" },
            ["cm"] = new[] { "centímetru", "centímetros" }, ["mm"] = new[] { "milímetru", "milímetros" },
            ["kg"] = new[] { "quilogramu", "quilogramos" }, ["ha"] = new[] { "hectárea", "hectárees" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "cuadráu", "cuadraos" },
            Cubed = new[] { "cúbicu", "cúbicos" },
            Position = ExponentPosition.After,
        },
        Ampersand = "y",
        Magnitudes = new[] { "millón", "millones", "billón", "billones" },
    });

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'·")})|(\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    /**
     * ⚠ ḷ Ḷ ARE DELIBERATELY ABSENT: the g2p has no rule for them, and drops them outright — listing them
     * here would promise a reading that does not exist.
     */
    private const string NATIVE_CLASS = "[a-zñáéíóúüïḥA-ZÑÁÉÍÓÚÜÏḤ'·]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeAsturian(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var bits = m.Groups[2].Value.Split(',');
                var intPart = bits[0];
                string? frac = bits.Length > 1 ? bits[1] : null;
                foreach (var wd in Numbers.NumberToWords(Js.Number(intPart)).Split(' ')) sink.Emit(PhonemizeWord(wd));
                if (frac is not null)
                {
                    sink.Emit(PhonemizeWord(DEF.DecimalWord));
                    foreach (var dg in frac)
                        foreach (var wd in Numbers.NumberToWords(Js.Number(dg.ToString())).Split(' ')) sink.Emit(PhonemizeWord(wd));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Asturian phonemizer (Ibero-Romance g2p + x→ʃ + distinción; stress/spirantization folded). */
    public static ILanguage CreateAsturian() => new AsturianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("asturian", CreateAsturian);
}
