/**
 * Hakka Chinese / 客家话 (hak), Meixian — canonical IPA. The dict already carries Sinological IPA per syllable,
 * so the front-end is the shared Han-dict engine (Core/HanDictIpa.cs); the Latin arm reads Pha̍k-fa-sṳ first
 * (Pfs.cs) and falls back to the injected foreign reader.
 * Ported from src/languages/hakka/hakka.ts — see that file for the sourcing and the measurement behind the split.
 */
using System.Text.Json.Serialization;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hakka;

/** The manifest: the shared Han-dict keys plus the two hand-authored Pha̍k-fa-sṳ tables. */
public sealed class HakkaDef : PfsDef
{
    public IReadOnlyDictionary<string, string> Chao { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();

    private HanDictDef? _han;
    /** ⚠ Core's `HanDictDef` is sealed, so the shared half is projected rather than inherited. */
    [JsonIgnore]
    public HanDictDef Han => _han ??= new HanDictDef { Chao = Chao, ClausePunctuation = ClausePunctuation };
}

public static class HakkaPhonemizer
{
    public static readonly HakkaDef DEF = LoadManifest.Load<HakkaDef>("languages/hakka", "hakka.jsonc");

    /**
     * ⚠ THE HYPHEN IS PART OF A PHA̍K-FA-SṲ WORD, and that is why this language overrides the Latin run:
     * the default stops at the hyphen and delivers `Hak-kâ-ngìn` as three fragments, so the reader never
     * sees the WORD — the unit that carries tone sandhi. ⚠ `medialOnly`, NOT `extra`, or a run could BEGIN
     * with a hyphen and swallow the dash of `1947年 -1998年`.
     */
    private static readonly string PFS_RUN = HostWord.HostWordRun(new[] { "Latin" }, "", "-");

    private static IReadOnlyDictionary<string, string>? DICT;
    private static readonly object DICT_LOCK = new();
    private static IReadOnlyDictionary<string, string> Dict()
    {
        lock (DICT_LOCK) return DICT ??= LoadTsv.LoadTsvMap("languages/hakka", "dict.tsv");
    }

    /** Build the Hakka phonemizer. ⚠ THE NORMALIZER WRAPS the shared engine rather than being wired inside
     *  it — see the TS for why. */
    public static ILanguage CreateHakka(Func<string, string>? foreign = null)
    {
        // ⚠ THE LATIN ARM IS PHA̍K-FA-SṲ FIRST AND `foreign` SECOND: 93.5% of hak.wikipedia is romanized
        // Hakka, and all of it used to route to English.
        string Latin(string run)
        {
            var segs = Pfs.ReadPfs(DEF, Pfs.PfsTable(), run);
            if (segs is null) return foreign is null ? "" : foreign(run);
            return string.Join(" ", segs
                .Select(s => s.Reading is not null
                    ? HanDictIpa.ReadingToIpa(s.Reading, DEF.Chao)
                    : foreign is null ? "" : foreign(s.Foreign!))
                .Where(x => x.Length > 0));
        }

        var engine = HanDictIpa.CreateHanDictPhonemizer(Dict, DEF.Han, Latin, PFS_RUN);
        return new Wrapped(engine);
    }

    private sealed class Wrapped : ILanguage
    {
        private readonly ILanguage _engine;
        internal Wrapped(ILanguage engine) => _engine = engine;
        public string Text(string input) => _engine.Text(Normalize.NormalizeHakka(input));
    }

    /** Bare Pha̍k-fa-sṳ word → IPA (tests / eval), or "" when the run is not PFS at all. */
    public static string PhonemizePfs(string run)
    {
        var segs = Pfs.ReadPfs(DEF, Pfs.PfsTable(), run);
        if (segs is null) return "";
        // ⚠ The bare probe reports ONLY the Hakka part — a mixed run's foreign fragment has no reader here.
        return string.Join(" ", segs.Where(s => s.Reading is not null)
            .Select(s => HanDictIpa.ReadingToIpa(s.Reading!, DEF.Chao)));
    }

    /** Bare word→IPA (tests / eval): a Han run → IPA. */
    public static string PhonemizeWord(string word) => HanDictIpa.PhonemizeHanWord(Dict, DEF.Han, word);

    internal static void RegisterSelf() =>
        Registry.Register("hakka", () => CreateHakka(Registry.ReadAsEnglish));
}
