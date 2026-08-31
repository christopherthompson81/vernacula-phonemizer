/**
 * Kikuyu / Gĩkũyũ (ki) phonemizer — Niger-Congo BANTU (E51), the Latin orthography, canonical IPA,
 * the largest language of Kenya (~8M). A PURE greedy longest-match scan over the grapheme table — no
 * code rules; the Bantu fricativization and prenasalization live entirely in the table.
 * Ported from src/languages/kikuyu/kikuyu.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kikuyu;

public sealed class KikuyuPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** Phonemize a single Kikuyu word to canonical IPA (segmental; non-tonal — tone is not in the orthography). */
    public static string PhonemizeWord(string word)
    {
        // ⚠ NFC FIRST, like the TS: a decomposed ⟨ĩ⟩ would not match the grapheme key.
        // ⚠ AND `Js.Normalize`, NOT `string.Normalize`. The subject is a RAW WORD, and .NET refuses a string
        // carrying an unpaired surrogate where JS returns it unchanged — `PhonemizeWord("a\ud83d")` THREW
        // here while the TypeScript answered "a". #1199's class; the shared helper is the fix.
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

    // A word (Kikuyu Latin letters incl. ĩ ũ and the ⟨ng'⟩ apostrophe) / number / punctuation token.
    // ⚠ THE WORD GROUP IS BOUNDED TO LATIN SCRIPT, and `[\\p{L}\\p{M}]` here was silent content loss: it would
    // claim an embedded run of another script as a word of this language, so the run never became a gap and
    // the script router never saw it.
    // ⚠ AND THE GROUP MUST BEGIN WITH A LATIN LETTER, not merely contain Latin-or-mark. `\\p{M}` is
    // script-neutral, so a bare combining mark would otherwise be claimed and a foreign run split.
    // Anchoring on a Latin letter means a mark can only ever be claimed as part of a Latin word.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("(['’]?\\p{Script=Latin}[\\p{Script=Latin}\\p{M}'’]*)|(\\d+)|([.!?…,;:])", "gu");
    private static readonly JsRe CURLY = JsRegex.Compile("’", "gu");

    public string Text(string input) =>
        Clauses.AssembleClauses(Normalize.NormalizeKikuyu(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(JsRegex.Replace(m.Groups[1].Value, CURLY, "'"))); // the ⟨ng'⟩ key is straight-quote
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
            }
        });

    /** Build the Kikuyu phonemizer (greedy g2p + the E5x cardinal compositor; tone deferred). */
    public static ILanguage CreateKikuyu() => new KikuyuPhonemizer();

    internal static void RegisterSelf() => Registry.Register("kikuyu", CreateKikuyu);
}
