/**
 * Native Maithili (mai) text phonemizer — canonical IPA. Reuses the generic Hindi engine (MakeNativeHindi)
 * with a Maithili manifest, plus a normalize override that folds ⟨॑⟩ U+0951 onto the avagraha ⟨ऽ⟩.
 * Ported from src/languages/maithili/maithili.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Maithili;

public static class MaithiliPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/maithili", "maithili.jsonc");

    private static readonly JsRe UDATTA_AS_AVAGRAHA = JsRegex.Compile("॑", "gu");

    private static NativeHindiEngine? MAI;
    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null)
    {
        var hindi = Normalize.MakeHindiNormalizer(DEF.Numbers, DEF);
        return Hindi.Hindi.MakeNativeHindi(
            DEF,
            PhonologyLoader.LoadSharedPhonology(),
            foreign,
            null,
            null,
            // ⚠ The fold runs BEFORE the inherited normalizer, so every rule downstream — including the
            // word tokenizer, which does not carry U+0951 in its class — sees the avagraha the writer meant.
            normalizeOverride: input => hindi(UDATTA_AS_AVAGRAHA.Replace(input, "ऽ")));
    }

    /** Build the Maithili phonemizer. `foreign` handles embedded Latin runs. */
    public static NativeHindiEngine CreateMaithili(ForeignPhonemizer? foreign = null) => Engine(foreign);

    /**
     * Bare word→IPA (tests / eval). ⚠ The U+0951 fold is applied HERE as well, because `Word()` does not
     * run the normalizer — the override reaches `Text()` only, and without this the eval path and the
     * shipped path disagreed on this module's signature construct.
     */
    public static string PhonemizeWord(string w) =>
        (MAI ??= Engine()).Word(UDATTA_AS_AVAGRAHA.Replace(w, "ऽ"));

    internal static void RegisterSelf() =>
        Registry.Register("maithili", () => new NativeHindiLanguage(CreateMaithili(latin => Registry.ReadAsEnglish(latin))));
}
