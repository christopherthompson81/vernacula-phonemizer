/**
 * Loads the Thai data manifest (thai.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the onset / coda / vowel-quality grapheme→IPA tables, the vowel-length exception sets, the
 * full tone system (consonant class × mark × life/length → tone → Chao letters), and clause punctuation. The
 * ALGORITHMS that read them stay in code (syllabifier.ts / thaiTone.ts / g2p.ts / segment.ts): the orthographic
 * parser, the tone-computation functions, the IPA renderer, and word segmentation. The bulk lexica stay as
 * sibling files (dictionary.tsv, seg-words.txt), which the manifest only references.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Thai;

public sealed class ThaiToneTables
{
    /** Thai consonant → tonal class ("mid" | "high" | "low"). */
    public IReadOnlyDictionary<string, string> Class { get; init; } = new Dictionary<string, string>();
    /** Tone mark × consonant class → tone. */
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> FromMark { get; init; } =
        new Dictionary<string, IReadOnlyDictionary<string, string>>();
    /** (life + length) × consonant class → tone, keyed "live" | "dead-short" | "dead-long". */
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> NoMark { get; init; } =
        new Dictionary<string, IReadOnlyDictionary<string, string>>();
    /** Tone → Chao contour letters. */
    public IReadOnlyDictionary<string, string> Ipa { get; init; } = new Dictionary<string, string>();
}

public sealed class ThaiManifest
{
    public IReadOnlyDictionary<string, string> Onset { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Coda { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelQuality { get; init; } = new Dictionary<string, string>();
    public string[] NoLength { get; init; } = [];
    public string[] ForceLong { get; init; } = [];
    public string Raisable { get; init; } = "";
    /** Standalone one-grapheme vowel signs (⟨ำ⟩ excluded — it is a glide-bearing span). */
    public string[] VowelSigns { get; init; } = [];
    /** Signs before which ⟨อ⟩ is the glottal-stop consonant rather than the vowel [ɔː]. */
    public string[] OGlottalNext { get; init; } = [];
    /** The short vowel signs — length feeds the dead-short/dead-long tone split. */
    public string[] ShortVowelSigns { get; init; } = [];
    /** Sonorant (and glide) codas that make a syllable LIVE. */
    public string[] LiveCodas { get; init; } = [];
    public ThaiToneTables Tone { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public string[] Tcc { get; init; } = [];
}

public static class Manifest
{
    /** The consolidated hand-authored Thai data tables (see thai.jsonc). */
    public static readonly ThaiManifest MANIFEST = LoadManifest.Load<ThaiManifest>("languages/thai", "thai.jsonc");

    /** Thai Character Cluster matcher — one inseparable cluster at the START of a string. Compiled once from the
     *  ordered `tcc` pattern list (see thai.jsonc); `segment.ts` uses it to constrain word boundaries. */
    public static readonly JsRe THAI_TCC_RE = JsRegex.Compile(
        "^(?:" + string.Join("|", MANIFEST.Tcc) + ")",
        "u");
}
