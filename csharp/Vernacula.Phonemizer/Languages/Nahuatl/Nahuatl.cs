/**
 * Classical Nahuatl (nci) phonemizer — a position-aware scan of the traditional Spanish-based orthography
 * (Andrews §2), canonical IPA. This file owns the context rules: ⟨cu/uc⟩→[kʷ] and ⟨hu/uh⟩→[w] by
 * position, the ⟨chu⟩ trap ([k] coda + [w], not the affricate), ⟨c⟩ softening before e/i, ⟨qu⟩, and the
 * post-vocalic saltillo ⟨h⟩→[ʔ]. The context-free tables live in nahuatl.jsonc.
 * Ported from src/languages/nahuatl/nahuatl.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nahuatl;

public sealed class NahuatlPhonemizer : ILanguage
{
    private static readonly NahuatlDef DEF = Manifest.MANIFEST;
    // Context-free tables (nahuatl.jsonc). ⟨c z x h q u⟩ are handled positionally in the scan below.
    private static readonly IReadOnlyDictionary<string, string> VOWEL = DEF.Vowels;
    private static readonly IReadOnlyDictionary<string, string> CONS = DEF.Consonants;

    private static bool IsVowel(string? c) => c is not null && VOWEL.ContainsKey(c);

    private static bool IsFront(string? c) => c is "e" or "i" or "ē" or "ī" or "é" or "í";

    /** One Classical Nahuatl word → canonical IPA (Andrews §2 orthography rules; morphophonology deferred). */
    public static string PhonemizeWord(string word)
    {
        var t = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var sb = new StringBuilder();
        var i = 0;
        while (i < t.Length)
        {
            var c = t[i].ToString();
            var c1 = i + 1 < t.Length ? t[i + 1].ToString() : null;
            var c2 = i + 2 < t.Length ? t[i + 2].ToString() : null;
            var c3 = i + 3 < t.Length ? t[i + 3].ToString() : null;
            // ⟨cu⟩ + vowel → [kʷ]; ⟨hu⟩ + vowel → [w] (syllable-initial labialised/glide).
            if (c == "c" && c1 == "u" && IsVowel(c2)) { sb.Append("kʷ"); i += 2; continue; }
            if (c == "h" && c1 == "u" && IsVowel(c2)) { sb.Append("w"); i += 2; continue; }
            // THE ⟨chu⟩ TRAP: ⟨ch⟩ + ⟨u⟩ + vowel = [k]-coda + [w] (cachuah=/kakwa/) — emit [k], let ⟨hu⟩ follow.
            if (c == "c" && c1 == "h" && c2 == "u" && IsVowel(c3)) { sb.Append("k"); i += 1; continue; }
            // Coda labialised velar / glide: V⟨uc⟩ / V⟨uh⟩ syllable-final (before a consonant or word-end).
            if (c == "u" && c1 == "c" && !IsVowel(c2)) { sb.Append("kʷ"); i += 2; continue; }
            if (c == "u" && c1 == "h" && !IsVowel(c2)) { sb.Append("w"); i += 2; continue; }
            // Affricate / velar digraphs.
            if (c == "c" && c1 == "h") { sb.Append("t͡ʃ"); i += 2; continue; }
            if (c == "t" && c1 == "z") { sb.Append("t͡s"); i += 2; continue; }
            if (c == "t" && c1 == "l") { sb.Append("t͡ɬ"); i += 2; continue; }
            // ⟨qu⟩ → [k] (standardized orthography: only before e/i). Before a/o it appears only in COLONIAL
            // spellings (⟨qua quo⟩ for standardized ⟨cua cuo⟩ = /kʷ/) → [kʷ].
            if (c == "q" && c1 == "u")
            {
                sb.Append(c2 is "a" or "o" or "ā" or "ō" or "á" or "ó" ? "kʷ" : "k");
                i += 2; continue;
            }
            // Context-dependent singles.
            if (c == "c") { sb.Append(IsFront(c1) ? "s" : "k"); i += 1; continue; } // ⟨c⟩ → [s]/e,i ; [k] else
            if (c == "z" || c == "ç") { sb.Append("s"); i += 1; continue; }
            if (c == "x") { sb.Append("ʃ"); i += 1; continue; }
            // saltillo ⟨h⟩ → [ʔ], but ONLY after a vowel: a word-initial / post-consonant ⟨h⟩ is silent.
            if (c == "h") { sb.Append(i > 0 && IsVowel(t[i - 1].ToString()) ? "ʔ" : ""); i += 1; continue; }
            // Vowels + plain consonants + loan letters.
            sb.Append(VOWEL.TryGetValue(c, out var v) ? v : CONS.TryGetValue(c, out var k) ? k : "");
            i += 1;
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    /** A Nahuatl word (traditional orthography + macron/acute + ç) / number / punctuation. */
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:…])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — i.e. a foreign name.
     * See core/hostWord.ts.
     */
    private const string NATIVE_CLASS = "[a-zāēīōūáéíóúç]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input)
    {
        // ⚠ NORMALIZE FIRST, THEN NFC — the normalizer's guards are written against precomposed macrons, and
        // its `\p{M}` classes are what tolerate the corpus's occasional decomposed input either way.
        return Clauses.AssembleClauses(
            Normalize.NormalizeNahuatl(Rewriter.Renormalize(input, NormalizationForm.FormC)),
            TOKEN,
            (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
    }

    /** Build the Classical Nahuatl phonemizer (Andrews §2 orthography rules; morphophonology deferred). */
    public static ILanguage CreateNahuatl() => new NahuatlPhonemizer();

    internal static void RegisterSelf() => Registry.Register("nahuatl", CreateNahuatl);
}
