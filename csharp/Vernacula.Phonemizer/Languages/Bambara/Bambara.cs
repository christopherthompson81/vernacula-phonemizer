/**
 * Bambara / Bamanankan (bm) phonemizer — Mande (Manding), canonical IPA. A greedy longest-match scan over the
 * grapheme table with ONE piece of code logic — NASALISATION: a syllable-final ⟨n⟩ nasalises the preceding
 * vowel and is dropped (ban→bã), an onset ⟨n⟩ before a vowel stays [n], and a word-initial nasal + C is a
 * prenasal onset. Tone and vowel length are lexical and unwritten in the standard orthography → deferred.
 * N'Ko (ߒߞߏ) is a second script: Nko.cs transliterates it to Latin and the same g2p runs.
 *
 * Ported from src/languages/bambara/bambara.ts — see that file for the referee and the deferrals.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bambara;

public static class BambaraPhonemizer
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** Combining tilde — a nasalised vowel (matches the referee's ã õ ũ …). */
    private const string NASAL_TILDE = "̃";

    /** The orthographic oral vowels — the environment for the nasalisation rule. */
    private static readonly HashSet<string> VOWELS = new(Manifest.MANIFEST.VowelLetters);
    private static IReadOnlySet<string> VOWEL_PH => Ipa.IPA_VOWEL;

    /** Phonemize a single Bambara word to canonical IPA. Accepts BOTH scripts — N'Ko is transliterated to
     *  the Latin orthography first, which yields identical IPA. */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(Nko.IsNko(word) ? Nko.NkoToLatin(word) : word);
        var outp = new List<string>(); // one entry per emitted segment, so the previous vowel can be nasalised
        var i = 0;
        while (i < w.Length)
        {
            // digraphs FIRST, so ⟨ny⟩→ɲ is not intercepted by the ⟨n⟩ nasalisation logic
            if (StartsWith(w, "ny", i)) { outp.Add("ɲ"); i += 2; continue; }
            if (StartsWith(w, "sh", i)) { outp.Add("ʃ"); i += 2; continue; }
            var c = w[i].ToString();
            if (c == "n" || c == "m")
            {
                // JS `w[i + 1]` — one UTF-16 code unit, or undefined past the end.
                var next = i + 1 < w.Length ? w[i + 1].ToString() : null;
                if (next is not null && VOWELS.Contains(next))
                {
                    outp.Add(c); // onset nasal before a vowel
                }
                else if (outp.Count > 0 && VOWEL_PH.Contains(outp[^1]))
                {
                    outp[^1] += NASAL_TILDE; // syllable-final n → nasalise the preceding vowel, drop the n
                }
                else
                {
                    // word-initial / post-consonant prenasal: assimilate place to the following consonant
                    outp.Add(next == "g" || next == "k" ? "ŋ" : c == "n" ? "n" : "m");
                }
                i += 1;
                continue;
            }
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            var g = G.TryGetValue(c, out var hit)
                ? hit
                : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (g is not null) outp.Add(g);
            i += 1;
        }
        return string.Concat(outp);
    }

    /** JS `w.startsWith(key, i)` — a UTF-16 code-unit comparison, which ordinal is. */
    private static bool StartsWith(string w, string key, int i) =>
        i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0;

    // A word (Latin incl. ɛ ɔ ɲ ŋ, OR N'Ko) / number / punctuation. The number class covers BOTH digit sets
    // the two registered scripts use: ASCII 0–9 and N'Ko ߀–߉.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin", "Nko" })})|([\\d\\u{{07C0}}-\\u{{07C9}}]+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a different question from TOKEN's script boundary above. */
    private const string NATIVE_CLASS = "[a-zɛɔɲŋ\\u{07CA}-\\u{07F5}\\u{07FA}\\u{07FD}]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            Clauses.AssembleClauses(Normalize.NormalizeBambara(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // numbers: N'Ko digits folded to ASCII, composed to Bambara words, then through the same g2p
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var folded = Numbers.FoldNkoDigits(m.Groups[2].Value);
                    foreach (var wd in Numbers.NumberToWords(Js.Number(folded), folded).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk)) sink.Pause(mk);
                }
            });
    }

    /** Build the Bambara phonemizer. */
    public static ILanguage CreateBambara() => new Engine();

    internal static void RegisterSelf() => Registry.Register("bambara", () => CreateBambara());
}
