/**
 * Native Rangpuri (rkt) text phonemizer — canonical IPA. An Eastern Indo-Aryan KRNB lect written in
 * Devanagari; reuses the generic Hindi abugida engine (MakeNativeHindi) with a Rangpuri manifest, so every
 * KRNB-specific fact (deaffrication, positional deaspiration, inherent [ɔ]) lives in rangpuri.jsonc.
 * Ported from src/languages/rangpuri/rangpuri.ts — see that file for the sourcing and the unconfirmed words.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Rangpuri;

public static class RangpuriPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/rangpuri", "rangpuri.jsonc");

    private static NativeHindiEngine? RKT;
    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null) =>
        Hindi.Hindi.MakeNativeHindi(DEF, PhonologyLoader.LoadSharedPhonology(), foreign);

    /** Build the Rangpuri phonemizer. `foreign` handles embedded Latin runs. */
    public static NativeHindiEngine CreateRangpuri(ForeignPhonemizer? foreign = null) => Engine(foreign);

    /** Bare word→IPA (tests / referee eval) — the pure rule engine (no lexicon). */
    public static string PhonemizeWord(string w) => (RKT ??= Engine()).WordRules(w);

    internal static void RegisterSelf() =>
        Registry.Register("rangpuri", () => new NativeHindiLanguage(CreateRangpuri(latin => Registry.ReadAsEnglish(latin))));
}
