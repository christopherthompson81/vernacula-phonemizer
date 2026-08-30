/**
 * Native Ilocano / Iloko (ilo) text phonemizer — canonical IPA. Austronesian (Northern Luzon, Ilocano
 * subgroup — NOT Bisayan). A shallow near-phonemic Latin g2p (reads ilocano.jsonc): trigraphs
 * ⟨gui/gue/qui/que⟩ + digraph ⟨ng⟩→ŋ, then single letters, with a word-initial glottal stop [ʔ] before a
 * vowel and PENULTIMATE stress. The Ilocano-distinctive HIATUS: a HIGH vowel ⟨i u⟩ before another vowel
 * GLIDES (dua→dwa, radio→ɾadjo) while a non-high hiatus keeps the glottal (tao→taʔo).
 * Ported from src/languages/ilocano/ilocano.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ilocano;

public sealed class IlocanoDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IloNumbers Numbers { get; init; } = new();
}

public sealed class IlocanoPhonemizer : ILanguage
{
    public static readonly IlocanoDef DEF = LoadManifest.Load<IlocanoDef>("languages/ilocano", "ilocano.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private static bool IsVowelLetter(string c) => "aeiou".Contains(c, StringComparison.Ordinal);
    private const string VOWEL_PH = "aeiouɛ";

    /** Scan a lowercased Ilocano word → IPA units (trigraphs/digraphs, single letters, the gliding hiatus). */
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
                var nextIsVowel = i + 1 < s.Count && IsVowelLetter(s[i + 1]);
                var prev = outp.Count > 0 ? outp[^1] : null;
                var prevIsVowel = prev is { Length: > 0 } && VOWEL_PH.Contains(prev[0]);
                // A HIGH vowel ⟨i u⟩ directly before another vowel glides — i→[j], u→[w] (dua→dwa,
                // radio→ɾadjo, dies→djes) — unlike Bisayan's uniform glottal hiatus.
                if ((c == "i" || c == "u") && nextIsVowel && !prevIsVowel)
                {
                    outp.Add(c == "i" ? "j" : "w");
                    i++;
                    continue;
                }
                // Otherwise: glottal stop word-initially, or in a non-high hiatus (tao→taʔo, ao→aʔo).
                if (outp.Count == 0 || prevIsVowel) outp.Add("ʔ");
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

    /** Stress the PENULTIMATE vowel nucleus (default; phonemic stress unwritten). */
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

    /** One Ilocano word → canonical IPA by the RULE g2p only (high-vowel gliding hiatus + penult stress).
     *  This is the NON-CIRCULAR path the referee eval measures — it does NOT consult the referee-derived
     *  lexicon. */
    public static string PhonemizeWordRules(string word)
    {
        var units = Scan(Js.ToLowerCase(word));
        if (units.Count == 0) return "";
        return Stressed(units).Normalize(NormalizationForm.FormC);
    }

    // Pronunciation lexicon (word → IPA), mined from the stress-marked referees. Fixes the lexical residual
    // the rule cannot derive from spelling: gliding, the 6th vowel ⟨e⟩→[ɯ], and lexical stress.
    private static readonly Lazy<Dictionary<string, string>> Lex = new(() =>
        LoadTsv.LoadTsvMap("languages/ilocano", "ilo-lexicon.tsv"));

    /** One Ilocano word → canonical IPA. The shipped path: the pronunciation lexicon first (fixes the lexical
     *  gliding/stress/6th-vowel), then the rule g2p for OOV. */
    public static string PhonemizeWord(string word)
    {
        // ⚠ `Js.Normalize`, NOT `string.Normalize`. The subject is a RAW WORD, and .NET refuses a string
        // carrying an unpaired surrogate where JS returns it unchanged — so `PhonemizeWord("a\ud83d")`
        // THREW here while the TypeScript answered `ʔˈa`. A g2p that indexes UTF-16 units hands the halves
        // over one at a time, so this is a designed-for input. Found by an astral/surrogate walk: 2,205 of
        // 8,379 words threw. `PhonemizeWordRules` needs no guard — its subject is composed IPA. See #1199
        // for the other 45 sites in the fleet.
        var key = Js.Normalize(Js.ToLowerCase(word), NormalizationForm.FormC);
        return Lex.Value.TryGetValue(key, out var ipa) ? ipa : PhonemizeWordRules(word);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'ʼ-")})|(\\d+)|([.?!,;:])", "giu");

    /** This language's OWN inventory: a token the class rejects carries a letter the language does not use. */
    private const string NATIVE_CLASS = "[a-zñ'ʼ-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeIlocano(input), TOKEN, (m, sink) =>
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

    /** Build the Ilocano phonemizer (rule g2p + penultimate stress + native cardinal numbers). */
    public static ILanguage CreateIlocano() => new IlocanoPhonemizer();

    internal static void RegisterSelf() => Registry.Register("ilocano", CreateIlocano);
}
