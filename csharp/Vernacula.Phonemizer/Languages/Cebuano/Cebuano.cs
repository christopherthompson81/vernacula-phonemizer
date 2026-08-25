/**
 * Native Cebuano / Sinugboanon (ceb) text phonemizer — canonical IPA.
 * Ported from src/languages/cebuano/cebuano.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cebuano;

public sealed class CebuanoDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> SpecialWords { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public CebNumbers Numbers { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public CebuanoSymbolTier SymbolTier { get; init; } = new();
}

public sealed class CebuanoPhonemizer : ILanguage
{
    internal static readonly CebuanoDef DEF = LoadManifest.Load<CebuanoDef>("languages/cebuano", "cebuano.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private static bool IsVowelLetter(string c) => "aeiou".Contains(c, StringComparison.Ordinal);
    private const string VOWEL_PH = "aeiou";

    /** Scan a lowercased Cebuano word → IPA units (digraphs, single letters, glottal stops). */
    private static List<string> Scan(string w)
    {
        var s = Js.CodePoints(w);
        var outp = new List<string>();
        for (var i = 0; i < s.Count;)
        {
            var c = s[i];
            if (c == "-" || c == "‑")
            {
                if (outp.Count > 0 && i + 1 < s.Count) outp.Add("ʔ");
                i++;
                continue;
            }
            var dg = c + (i + 1 < s.Count ? s[i + 1] : "");
            if (DEF.Digraphs.TryGetValue(dg, out var dgp) && dgp.Length > 0)
            {
                outp.Add(dgp);
                i += 2;
                continue;
            }
            if (IsVowelLetter(c))
            {
                var prev = outp.Count > 0 ? outp[^1] : null;
                if (outp.Count == 0 || (prev is { Length: > 0 } && VOWEL_PH.Contains(prev[0]))) outp.Add("ʔ");
                outp.Add(DEF.Vowels[c]);
                i++;
            }
            else if (DEF.Consonants.TryGetValue(c, out var cp) && cp.Length > 0)
            {
                outp.Add(cp);
                i++;
            }
            else i++; // unknown → skip
        }
        return outp;
    }

    /**
     * Stress the PENULTIMATE vowel nucleus (default; phonemic stress is unwritten, ~majority is penultimate).
     */
    private static string Stressed(IReadOnlyList<string> units)
    {
        var nuclei = new List<int>();
        for (var i = 0; i < units.Count; i++)
            if (units[i].Length > 0 && VOWEL_PH.Contains(units[i][0])) nuclei.Add(i);
        if (nuclei.Count == 0) return string.Concat(units);
        var idx = nuclei[nuclei.Count >= 2 ? nuclei.Count - 2 : 0];
        var outSb = new StringBuilder();
        for (var i = 0; i < units.Count; i++)
        {
            if (i == idx) outSb.Append('ˈ');
            outSb.Append(units[i]);
        }
        return outSb.ToString();
    }

    /** One Cebuano word → canonical IPA (penultimate stress). */
    public static string PhonemizeWord(string word)
    {
        var lw = word.ToLowerInvariant();
        var units = Scan(DEF.SpecialWords.TryGetValue(lw, out var special) ? special : lw);
        if (units.Count == 0) return "";
        return Stressed(units).Normalize(NormalizationForm.FormC);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'ʼ-")})|(\\d+)|([.?!,;:])", "giu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-zñ'ʼ-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeCebuano(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' ')) sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Cebuano phonemizer (rule g2p + penultimate stress; final-glottal deferred). */
    public static ILanguage CreateCebuano() => new CebuanoPhonemizer();

    internal static void RegisterSelf() => Registry.Register("cebuano", CreateCebuano);
}

public sealed class CebuanoSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, string> RateDenominators { get; init; } = new Dictionary<string, string>();
    public UnitPerSpec UnitPer { get; init; } = null!;
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}
