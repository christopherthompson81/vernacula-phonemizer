/**
 * Gan Chinese / 贛語 (gan), Nanchang — canonical IPA. The dict already carries Sinological IPA per syllable, so
 * the front-end is the shared Han-dict engine (Core/HanDictIpa.cs); this file supplies the dict and manifest.
 * Ported from src/languages/gan/gan.ts — see that file for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Gan;

public static class GanPhonemizer
{
    private static readonly HanDictDef DEF = LoadManifest.Load<HanDictDef>("languages/gan", "gan.jsonc");

    private static IReadOnlyDictionary<string, string>? DICT;
    private static readonly object DICT_LOCK = new();
    private static IReadOnlyDictionary<string, string> Dict()
    {
        lock (DICT_LOCK) return DICT ??= LoadTsv.LoadTsvMap("languages/gan", "dict.tsv");
    }

    /** ⚠ THE NORMALIZER WRAPS the shared engine rather than being wired inside it — see the TS for why. */
    public static ILanguage CreateGan(Func<string, string>? foreign = null)
    {
        var engine = HanDictIpa.CreateHanDictPhonemizer(Dict, DEF, foreign);
        return new Wrapped(engine);
    }

    private sealed class Wrapped : ILanguage
    {
        private readonly ILanguage _engine;
        internal Wrapped(ILanguage engine) => _engine = engine;
        public string Text(string input) => _engine.Text(Normalize.NormalizeGan(input));
    }

    /** Bare word→IPA (tests / eval): a Han run → IPA. */
    public static string PhonemizeWord(string word) => HanDictIpa.PhonemizeHanWord(Dict, DEF, word);

    internal static void RegisterSelf() =>
        Registry.Register("gan", () => CreateGan(Registry.ReadAsEnglish));
}
