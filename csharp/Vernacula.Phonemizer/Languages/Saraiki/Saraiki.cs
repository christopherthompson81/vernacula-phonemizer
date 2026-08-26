/**
 * Saraiki (skr) text phonemizer — canonical IPA. The NON-tonal Lahnda sibling of Punjabi: it reuses the
 * shared Shahmukhi front-end via `MakeNativePunjabi` with the Saraiki variant flag.
 * Ported from src/languages/saraiki/saraiki.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Punjabi;

namespace Vernacula.Phonemizer.Languages.Saraiki;

public static class SaraikiPhonemizer
{
    private static NativePunjabiEngine? SKR;
    private static NativePunjabiEngine Engine() =>
        SKR ??= PunjabiPhonemizer.MakeNativePunjabi(
            PunjabiPhonemizer.LoadPunjabiManifest(),
            PhonologyLoader.LoadSharedPhonology(),
            null,
            new PunjabiOpts { Saraiki = true });

    // Short-vowel coverage lexicon (optional; beside this module). Absent → the default-[ə] rules run
    // unchanged. Loaded lazily, as the pnb/ur siblings do.
    private static Dictionary<string, string>? LEXICON;
    private static IReadOnlyDictionary<string, string> SaraikiLexicon() =>
        LEXICON ??= HarakatLexicon.LoadHarakatLexicon("languages/saraiki");

    /** Rule-only bare word→IPA (the non-circular referee signal). */
    public static string PhonemizeWordRules(string w) => Engine().Word(w);

    /** Shipped bare word→IPA: short-vowel coverage lexicon → rule g2p. */
    public static string PhonemizeWord(string w) =>
        PhonemizeWordRules(HarakatLexicon.RestoreHarakat(w, SaraikiLexicon()));

    private sealed class TextEngine : ILanguage
    {
        private readonly NativePunjabiEngine _engine;
        internal TextEngine(NativePunjabiEngine engine) => _engine = engine;
        public string Text(string input) => _engine.Text(input);
    }

    /** Build the Saraiki phonemizer. `foreign` handles embedded Latin. */
    public static ILanguage CreateSaraiki(Func<string, string>? foreign = null) =>
        new TextEngine(PunjabiPhonemizer.MakeNativePunjabi(
            PunjabiPhonemizer.LoadPunjabiManifest(),
            PhonologyLoader.LoadSharedPhonology(),
            foreign,
            new PunjabiOpts { Saraiki = true, Normalize = Normalize.NormalizeSaraiki, WordLexicon = SaraikiLexicon }));

    internal static void RegisterSelf() =>
        Registry.Register("saraiki", () => CreateSaraiki(Registry.ReadAsEnglish));
}
