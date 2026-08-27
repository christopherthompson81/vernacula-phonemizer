/**
 * Kinyarwanda / Ikinyarwanda (rw) phonemizer — Bantu (JD61, Rwanda-Rundi), Latin orthography, canonical IPA.
 * A pure greedy longest-match scan over the grapheme table; syllables are open CV, so no coda or
 * syllabification logic is needed. Tone (H/L) is unwritten → DEFERRED.
 * Ported from src/languages/kinyarwanda/kinyarwanda.ts — see that file for the palatalisation analysis and
 * for why the normalizer, not this file, owns the shared symbol-tier call.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kinyarwanda;

public sealed class KinyarwandaPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** One Kinyarwanda word → canonical IPA (segmental; no tone). */
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

    // A word (Kinyarwanda letters; the apostrophe marks vowel elision — a boundary, so it splits tokens) /
    // number / punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this class REJECTS carries a letter the language does not
     *  use, i.e. a foreign name. Distinct from TOKEN, which decides where the SCRIPT boundary falls. */
    private const string NATIVE_CLASS = "[a-z]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input) =>
        // ⚠ THE NORMALIZER OWNS THE SHARED SYMBOL TIER CALL, so there is only one entry point here.
        Clauses.AssembleClauses(Normalize.NormalizeKinyarwanda(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
            }
        });

    /** Build the Kinyarwanda phonemizer (greedy rule g2p; tone deferred). */
    public static ILanguage CreateKinyarwanda() => new KinyarwandaPhonemizer();

    internal static void RegisterSelf() => Registry.Register("kinyarwanda", CreateKinyarwanda);
}
