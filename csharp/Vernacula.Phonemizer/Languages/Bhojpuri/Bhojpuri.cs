/**
 * Native Bhojpuri (bho) text phonemizer — canonical IPA. Reuses the generic Hindi engine (MakeNativeHindi)
 * with a Bhojpuri manifest; every Bhojpuri-specific fact lives in bhojpuri.jsonc.
 * Ported from src/languages/bhojpuri/bhojpuri.ts — see that file for the source and the divergences.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Bhojpuri;

public static class BhojpuriPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/bhojpuri", "bhojpuri.jsonc");

    private static NativeHindiEngine? BHO;
    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null) =>
        Hindi.Hindi.MakeNativeHindi(DEF, PhonologyLoader.LoadSharedPhonology(), foreign);

    /** Build the Bhojpuri phonemizer. `foreign` handles embedded Latin runs. */
    public static NativeHindiEngine CreateBhojpuri(ForeignPhonemizer? foreign = null) => Engine(foreign);

    /** Bare word→IPA (tests). */
    public static string PhonemizeWord(string w) => (BHO ??= Engine()).Word(w);

    internal static void RegisterSelf() =>
        Registry.Register("bhojpuri", () => new NativeHindiLanguage(CreateBhojpuri(latin => Registry.ReadAsEnglish(latin))));
}
