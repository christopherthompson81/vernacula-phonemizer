/**
 * Mooré (mos) phonemizer — Niger-Congo GUR (Oti-Volta), the Latin (Burkinabé) orthography, canonical
 * IPA. A greedy longest-match scan over the grapheme table (manifest.ts) with two code rules:
 * CONSONANT GEMINATION (a doubled consonant is a geminate [Cː]) and NASAL place assimilation
 * (⟨n⟩→[ŋ] before g/k).
 * Ported from src/languages/mossi/mossi.ts — see that file for the corpus evidence.
 *
 * TONE (2-tone H/L) is not written in the orthography (contextual) → not emitted.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mossi;

public static class MossiPhonemizer
{
    private static readonly MossiManifest DEF = Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> G => DEF.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    // Base vowel letters — used only to keep the consonant-gemination rule from firing on a doubled
    // vowel (vowel length is the digraph table's job). The nasal tilde vowels start with one of these,
    // so a doubled consonant is unambiguously a consonant letter followed by itself.
    private static readonly HashSet<string> VOWEL_LETTERS =
        new(DEF.VowelLetters, StringComparer.Ordinal);

    /** JS `String.prototype.startsWith(seq, i)` — ordinal, on UTF-16 units. */
    private static bool StartsWithAt(string w, string seq, int i) =>
        i + seq.Length <= w.Length && string.CompareOrdinal(w, i, seq, 0, seq.Length) == 0;

    /** Phonemize a single Mooré word to canonical IPA (segmental; gemination; non-tonal). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var outp = new StringBuilder();
        var i = 0;
        while (i < w.Length)
        {
            // ⚠ UTF-16 UNITS, NOT CODE POINTS — the TS indexes `w[i]` on UTF-16 code units and the
            // port keeps it (PORTING.md: the TS behaviour, bugs included, is the specification).
            var cu = w[i];
            // consonant gemination: a doubled consonant letter → geminate [Cː]
            if (!VOWEL_LETTERS.Contains(cu.ToString()) && i + 1 < w.Length && w[i + 1] == cu
                && G.ContainsKey(cu.ToString()))
            {
                outp.Append(G[cu.ToString()]).Append('ː');
                i += 2;
                continue;
            }
            // nasal place assimilation: ⟨n⟩ → [ŋ] before a velar g/k (tenga→teŋɡa)
            if (cu == 'n' && i + 1 < w.Length && (w[i + 1] == 'g' || w[i + 1] == 'k'))
            {
                outp.Append("ŋ");
                i += 1;
                continue;
            }
            var matched = false;
            foreach (var key in Manifest.GRAPHEME_KEYS)
            {
                if (StartsWithAt(w, key, i))
                {
                    outp.Append(G[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound, and dropping
            // it deletes what the writer typed. Consulted only on the MISS branch, after every
            // grapheme (including every digraph) has been tried, so it can never override a reading
            // this language has an opinion about.
            if (!matched)
            {
                var ph = LatinPhones.LatinPhone(cu.ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true });
                if (ph is not null) outp.Append(ph);
                i += 1;
            }
        }
        return outp.ToString();
    }

    /**
     * A word (Mooré Latin letters + diacritics: ɛ ɩ ʋ ŋ, tilde nasals, combining tilde, glottal ʼ) /
     * number / punctuation token.
     *
     * ⚠ THE WORD GROUP IS BOUNDED TO LATIN SCRIPT AND MUST BEGIN WITH A LATIN LETTER, NOT MERELY
     * CONTAIN Latin-or-mark — see the TS header for the two failure modes the bounding prevents
     * (embedded foreign scripts claimed as words and never becoming a gap; a bare combining mark
     * claimed as a word).
     */
    private static readonly JsRe TOKEN = JsRegex.Compile(
        @"([ʼ']?\p{Script=Latin}[\p{Script=Latin}\p{M}ʼ']*)|(\d+)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // Normalize.cs runs FIRST, as a pure text→text pass: it de-groups thousands separators
            // (so a grouping comma is not read as clause punctuation) and reads the two sourceable
            // currency signs.
            Clauses.AssembleClauses(Normalize.NormalizeMossi(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                // numbers: composed to Mooré words (Numbers.cs: decimal, short-stem compounds), then
                // the same g2p. ⚠ THE RAW TOKEN GOES ALONG, so the digit-by-digit arm reads the digits
                // the text wrote rather than a double that has already lost them.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk))
                        sink.Pause(mk);
                }
            });
    }

    /** Build the Mooré phonemizer (greedy g2p + gemination; decimal numbers; tone deferred). */
    public static ILanguage CreateMossi() => new Engine();

    internal static void RegisterSelf() => Registry.Register("mossi", CreateMossi);
}
