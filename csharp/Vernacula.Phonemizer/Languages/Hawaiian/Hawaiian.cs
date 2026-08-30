/**
 * Hawaiian (haw) phonemizer — ʻŌlelo Hawaiʻi, Eastern Polynesian (sibling of Māori), Latin script,
 * canonical IPA. One of the simplest phonologies in the world: 5 vowels + the macron (kahakō) = length,
 * 8 consonants + the ʻokina [ʔ]. A near-1:1 phonemic grapheme scan (no digraphs); loan letters adapt to
 * the nearest phoneme.
 * Ported from src/languages/hawaiian/hawaiian.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hawaiian;

public static class HawaiianPhonemizer
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** Phonemize a single Hawaiian word to canonical IPA — a direct single-grapheme scan. */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word.Normalize(NormalizationForm.FormC));
        var outp = new List<string>();
        // ⚠ CODE-POINT iteration, matching the TS `for (const ch of w)`: an unknown mark (hyphen etc.) is
        // skipped, and an astral letter is one element, not two halves.
        foreach (var ch in Js.CodePoints(w))
            if (G.TryGetValue(ch, out var ph)) outp.Add(ph);
        return string.Concat(outp);
    }

    // A word (Hawaiian Latin letters incl. the macron vowels and the ʻokina variants) / number /
    // punctuation. The combining-diacritics range keeps a DECOMPOSED macron vowel inside one token so
    // PhonemizeWord's NFC-normalize can recompose it.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'ʻʼ‘`-")})|(\\d+)|([.!?…,;:])", "gu");

    /** This language's OWN inventory — a different question from the TOKEN class above. */
    private const string NATIVE_CLASS = "[a-zāēīōūĀĒĪŌŪA-Z'ʻʼ‘`ʔ\u0300-\u036F-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // TEXT NORMALIZATION FIRST — its separator, coordinate, degree, clock and range steps need the
            // figure and its mark still adjacent, which the shared tier breaks.
            return Clauses.AssembleClauses(Normalize.NormalizeHawaiian(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // Cardinal numbers (numbers.ts) — emitted one word at a time, as for ordinary text.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Hawaiian phonemizer (direct phonemic g2p + macron length + ʻokina glottal + numbers). */
    public static ILanguage CreateHawaiian() => new Engine();

    internal static void RegisterSelf() => Registry.Register("hawaiian", () => CreateHawaiian());
}
