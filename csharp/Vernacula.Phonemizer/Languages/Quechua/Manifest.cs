/**
 * Loads the Quechua data manifest (quechua.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/quechua/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Quechua;

public sealed class QuechuaManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    /** The SPELLING vowels — see quechua.jsonc; not the IPA vowels, which core/ipa.ts owns. */
    public IReadOnlyList<string> SpellingVowels { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public QuechuaSymbolTier SymbolTier { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Quechua data tables (see quechua.jsonc). */
    public static readonly QuechuaManifest MANIFEST =
        LoadManifest.Load<QuechuaManifest>("languages/quechua", "quechua.jsonc");
}

public sealed class QuechuaSymbolTier
{
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
}
