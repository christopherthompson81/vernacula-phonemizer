/**
 * Sinhala (si) phonemizer — canonical IPA. The abugida parsing is the shared Core/Abugida.cs; the
 * Sinhala-specifics are a post-pass (homorganic anusvara, geminates, coda/final ව → w, the inherent-vowel
 * schwa alternation, initial stress).
 * Ported from src/languages/sinhala/sinhala.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sinhala;

public sealed class SinhalaPhonemizer : ILanguage
{
    private static SinhalaManifest MANIFEST => Manifest.MANIFEST;

    private static readonly JsRe GEMINATE =
        JsRegex.Compile("(t͡ʃ|d͡ʒ|t̪|d̪|ʂ|ʃ|[pbʈɖkɡmnŋɲlshjʋrf])\\1", "gu");
    private static readonly JsRe VOWEL_G = JsRegex.Compile("aᶦ|aᶷ|aː|æː|iː|uː|eː|oː|[aæiueoə]", "gu");

    private static Func<string, string>? G2P;
    private static string G2p(string word) =>
        (G2P ??= Abugida.MakeAbugidaG2P(MANIFEST, PhonologyLoader.LoadSharedPhonology()))(word);

    /** Reduce inherent/independent short 'a' to schwa 'ə'; the first vowel keeps 'a' unless it ends the word. */
    private static string ApplySchwa(string ipa)
    {
        var outp = new StringBuilder();
        var i = 0;
        var vi = -1;
        foreach (var m in JsRegex.MatchAll(VOWEL_G, ipa))
        {
            outp.Append(ipa, i, m.Index - i);
            vi++;
            if (m.Value == "a")
            {
                var atEnd = m.Index + 1 == ipa.Length;
                outp.Append(vi == 0 && !atEnd ? "a" : "ə");
            }
            else outp.Append(m.Value);
            i = m.Index + m.Value.Length;
        }
        return outp.Append(ipa, i, ipa.Length - i).ToString();
    }

    private static readonly IReadOnlyDictionary<string, string> NASAL_CODA = BuildNasalCoda();

    private static Dictionary<string, string> BuildNasalCoda()
    {
        var d = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var cls in MANIFEST.Anusvara.Classes)
            foreach (var c in Js.CodePoints(cls.Triggers))
                d[c] = cls.Nasal;
        return d;
    }

    private static readonly JsRe ANUSVARA = JsRegex.Compile("ං(.?)", "gu");

    /** Rewrite each ං to its homorganic nasal coda (default ම් = m). */
    private static string Anusvara(string word) => ANUSVARA.Replace(word, m =>
    {
        var nxt = m.Groups[1].Value;
        return (NASAL_CODA.TryGetValue(nxt, out var n) ? n : MANIFEST.Anusvara.Default) + nxt;
    });

    private static readonly JsRe CODA_W = JsRegex.Compile("ʋ(?![aæeiouəːᶦᶷ])", "gu");
    private static readonly JsRe FINAL_GEMINATE_W = JsRegex.Compile("ʋː[aə]?$", "u");
    private static readonly JsRe FINAL_W = JsRegex.Compile("ʋ[aə]?$", "u");

    /** One Sinhala word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var ipa = ApplySchwa(GEMINATE.Replace(G2p(Anusvara(word)), "$1ː"));
        ipa = CODA_W.Replace(ipa, "w");
        ipa = FINAL_GEMINATE_W.Replace(ipa, "wː");
        ipa = FINAL_W.Replace(ipa, "w");
        // Stress: ˈ on the first vowel; ˌ on even nucleus indices ≥2 EXCEPT the last nucleus.
        var nuclei = JsRegex.MatchAll(VOWEL_G, ipa);
        var outp = new StringBuilder();
        var i = 0;
        for (var vi = 0; vi < nuclei.Count; vi++)
        {
            var m = nuclei[vi];
            outp.Append(ipa, i, m.Index - i);
            outp.Append(vi == 0
                ? "ˈ"
                : vi >= 2 && vi % 2 == 0 && vi != nuclei.Count - 1
                    ? "ˌ"
                    : "");
            outp.Append(m.Value);
            i = m.Index + m.Value.Length;
        }
        return outp.Append(ipa, i, ipa.Length - i).ToString();
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN = JsRegex.Compile("([඀-෿]+)|(\\d+)|([.!?…,;:])", "gu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Unicode.FoldNativeDigits(Normalize.NormalizeSinhala(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    internal static void RegisterSelf() => Registry.Register("sinhala", () => new SinhalaPhonemizer());
}
