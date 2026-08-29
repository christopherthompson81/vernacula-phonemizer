/**
 * Native Bishnupriya Manipuri / বিষ্ণুপ্রিয়া মণিপুরী (bpy) text phonemizer — canonical IPA.
 * Eastern Indo-Aryan, Bengali / Eastern-Nagari script (~120k, Assam/Tripura + Sylhet). Reuses the Bengali
 * engine (MakeNativeBengali — the generic abugida scan + inherent-vowel deletion + geminate→length) with a
 * Bishnupriya manifest whose phoneme values are BENGALI (the ʃ sibilants, the retroflex/dental split, the
 * affricates — the referee is Bengali-like, not Assamese-like). The one divergence encoded in the manifest
 * is heightHarmony:false (no ɔ→o raising).
 *
 * ⚠ AND THAT IS WHY THERE IS NO WRAPPER PASS HERE. Assamese reuses the same engine but has to wrap every
 * arm to collapse its deaffricated t/d/s/z/x geminates; Bishnupriya's phoneme inventory is exactly
 * Bengali's, so the Bengali engine's own geminate→length pass already covers it. The TS says so explicitly
 * and this port keeps the asymmetry rather than inventing a wrapper for symmetry's sake.
 * Ported from src/languages/bishnupriya/bishnupriya.ts.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Bengali;

namespace Vernacula.Phonemizer.Languages.Bishnupriya;

public static class BishnupriyaPhonemizer
{
    private const string Dir = "languages/bishnupriya";
    private const string File = "bishnupriya.jsonc";

    /** Load bishnupriya.jsonc and build the Bishnupriya phonemizer. `foreign` handles embedded Latin. */
    public static NativeBengaliEngine CreateBishnupriya(Func<string, string>? foreign = null) =>
        Bengali.Bengali.MakeNativeBengali(
            LoadManifest.Load<BengaliDef>(Dir, File),
            PhonologyLoader.LoadSharedPhonology(),
            foreign);

    private static NativeBengaliEngine? BPY;

    /** Bare word→IPA (tests / eval). ⚠ Built WITHOUT a phonology or a foreign handler, as the TS is —
     *  `MakeNativeBengali` supplies the shared phonology itself when none is passed. */
    public static string PhonemizeWord(string w) =>
        (BPY ??= Bengali.Bengali.MakeNativeBengali(LoadManifest.Load<BengaliDef>(Dir, File))).Word(w, null);

    private sealed class BishnupriyaLanguage : ILanguage
    {
        private readonly NativeBengaliEngine _engine;
        internal BishnupriyaLanguage(NativeBengaliEngine engine) => _engine = engine;
        public string Text(string input) => _engine.Text(input, null);
    }

    internal static void RegisterSelf() =>
        Registry.Register("bishnupriya", () => new BishnupriyaLanguage(CreateBishnupriya(Registry.ReadAsEnglish)));
}
