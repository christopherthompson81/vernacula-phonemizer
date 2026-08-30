/**
 * Kamba / Kikamba (kam) phonemizer — Niger-Congo BANTU (E55), the Latin orthography, canonical IPA,
 * Kenya (~4M). A PURE greedy longest-match scan over the grapheme table — no code rules; the Bantu
 * fricativization/prenasalization live entirely in the table (the Kikuyu pattern).
 * Ported from src/languages/kamba/kamba.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kamba;

public sealed class KambaPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** Phonemize a single Kamba word to canonical IPA (segmental; non-tonal — tone is not in the orthography). */
    public static string PhonemizeWord(string word)
    {
        // ⚠ NFC FIRST, like the TS: a decomposed ⟨ĩ⟩ would not match the grapheme key.
        // ⚠ AND `Js.Normalize`, NOT `string.Normalize`. The subject is a RAW WORD, and .NET refuses a string
        // carrying an unpaired surrogate where JS returns it unchanged — `PhonemizeWord("a\ud83d")` THREW
        // here while the TypeScript answered "a". Found by an astral/surrogate walk: 2,949 of 12,672 words
        // threw. This is #1199's class; the shared helper is the fix that issue's sweep will use.
        var w = Js.ToLowerCase(Js.Normalize(word, System.Text.NormalizationForm.FormC));
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
            // Consulted only on the MISS branch, after every grapheme (including every digraph) has been
            // tried: a letter with no rule here still denotes a sound, and dropping it deletes what the
            // writer typed.
            if (!matched)
            {
                outp.Append(LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true }) ?? "");
                i++;
            }
        }
        return outp.ToString();
    }

    // A word (Kamba Latin letters incl. ĩ ũ and the ⟨ng'⟩ apostrophe) / number / punctuation token. The word
    // class admits the three apostrophe variants that spell ⟨ng'⟩ in the wild.
    // ⚠ THE WORD GROUP IS BOUNDED TO LATIN SCRIPT and MUST BEGIN WITH A LATIN LETTER, not merely contain
    // Latin-or-mark: a bare combining mark is script-neutral and would split a foreign run. Bounding the
    // group is what makes a foreign run UNCLAIMED, which is the state the script router is built to handle.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("(['’ʼ]?\\p{Script=Latin}[\\p{Script=Latin}\\p{M}'’ʼ]*)|(\\d+)|([.!?…,;:])", "gu");
    private static readonly JsRe APOSTROPHES = JsRegex.Compile("[’ʼ]", "gu");

    public string Text(string input) =>
        Clauses.AssembleClauses(Normalize.NormalizeKamba(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(JsRegex.Replace(m.Groups[1].Value, APOSTROPHES, "'"))); // normalise ’ / ʼ → ' so the ⟨ng'⟩ key matches
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
            }
        });

    /** Build the Kamba phonemizer (greedy g2p + the E5x cardinal compositor; tone deferred). */
    public static ILanguage CreateKamba() => new KambaPhonemizer();

    internal static void RegisterSelf() => Registry.Register("kamba", CreateKamba);
}
