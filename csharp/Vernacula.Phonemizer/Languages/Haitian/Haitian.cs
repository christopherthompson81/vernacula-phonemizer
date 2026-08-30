/**
 * Haitian Creole (ht) phonemizer — a greedy longest-match scan over the phonemic IPN orthography plus the
 * nasal-vowel rule (⟨an en on⟩ → [ã ɛ̃ ɔ̃] when the ⟨n⟩ is syllable-final).
 * Ported from src/languages/haitian/haitian.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Haitian;

public sealed class HaitianDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> HiatusVowels { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** Ordinal tails as [writtenEnding, spokenTail] pairs; the matching rule stays in Normalize.cs. */
    public IReadOnlyList<IReadOnlyList<string>> OrdinalTails { get; init; } = Array.Empty<IReadOnlyList<string>>();
}

public sealed class HaitianPhonemizer : ILanguage
{
    internal static readonly HaitianDef DEF =
        LoadManifest.Load<HaitianDef>("languages/haitian", "haitian.jsonc");

    private static readonly IReadOnlyDictionary<string, string> DIGRAPHS = DEF.Digraphs;
    private static readonly IReadOnlyDictionary<string, string> G = DEF.Graphemes;
    private static readonly IReadOnlyDictionary<string, string> CLAUSE_MARK = DEF.ClausePunctuation;
    // JS `Object.keys(…).sort((a, b) => b.length - a.length)`, a STABLE sort over INSERTION order —
    // LINQ's OrderByDescending is stable, `List.Sort` is not, so it has to be the LINQ one.
    // ⚠ A `Dictionary` does not promise insertion order the way a JS object does, and here that is
    // immaterial rather than merely unlikely to bite: the three digraph keys are the same length and no
    // two share a prefix, so at any position at most one can match and their relative order is unread.
    private static readonly IReadOnlyList<string> ORDER =
        DIGRAPHS.Keys.OrderByDescending(k => k.Length).ToList();
    private static readonly IReadOnlySet<string> HIATUS_VOWEL = new HashSet<string>(DEF.HiatusVowels, StringComparer.Ordinal);
    /** Plain ⟨a e o⟩ + a syllable-final ⟨n⟩ → the nasal vowel. */
    private static readonly IReadOnlyDictionary<string, string> NASAL =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["a"] = "ã", ["e"] = "ɛ̃", ["o"] = "ɔ̃" };

    /** Scan a lowercased Haitian word into IPA phone tokens (the digraphs + the context-dependent nasals). */
    private static List<string> Scan(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var outp = new List<string>();
        var i = 0;
        while (i < w.Length)
        {
            // JS indexes UTF-16 CODE UNITS here, so an astral character is scanned one surrogate at a time.
            var c = w[i].ToString();
            var matched = false;
            foreach (var key in ORDER)
            {
                if (w.AsSpan(i).StartsWith(key, StringComparison.Ordinal))
                {
                    outp.Add(DIGRAPHS[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            if (NASAL.ContainsKey(c) && i + 1 < w.Length && w[i + 1] == 'n')
            {
                var after = i + 2 < w.Length ? w[i + 2].ToString() : "";
                if (after == "n") { outp.Add(NASAL[c]); i += 2; continue; }   // ⟨Vnn⟩ → nasal + [n]
                if (HIATUS_VOWEL.Contains(after)) { outp.Add(G[c]); i += 1; continue; } // oral V + [n]
                outp.Add(NASAL[c]); i += 2; continue;                          // nasal, the [n] absorbed
            }
            if (G.TryGetValue(c, out var ph) && ph != "") outp.Add(ph);
            i += 1;
        }
        return outp;
    }

    private static readonly IReadOnlySet<string> VOWEL_PH = Ipa.IPA_VOWEL;

    /** Geminate collapse: a doubled consonant (from a loan spelling) → a single phone (accoma→akoma). */
    private static void Degeminate(List<string> toks)
    {
        for (var i = toks.Count - 1; i > 0; i--)
            if (toks[i] == toks[i - 1] && !VOWEL_PH.Contains(Js.CodePoints(toks[i])[0])) toks.RemoveAt(i);
    }

    /** The Haitian ⟨r⟩ [ɣ] → the glide [w] before a rounded vowel (ayeropò→ajewopɔ). */
    private static readonly IReadOnlySet<string> ROUNDED = new HashSet<string>(Js.CodePoints("ouɔ"), StringComparer.Ordinal);

    private static void RBeforeRounded(List<string> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
            if (toks[i] == "ɣ" && ROUNDED.Contains(Js.CodePoints(toks[i + 1])[0])) toks[i] = "w";
    }

    /** Phonemize a single Haitian Creole word to canonical IPA (segmental; stress folded/deferred). */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        Degeminate(toks);
        RBeforeRounded(toks);
        return string.Concat(toks);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'’-")})|(\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: TOKEN decides where the SCRIPT
     * boundary falls (routing), this one whether the g2p has rules for these letters.
     */
    private const string NATIVE_CLASS = "[a-zèòéàA-ZÈÒÉÀ'’-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeHaitian(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var digits = m.Groups[2].Value;
                foreach (var wd in Numbers.NumberToWords(Js.Number(digits), digits).Split(' ')) sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk != "") sink.Pause(mk);
            }
        });
    }

    /** Build the Haitian Creole phonemizer (phonemic IPN g2p + the nasal-vowel rule; stress folded). */
    public static ILanguage CreateHaitian() => new HaitianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("haitian", CreateHaitian);
}
