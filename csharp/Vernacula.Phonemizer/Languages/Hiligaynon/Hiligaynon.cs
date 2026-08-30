/**
 * Native Hiligaynon / Ilonggo (hil) text phonemizer — canonical IPA.
 * Ported from src/languages/hiligaynon/hiligaynon.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hiligaynon;

public sealed class HiligaynonDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> SpecialWords { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public HilNumbers Numbers { get; init; } = new();
}

public sealed class HiligaynonPhonemizer : ILanguage
{
    public static readonly HiligaynonDef DEF = LoadManifest.Load<HiligaynonDef>("languages/hiligaynon", "hiligaynon.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private static bool IsVowelLetter(string c) => "aeiou".Contains(c, StringComparison.Ordinal);
    private const string VOWEL_PH = "aeiou";

    /** Scan a lowercased Hiligaynon word → IPA units (trigraphs/digraphs, single letters, glottal stops). */
    private static List<string> Scan(string w)
    {
        var s = Js.CodePoints(w);
        var outp = new List<string>();
        for (var i = 0; i < s.Count;)
        {
            var c = s[i];
            if (c == "-" || c == "‑")
            {
                if (outp.Count > 0 && i + 1 < s.Count) outp.Add("ʔ"); // intra-word hyphen → glottal
                i++;
                continue;
            }
            var tg = c + (i + 1 < s.Count ? s[i + 1] : "") + (i + 2 < s.Count ? s[i + 2] : "");
            if (DEF.Digraphs.TryGetValue(tg, out var tgph) && tgph.Length > 0)
            {
                outp.Add(tgph);
                i += 3;
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
                // Glottal stop: word-initial before a vowel, and between two vowels in hiatus.
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

    /** Stress the PENULTIMATE vowel nucleus (default; phonemic stress is unwritten, ~majority penultimate). */
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

    /** One Hiligaynon word → canonical IPA (penultimate stress; final-glottal deferred). */
    public static string PhonemizeWord(string word)
    {
        var lw = Js.ToLowerCase(word);
        var units = Scan(DEF.SpecialWords.TryGetValue(lw, out var special) ? special : lw);
        if (units.Count == 0) return "";
        return Stressed(units).Normalize(NormalizationForm.FormC);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'ʼ-")})|(\\d+)|([.?!,;:])", "giu");

    /** This language's OWN inventory: a token the class rejects carries a letter the language does not use. */
    private const string NATIVE_CLASS = "[a-zñ'ʼ-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeHiligaynon(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            // Native cardinal numbers (Numbers.cs): one word per emitted token so each takes its own penult stress.
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' ')) sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Hiligaynon phonemizer (rule g2p + penultimate stress + native cardinal numbers; final-glottal deferred). */
    public static ILanguage CreateHiligaynon() => new HiligaynonPhonemizer();

    internal static void RegisterSelf() => Registry.Register("hiligaynon", CreateHiligaynon);
}
