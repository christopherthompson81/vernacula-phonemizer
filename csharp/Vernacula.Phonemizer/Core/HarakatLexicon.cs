/**
 * Perso-Arabic short-vowel COVERAGE layer — the shippable half of the two-layer rider phonemizer (Urdu, Persian,
 * Pashto, Punjabi-Shahmukhi). These abjads leave short vowels unwritten, so an undiacritized word is a skeleton
 * (کرن → default schwas) and the g2p can only guess a default [ə]. This looks the bare word up in a mined lexicon
 * (`lexicon.tsv` beside each g2p — g2p-inversion over wikipron + kaikki + Hindi→Urdu real spellings) and, on a hit,
 * substitutes OUR vocalization (کِرن) so the g2p reads the real short vowel (ɪ/ʊ/…). On a miss the word is returned
 * unchanged (current default-schwa behavior). This is the exact-match analogue of Arabic's
 * restore.ts/diacritization.tsv; the neural GENERALIZATION layer (novel words) is a later ONNX pass.
 */
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class HarakatLexicon
{
    // Arabic harakat block (U+064B tanwīn … U+0652 sukūn) + U+0670 dagger alif — the diacritics an abjad may carry.
    // Shared by the lexicon layer (this file) and the neural pre-pass (../languages/perso-arabic/riderDiacritizer.ts) so the two agree on what a
    // "skeleton" is; the `g` variant strips them, the non-`g` variant tests for their presence.
    public static readonly JsRe HARAKAT = JsRegex.Compile("[ً-ْٰ]", "u");
    public static readonly JsRe HARAKAT_G = JsRegex.Compile("[ً-ْٰ]", "gu");

    /** Strip every combining haraka → the bare consonant skeleton. */
    public static string StripHarakat(string word) => HARAKAT_G.Replace(word, "");

    /** Load a rider's `skeleton⇥vocalized` restoration lexicon beside its module. Optional: absent → empty Map. */
    /**
     * ⚠ AN ENTRY THAT VOCALIZES TO NOTHING IS REJECTED AT LOAD. This lexicon exists to supply the short vowels
     * an abjad leaves unwritten, so a row whose value carries NO harakat and a sukun on every consonant asserts
     * the opposite — that the word has no vowels at all — and is self-contradictory. It is also strictly worse
     * than having no entry: a miss falls through to the g2p, which at least inserts the default short vowel,
     * whereas the entry suppresses it and the word comes out unpronounceable (بزنس → *bzns*, برتخت → *brt̪xt̪*).
     *
     * 26 such rows are in `pashto/lexicon.tsv`, all in one alphabetical run (بر…/بز…) — the residue of the
     * loose-fold mining that `ps_neural_restoration_investigation.md` Run 11 identified and fixed at scale
     * ("ps silver was 78% all-bare"). fa/ur/pnb have none, so this costs them nothing; the guard lives here so
     * a re-mine cannot reintroduce the class into any of the four.
     */
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

    public static Dictionary<string, string> LoadHarakatLexicon(string moduleDir)
    {
        var raw = LoadTsv.LoadTsvMap(moduleDir, "lexicon.tsv", optional: true);
        var outp = new Dictionary<string, string>();
        foreach (var (k, v) in raw)
            if (!VocalizesToNothing(v)) outp[k] = v;
        return outp;
    }

    /**
     * Restore a single word's short vowels from the lexicon. If the word already carries harakat it is RESPECTED
     * (the writer supplied explicit vowels — never clobber them); otherwise a lexicon hit replaces the bare skeleton
     * with our vocalization, and a miss returns the word unchanged. Pure lookup — the g2p still does the IPA mapping.
     * The lookup key is NFC-normalized (the mined lexicon keys are NFC): NFD input (decomposed آ/أ, reordered marks)
     * would otherwise silently miss a covered word.
     */
    public static string RestoreHarakat(string word, IReadOnlyDictionary<string, string> lexicon)
    {
        if (HARAKAT.IsMatch(word)) return word;
        return lexicon.TryGetValue(word.Normalize(NormalizationForm.FormC), out var v) ? v : word;
    }
}
