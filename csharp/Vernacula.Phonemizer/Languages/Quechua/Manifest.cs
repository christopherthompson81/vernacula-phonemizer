/**
 * Loads the Quechua data manifest (quechua.jsonc) once at module init and exposes it typed. Both readers
 * import it from HERE rather than each calling loadManifest: quechua.ts already imports numbers.ts, so
 * having numbers.ts import the manifest back from quechua.ts would close an import cycle, and two
 * loadManifest calls would read and JSONC-parse the same file twice at startup.
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
}

public static class Manifest
{
    /** The consolidated hand-authored Quechua data tables (see quechua.jsonc). */
    public static readonly QuechuaManifest MANIFEST =
        LoadManifest.Load<QuechuaManifest>("languages/quechua", "quechua.jsonc");
}
