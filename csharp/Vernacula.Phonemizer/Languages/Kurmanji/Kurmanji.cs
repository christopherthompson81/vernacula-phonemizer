/**
 * Kurmanji / Northern Kurdish (kmr) phonemizer — Iranian, the Latin (Hawar) alphabet, canonical IPA.
 * Near-phonemic left-to-right scan (the ⟨xw⟩ digraph, then single letters) + final-syllable stress.
 * Ported from src/languages/kurmanji/kurmanji.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kurmanji;

public static class KurmanjiPhonemizer
{
    private static IReadOnlyDictionary<string, string> DIGRAPHS => Manifest.MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> VOWELS => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private readonly record struct Seg(string Ph, bool V);

    private static readonly JsRe VELAR = JsRegex.Compile("^[kɡ]", "u");

    /** Scan a lowercased Kurmanji word into IPA segments (xw digraph, then single letters). */
    private static List<Seg> ToSegments(string word)
    {
        var w = Js.ToLowerCase(word);
        var segs = new List<Seg>();
        for (var i = 0; i < w.Length;)
        {
            var two = w[i..Math.Min(i + 2, w.Length)];
            if (DIGRAPHS.TryGetValue(two, out var dg))
            {
                segs.Add(new Seg(dg, false));
                i += 2;
                continue;
            }
            var c = w[i].ToString();
            if (VOWELS.TryGetValue(c, out var v)) segs.Add(new Seg(v, true));
            else if (CONS.TryGetValue(c, out var k)) segs.Add(new Seg(k, false));
            i++; // unknown char (punctuation) → skip
        }
        // Nasal place assimilation: /n/ → [ŋ] before a velar stop k/ɡ.
        for (var k = 0; k < segs.Count - 1; k++)
            if (segs[k].Ph == "n" && VELAR.IsMatch(segs[k + 1].Ph)) segs[k] = segs[k] with { Ph = "ŋ" };
        return segs;
    }

    /** One Kurmanji word → canonical IPA with final-syllable stress (before the last vowel nucleus). */
    public static string PhonemizeWord(string word)
    {
        var segs = ToSegments(word);
        var nuclei = segs.Select((s, i) => s.V ? i : -1).Where(i => i >= 0).ToList();
        if (nuclei.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var stressIdx = nuclei[^1]; // final-syllable default
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp;
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'")})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this class REJECTS carries a letter Kurmanji does not use. */
    private const string NATIVE_CLASS = "[a-zêîûçşğẍḧ']";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            return Clauses.AssembleClauses(Normalize.NormalizeKurmanji(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var wd in KurmanjiNumbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Kurmanji phonemizer (near-phonemic g2p + final-syllable stress). */
    public static ILanguage CreateKurmanji() => new Engine();

    internal static void RegisterSelf() => Registry.Register("kurmanji", CreateKurmanji);
}
