/**
 * Latvian (lv) phonemizer — canonical IPA, latviešu, Baltic. Rule g2p (G2p.cs) + FIXED first-syllable stress
 * (emitted before the first nucleus — Latvian stress is predictable, unlike Lithuanian). Written length
 * (macrons) and written palatals are emitted directly; the syllable tone the narrow referee carries is
 * unwritten, so none is emitted. Ported from src/languages/latvian/latvian.ts.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latvian;

public sealed class LatvianPhonemizer : ILanguage
{
    /** One Latvian word → canonical IPA with fixed first-syllable stress (ˈ before the first nucleus). */
    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word);
        var first = -1;
        for (var i = 0; i < segs.Count; i++) if (segs[i].Nucleus) { first = i; break; }
        var outp = new StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == first) outp.Append('ˈ');
            outp.Append(segs[i].Ph);
        }
        return outp.ToString();
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class below decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — a foreign name, which
     * `Nat` then folds to a base the g2p does have a rule for.
     */
    private const string NATIVE_CLASS = "[A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŌōŠšŪūŽž]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /**
     * ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
     * out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and
     * the rest of the word started over: `São Paulo` fragmented into three pieces, none of them right.
     * Invisible to every gate: no digit or raw mark survives and nothing VANISHES.
     */
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "gu");

    public string Text(string input) =>
        Clauses.AssembleClauses(Normalize.NormalizeLatvian(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var tok = m.Groups[2].Value;
                var words = tok.Length <= 9 ? Numbers.NumberToWords(Js.Number(tok), tok) : Numbers.ReadDigits(tok);
                foreach (var wd in words.Split(' ')) sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });

    /** Build the Latvian phonemizer (rule g2p + first-syllable stress + cardinal numbers). */
    public static ILanguage CreateLatvian() => new LatvianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("latvian", CreateLatvian);
}
