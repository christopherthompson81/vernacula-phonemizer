/**
 * Native Magahi (mag) text phonemizer — canonical IPA. Reuses the generic Hindi engine (MakeNativeHindi)
 * with a Magahi manifest; every Magahi-specific fact — the glide hardening व→b, य→d͡ʒ included — lives in
 * magahi.jsonc.
 * Ported from src/languages/magahi/magahi.ts — see that file for the source and the divergences.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Magahi;

public static class MagahiPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/magahi", "magahi.jsonc");

    private static NativeHindiEngine? MAG;
    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null) =>
        Hindi.Hindi.MakeNativeHindi(DEF, PhonologyLoader.LoadSharedPhonology(), foreign);

    /** Build the Magahi phonemizer. `foreign` handles embedded Latin runs. */
    public static NativeHindiEngine CreateMagahi(ForeignPhonemizer? foreign = null) => Engine(foreign);

    /** Bare word→IPA (tests). */
    public static string PhonemizeWord(string w) => (MAG ??= Engine()).Word(w);

    internal static void RegisterSelf() =>
        Registry.Register("magahi", () => new NativeHindiLanguage(CreateMagahi(latin => Registry.ReadAsEnglish(latin))));
}
