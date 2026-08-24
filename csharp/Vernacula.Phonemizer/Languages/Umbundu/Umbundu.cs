/**
 * Umbundu (umb) phonemizer — Bantu (R11, Angola), the Latin orthography, canonical IPA.
 * Ported from src/languages/umbundu/umbundu.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Umbundu;

public sealed class UmbunduPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static readonly JsRe TONE_MARKS = JsRegex.Compile("[̀́]", "gu");

    /** Strip the tone accents (acute U+0301 = H, grave U+0300 = L; tone is DEFERRED) but KEEP the nasalisation
     *  tilde (U+0303) — decompose, drop only the tone marks, recompose. */
    private static string StripTone(string w) =>
        TONE_MARKS.Replace(w.Normalize(NormalizationForm.FormD), "").Normalize(NormalizationForm.FormC);

    private static bool StartsWithAt(string w, string key, int i) =>
        i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0;

    /** Phonemize a single Umbundu word to canonical IPA (segmental; tone unwritten/deferred). */
    public static string PhonemizeWord(string word)
    {
        var w = StripTone(word.ToLowerInvariant());
        var outSb = new StringBuilder();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in Manifest.GRAPHEME_KEYS)
            {
                if (!StartsWithAt(w, key, i)) continue;
                outSb.Append(G[key]);
                i += key.Length;
                matched = true;
                break;
            }
            if (!matched)
            {
                outSb.Append(LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true }) ?? "");
                i++;
            }
        }
        return outSb.ToString();
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(['’]?\\p{Script=Latin}[\\p{Script=Latin}\\p{M}'’]*)|(\\d+)|([.!?…,;:])", "gu");

    private static readonly JsRe CURLY = JsRegex.Compile("’", "gu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeUmbundu(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(CURLY.Replace(m.Groups[1].Value, "'")));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' ')) sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Umbundu phonemizer (greedy rule g2p + the cardinal compositor; tone deferred). */
    public static ILanguage CreateUmbundu() => new UmbunduPhonemizer();

    internal static void RegisterSelf() => Registry.Register("umbundu", CreateUmbundu);
}
