/**
 * Loads the Serbian data manifest (serbian.jsonc) once and exposes it typed — the Latin digraph table, the
 * single-letter→IPA table (both scripts), clause punctuation, and the number words.
 * Ported from src/languages/serbian/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Serbian;

/** One magnitude noun's count forms. ⚠ SHARED WITH hr/bs, whose manifests declare `numbers` as this same
 *  shape with their own word forms (croatian.jsonc tisuća/milijun, bosnian.jsonc hiljada + dvjesta). */
public sealed class SlavicMagnitude
{
    public string? Standalone { get; init; }
    public string One { get; init; } = "";
    public string? Few { get; init; }
    public string Many { get; init; } = "";
    public string? OneFeminine { get; init; }
    public string? TwoFeminine { get; init; }
}

/** The Serbo-Croatian cardinal table. hr/bs reuse this type verbatim — see SlavicMagnitude. */
public sealed class SerbianNumbers
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public SlavicMagnitude Thousand { get; init; } = new();
    public SlavicMagnitude Million { get; init; } = new();
}

public sealed class SerbianManifest
{
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public SerbianNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly SerbianManifest MANIFEST =
        LoadManifest.Load<SerbianManifest>("languages/serbian", "serbian.jsonc");
}
