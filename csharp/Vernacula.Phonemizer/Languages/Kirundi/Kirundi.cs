/**
 * Kirundi / Ikirundi (rn) phonemizer — Bantu (JD62, Rwanda-Rundi), Latin orthography, canonical IPA. A pure
 * greedy longest-match scan over the grapheme table; a NEAR-CLONE of Kinyarwanda with one confident delta,
 * ⟨j⟩ → d͡ʒ (the affricate, vs rw's fricative ʒ). Tone (H/L) is unwritten → DEFERRED.
 * Ported from src/languages/kirundi/kirundi.ts — see that file for the palatal series, for why the referee
 * (epitran run-Latn) is crude and partly circular, and for the NC-spirantisation deliberately not followed.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kirundi;

public sealed class KirundiPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** One Kirundi word → canonical IPA (segmental; no tone — Kirundi tone is unwritten). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
        var outp = new StringBuilder();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in Manifest.GRAPHEME_KEYS)
            {
                if (i <= w.Length - key.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0)
                {
                    outp.Append(G[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound, and dropping it
            // deletes what the writer typed. Consulted only on the MISS branch, after every grapheme
            // (including every digraph) has been tried.
            if (!matched)
            {
                outp.Append(LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true }) ?? "");
                i++;
            }
        }
        return outp.ToString();
    }

    // A word (Kirundi letters; the apostrophe marks vowel elision — a boundary, so it splits tokens) /
    // number / punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this class REJECTS carries a letter the language does not
     *  use, i.e. a foreign name. Distinct from TOKEN, which decides where the SCRIPT boundary falls. */
    private const string NATIVE_CLASS = "[a-z]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input) =>
        // ⚠ THE NORMALIZER OWNS THE SHARED SYMBOL TIER CALL — rn needs rules on BOTH sides of it and no
        // fixed wrapper order expresses that. So there is only one entry point here.
        Clauses.AssembleClauses(Normalize.NormalizeKirundi(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                // ⚠ THE TOKEN STRING IS PASSED AS `raw` (#1075) — the digit-at-a-time fallback cannot
                // recover the digits from the double it exists to bypass.
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
            }
        });

    /** Build the Kirundi phonemizer (greedy rule g2p; tone deferred). */
    public static ILanguage CreateKirundi() => new KirundiPhonemizer();

    internal static void RegisterSelf() => Registry.Register("kirundi", CreateKirundi);
}
