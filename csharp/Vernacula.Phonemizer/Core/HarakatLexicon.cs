/**
 * Perso-Arabic short-vowel COVERAGE layer — the shippable half of the two-layer rider phonemizer (Urdu,
 * Persian, Pashto, Punjabi-Shahmukhi).
 * Ported from src/core/harakatLexicon.ts — see that file for the corpus evidence.
 */
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class HarakatLexicon
{
    public static readonly JsRe HARAKAT = JsRegex.Compile("[ً-ْٰ]", "u");
    public static readonly JsRe HARAKAT_G = JsRegex.Compile("[ً-ْٰ]", "gu");

    /** Strip every combining haraka → the bare consonant skeleton. */
    public static string StripHarakat(string word) => HARAKAT_G.Replace(word, "");

    private const string SUKUN = "ْ";

    private static readonly JsRe ARABIC_LETTER = JsRegex.Compile("[\\u0621-\\u06D3]", "u");
    private static readonly JsRe RealVowelMark = JsRegex.Compile("[\\u064B-\\u0650\\u0670]", "u");

    private static bool VocalizesToNothing(string value)
    {
        if (RealVowelMark.IsMatch(value)) return false; // carries a real vowel mark
        var consonants = 0;
        var sukuns = 0;
        foreach (var c in Js.CodePoints(value))
        {
            if (ARABIC_LETTER.IsMatch(c) && c != SUKUN) consonants++;
            if (c == SUKUN) sukuns++;
        }
        return sukuns >= 2 && sukuns >= consonants - 1;
    }

    /**
     * Load a rider's `skeleton⇥vocalized` restoration lexicon beside its module; absent → empty map.
     *
     * ⚠ AN ENTRY THAT VOCALIZES TO NOTHING IS REJECTED AT LOAD. A row whose value carries no harakat and a
     * sukun on every consonant asserts that the word has no vowels at all, and is strictly worse than
     * having no entry — a miss falls through to the g2p, which at least inserts the default short vowel.
     */
    public static Dictionary<string, string> LoadHarakatLexicon(string moduleDir)
    {
        var raw = LoadTsv.LoadTsvMap(moduleDir, "lexicon.tsv", optional: true);
        var outp = new Dictionary<string, string>();
        foreach (var (k, v) in raw)
            if (!VocalizesToNothing(v)) outp[k] = v;
        return outp;
    }

    /** Restore a single word's short vowels from the lexicon. */
    public static string RestoreHarakat(string word, IReadOnlyDictionary<string, string> lexicon)
    {
        if (HARAKAT.IsMatch(word)) return word;
        return lexicon.TryGetValue(Js.Normalize(word, NormalizationForm.FormC), out var v) ? v : word;
    }
}
