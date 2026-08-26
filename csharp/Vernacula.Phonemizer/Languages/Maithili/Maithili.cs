/**
 * Native Maithili (mai) text phonemizer — canonical IPA. Reuses the generic Hindi engine (MakeNativeHindi)
 * with a Maithili manifest, plus a fold of ⟨॑⟩ U+0951 onto the avagraha ⟨ऽ⟩ — this corpus's second spelling
 * of the mark that retains a word-final vowel.
 * Ported from src/languages/maithili/maithili.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Maithili;

public static class MaithiliPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/maithili", "maithili.jsonc");

    private static readonly JsRe UDATTA_AS_AVAGRAHA = JsRegex.Compile("॑", "gu");
    private static string Fold(string s) => UDATTA_AS_AVAGRAHA.Replace(s, "ऽ");

    private static NativeHindiEngine? MAI;
    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null)
    {
        var hindi = Normalize.MakeHindiNormalizer(DEF.Numbers, DEF);
        var e = Hindi.Hindi.MakeNativeHindi(
            DEF, PhonologyLoader.LoadSharedPhonology(), foreign, null, null,
            normalizeOverride: input => hindi(Fold(input)));
        // ⚠ Word/WordRules need the fold SEPARATELY: neither runs the normalizer, so the override above
        // reaches Text only. Text keeps the unwrapped delegates by construction, so nothing double-folds.
        return new NativeHindiEngine
        {
            Word = w => e.Word(Fold(w)),
            WordRules = w => e.WordRules(Fold(w)),
            Number = e.Number,
            Text = e.Text,
        };
    }

    /** Build the Maithili phonemizer. `foreign` handles embedded Latin runs. */
    public static NativeHindiEngine CreateMaithili(ForeignPhonemizer? foreign = null) => Engine(foreign);

    /** Bare word→IPA (tests / eval). */
    public static string PhonemizeWord(string w) => (MAI ??= Engine()).Word(w);

    internal static void RegisterSelf() =>
        Registry.Register("maithili", () => new NativeHindiLanguage(CreateMaithili(latin => Registry.ReadAsEnglish(latin))));
}
