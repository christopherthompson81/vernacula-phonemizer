/**
 * Loads the Thai data manifest (thai.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/thai/manifest.ts — see that file for the corpus evidence.
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
    /** ⚠ Keyed by UPPERCASE Latin — see the jsonc. Dictionary keys are not touched by the loader's
     *  camelCase PROPERTY policy, which is what mangled English's ARPABET block. */
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public ThaiSymbolTier SymbolTier { get; init; } = new();
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

public sealed class ThaiSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
    public bool UnspacedScript { get; init; } = false;
}
