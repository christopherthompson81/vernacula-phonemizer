/**
 * Jin Chinese / 晋语 (cjy), Taiyuan — canonical IPA. The dict already carries Sinological IPA per syllable, so
 * the front-end is the shared Han-dict engine (Core/HanDictIpa.cs); this file supplies the dict and manifest.
 * Ported from src/languages/jin/jin.ts — see that file for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Jin;

public static class JinPhonemizer
{
    private static readonly HanDictDef DEF = LoadManifest.Load<HanDictDef>("languages/jin", "jin.jsonc");

    private static IReadOnlyDictionary<string, string>? DICT;
    private static readonly object DICT_LOCK = new();
    private static IReadOnlyDictionary<string, string> Dict()
    {
        lock (DICT_LOCK) return DICT ??= LoadTsv.LoadTsvMap("languages/jin", "dict.tsv");
    }

    /** ⚠ THE NORMALIZER WRAPS the shared engine rather than being wired inside it — see the TS for why. */
    public static ILanguage CreateJin(Func<string, string>? foreign = null)
    {
        var engine = HanDictIpa.CreateHanDictPhonemizer(Dict, DEF, foreign);
        return new Wrapped(engine);
    }

    private sealed class Wrapped : ILanguage
    {
        private readonly ILanguage _engine;
        internal Wrapped(ILanguage engine) => _engine = engine;
        public string Text(string input) => _engine.Text(Normalize.NormalizeJin(input));
    }

    /** Bare word→IPA (tests / eval): a Han run → IPA. */
    public static string PhonemizeWord(string word) => HanDictIpa.PhonemizeHanWord(Dict, DEF, word);

    internal static void RegisterSelf() =>
        Registry.Register("jin", () => CreateJin(Registry.ReadAsEnglish));
}
