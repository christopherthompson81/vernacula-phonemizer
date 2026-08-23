/**
 * Loads the Modern Greek data manifest (greek.jsonc) once at module init. Holds the context-free hand-authored
 * DATA (vowel/consonant/digraph tables, palatalisation map, number words); the CONTEXT rules (palatalisation,
 * αυ/ευ + σ voicing, synizesis, double-consonant simplification) live in greek.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Greek;

public sealed class GreekNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public string Hundred { get; init; } = "";
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string Thousand { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class GreekManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    /** Voiceless consonant letters — they take the voiceless glide [ç] under palatalisation. */
    public IReadOnlyList<string> Voiceless { get; init; } = Array.Empty<string>();
    /** Letters AND digraphs that make ⟨αυ ευ⟩ voiced ([av ev] rather than [af ef]). */
    public IReadOnlyList<string> AuVoiced { get; init; } = Array.Empty<string>();
    /** The shorter class that voices a preceding ⟨σ⟩ to [z]. */
    public IReadOnlyList<string> SigmaVoiced { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> VowelDigraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ConsonantDigraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Palatal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public GreekNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Modern Greek data tables (see greek.jsonc). */
    public static readonly GreekManifest MANIFEST =
        LoadManifest.Load<GreekManifest>("languages/greek", "greek.jsonc");
}
