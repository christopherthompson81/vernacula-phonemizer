/**
 * Malagasy (mg) phonemizer — Standard/Official Malagasy (Merina), canonical IPA. Rule g2p (G2p.cs) plus
 * penultimate stress; Text() tokenizes words / numbers / punctuation.
 * Ported from src/languages/malagasy/malagasy.ts — see that file for the design notes.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malagasy;

public sealed class MalagasyPhonemizer : ILanguage
{
    /** Phonemize a single Malagasy word to canonical IPA (penultimate stress, before the stressed vowel). */
    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word);
        var nuclei = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].Nucleus) nuclei.Add(i);
        if (nuclei.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        // Penultimate stress (monosyllables → their only vowel).
        var stressIdx = nuclei.Count >= 2 ? nuclei[^2] : nuclei[0];
        var outp = new StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) outp.Append('ˈ');
            outp.Append(segs[i].Ph);
        }
        return outp.ToString();
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    // A word (Malagasy letters + apostrophe for elision: n'ny), a number, or clause punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "", "'’")})|(\\d+)|([.!?…,;:])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS: TOKEN decides where the SCRIPT boundary
     * falls (routing); this decides whether the g2p has rules for these letters.
     */
    private const string NATIVE_CLASS = "[a-zàâôé]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeMalagasy(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Malagasy phonemizer (rule g2p + penultimate stress). */
    public static ILanguage CreateMalagasy() => new MalagasyPhonemizer();

    internal static void RegisterSelf() => Registry.Register("malagasy", CreateMalagasy);
}
