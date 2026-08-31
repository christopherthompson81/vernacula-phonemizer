/**
 * Lule Sami (smj) phonemizer — a transparent segmental grapheme scan (Ylikoski), canonical IPA. This file
 * owns the longest-match order (trigraphs → digraphs → geminate doubles) and the word-initial ⟨p t k⟩
 * aspiration rule, plus fixed first-syllable stress. The grapheme tables and the encyclopedic record (the
 * b/d/g voicelessness trap, the deferred morphophonology) live in lulesami.jsonc.
 *
 * ⚠ THE ORTHOGRAPHY TRAP, recorded because it looks like a bug: word-initial ⟨b d g⟩ are VOICELESS
 * unaspirated [p t k], not voiced — that is North-Saami-style orthography, and it is in the letters table.
 * ⟨p t k⟩ are the marginal ASPIRATED loan series, word-initially only; medially they are plain, which the
 * scan gets for free because a digraph or geminate has already been consumed by then.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.LuleSami;

public sealed class LuleSamiPhonemizer : ILanguage
{
    private static IReadOnlyList<IReadOnlyList<string>> MULTI => Manifest.DEF.Multigraphs;
    private static IReadOnlyDictionary<string, string> SINGLE => Manifest.DEF.Letters;

    /**
     * One Lule Sami word → canonical IPA (transparent segmental scan; morphophonology is the deferred
     * residual).
     *
     * ⚠ CODE UNITS, NOT CODE POINTS: the TS indexes `t[i]` and probes `t.startsWith(k, i)`, both code-unit
     * operations, so an astral character arrives as its two surrogate halves and each is offered to the
     * tables separately. ⚠ AND `Js.Normalize` RATHER THAN `string.Normalize`: .NET throws on an unpaired
     * surrogate where JS is indifferent (#1199), and this is a raw-word entry point.
     */
    public static string PhonemizeWord(string word)
    {
        var t = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var outp = new StringBuilder();
        var i = 0;
        while (i < t.Length)
        {
            // ⚠ FIRST match wins, not longest — the manifest's ORDER is the longest-first data, exactly as
            // the TS's `MULTI.find` takes it. `t.startsWith(k, i)` spelled with a span.
            IReadOnlyList<string>? dg = null;
            foreach (var pair in MULTI)
                if (t.AsSpan(i).StartsWith(pair[0], StringComparison.Ordinal)) { dg = pair; break; }
            if (dg is not null) { outp.Append(dg[1]); i += dg[0].Length; continue; }
            var c = t[i].ToString();
            var ph = SINGLE.TryGetValue(c, out var p) ? p : "";
            // ⟨p t k⟩ are the ASPIRATED loan series only WORD-INITIALLY (§9.2.2); medially they are plain (a
            // digraph ⟨tj ts⟩ or geminate has already been consumed above, so a bare initial p/t/k here is
            // the loan stop).
            if (i == 0 && (c == "p" || c == "t" || c == "k")) ph += "ʰ";
            outp.Append(ph);
            i++;
        }
        // Primary stress falls on the first syllable (fixed, Saami-wide) → the word onset.
        var s = outp.ToString();
        return s.Length > 0 ? Js.Normalize("ˈ" + s, NormalizationForm.FormC) : "";
    }

    /** Lule Sami letters (a-z + á å æ ä ø ö ŋ) / number / punctuation. */
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:…])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zŋáåæäøö]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input) =>
        Clauses.AssembleClauses(
            Normalize.NormalizeLuleSami(Rewriter.Renormalize(input, NormalizationForm.FormC)), TOKEN,
            (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string
                    // so the Number() conversion can't lose precision or go exponential.
                    var tok = m.Groups[2].Value;
                    var words = tok.Length <= 12 ? Numbers.NumberToWords(Js.Number(tok), tok) : Numbers.ReadDigits(tok);
                    foreach (var wd in words.Split(' ')) sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = m.Groups[3].Value;
                    sink.Pause(mk == "." || mk == "!" || mk == "?" ? mk : ",");
                }
            });

    /** Build the Lule Sami phonemizer (transparent segmental scan; Ylikoski-grounded). */
    public static ILanguage CreateLuleSami() => new LuleSamiPhonemizer();

    internal static void RegisterSelf() => Registry.Register("lulesami", CreateLuleSami);
}
