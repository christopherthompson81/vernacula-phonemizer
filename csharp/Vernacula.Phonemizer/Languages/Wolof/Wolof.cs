/**
 * Wolof (wo) phonemizer — Atlantic-Congo (Senegambian), the Latin orthography, canonical IPA. NON-tonal. A
 * greedy longest-match scan over the grapheme table with two code rules: CONSONANT GEMINATION (a doubled
 * consonant is [Cː]) and NASAL place assimilation (⟨n⟩→ŋ before g/k). Signatures: the ATR vowel pairs with
 * DOUBLING = LENGTH, the palatal stops ⟨c j⟩, ⟨x⟩=x, ⟨ñ⟩=ɲ, ⟨q⟩=q. Wolofal and Garay are deferred.
 * Ported from src/languages/wolof/wolof.ts — see that file and the jsonc for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Wolof;

public static class WolofPhonemizer
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly HashSet<string> VOWEL_LETTERS = new(Manifest.MANIFEST.VowelLetters);

    /** Phonemize a single Wolof word to canonical IPA (segmental; gemination + nasal assimilation). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
        var outp = new System.Text.StringBuilder();
        var i = 0;
        string? At(int k) => k >= 0 && k < w.Length ? w[k].ToString() : null;
        while (i < w.Length)
        {
            var c = w[i].ToString();
            // consonant gemination: a doubled consonant letter → geminate [Cː]
            if (!VOWEL_LETTERS.Contains(c) && At(i + 1) == c && G.TryGetValue(c, out var gem) && gem.Length > 0)
            {
                outp.Append(gem).Append('ː');
                i += 2;
                continue;
            }
            // nasal place assimilation: ⟨n⟩ → ŋ before a velar g/k
            if (c == "n" && (At(i + 1) == "g" || At(i + 1) == "k"))
            {
                outp.Append('ŋ');
                i += 1;
                continue;
            }
            var matched = false;
            foreach (var key in Manifest.GRAPHEME_KEYS)
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
                outp.Append(LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0 }) ?? "");
                i += 1;
            }
        }
        return outp.ToString();
    }

    // A word (Wolof Latin letters incl. à é ë ó ñ ŋ) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a different question from TOKEN's script boundary above. */
    private const string NATIVE_CLASS = "[a-zàéëóñŋ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // TEXT NORMALIZATION FIRST — every word it emits goes through the same g2p below, which is why
            // nothing reaches the sink as a spelling. See Normalize.cs for the numbered order.
            return Clauses.AssembleClauses(Normalize.NormalizeWolof(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // numbers: the QUINARY/decimal Wolof system, then through the same g2p
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

    /** Build the Wolof phonemizer (greedy g2p + gemination; quinary numbers). */
    public static ILanguage CreateWolof() => new Engine();

    internal static void RegisterSelf() => Registry.Register("wolof", () => CreateWolof());
}
