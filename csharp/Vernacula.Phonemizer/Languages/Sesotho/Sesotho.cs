/**
 * Sesotho / Southern Sotho (st) phonemizer — Bantu (Sotho-Tswana), Latin orthography, canonical IPA. A pure
 * greedy longest-match scan over the grapheme table, the same engine shape as the sibling Setswana; Sesotho
 * is open CV, so there is no coda or syllabification logic. Signatures: EJECTIVE plain stops ⟨p t k⟩,
 * ⟨ts⟩→[t͡sʼ], ⟨hl⟩→[ɬ], ⟨a⟩→[ɑ]. Vowel height unwritten (default mid); tone deferred.
 * Ported from src/languages/sesotho/sesotho.ts — see that file and the jsonc for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sesotho;

public static class SesothoPhonemizer
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** Phonemize a single Sesotho word to canonical IPA (segmental; tone unwritten → not emitted). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
        var outp = new System.Text.StringBuilder();
        for (var i = 0; i < w.Length; )
        {
            var matched = false;
            foreach (var key in Manifest.KEYS)
            {
                if (i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0)
                {
                    outp.Append(G[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound. Consulted only on
            // the MISS branch, after every grapheme has been tried.
            if (!matched)
            {
                outp.Append(LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true }) ?? "");
                i++;
            }
        }
        return outp.ToString();
    }

    // A word (Sesotho letters incl. š and the ê/ô circumflex vowels) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a different question from TOKEN's script boundary above. */
    private const string NATIVE_CLASS = "[a-zšêô]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ⚠ `Normalize.NormalizeSesotho` OWNS THE SHARED SYMBOL TIER and calls it mid-pass, because st
            // needs rules on both sides of it. See its header.
            return Clauses.AssembleClauses(Normalize.NormalizeSesotho(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var tok = m.Groups[2].Value;
                    foreach (var wd in Numbers.NumberToWords(Js.Number(tok), tok).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Sesotho phonemizer (greedy rule g2p + the cardinal compositor; tone deferred). */
    public static ILanguage CreateSesotho() => new Engine();

    internal static void RegisterSelf() => Registry.Register("sesotho", () => CreateSesotho());
}
