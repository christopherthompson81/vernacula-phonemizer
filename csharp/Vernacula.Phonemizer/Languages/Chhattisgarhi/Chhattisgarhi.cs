/**
 * Native Chhattisgarhi (hne) text phonemizer — canonical IPA. Reuses the generic Hindi engine
 * (MakeNativeHindi) with a Chhattisgarhi manifest; every Chhattisgarhi-specific fact lives in
 * chhattisgarhi.jsonc.
 * Ported from src/languages/chhattisgarhi/chhattisgarhi.ts — see that file for the cannot-verify note.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Chhattisgarhi;

public static class ChhattisgarhiPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/chhattisgarhi", "chhattisgarhi.jsonc");

    private static NativeHindiEngine? HNE;
    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null) =>
        Hindi.Hindi.MakeNativeHindi(DEF, PhonologyLoader.LoadSharedPhonology(), foreign);

    /** Build the Chhattisgarhi phonemizer. `foreign` handles embedded Latin runs. */
    public static NativeHindiEngine CreateChhattisgarhi(ForeignPhonemizer? foreign = null) => Engine(foreign);

    /** Bare word→IPA (tests). */
    public static string PhonemizeWord(string w) => (HNE ??= Engine()).Word(w);

    internal static void RegisterSelf() =>
        Registry.Register("chhattisgarhi", () => new NativeHindiLanguage(CreateChhattisgarhi(latin => Registry.ReadAsEnglish(latin))));
}
