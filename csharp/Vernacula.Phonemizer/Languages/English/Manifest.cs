/**
 * Loads the English data manifest (english.jsonc) once at module init and exposes it typed. Holds the closed,
 * hand-authored FACTS of English — heteronyms, function words, number words, the ARPABET→IPA correspondence,
 * and the small closed word-lists — that the algorithms (english.ts, numbers.ts, englishArpabet.ts, and the
 * pure englishG2p.ts via injection) read. The bulk statistical models stay referenced as files (see the jsonc's
 * "models" block); only authorable data lives here.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public sealed class HeteronymEntry
{
    public string Default { get; init; } = "";
    public string? Verb { get; init; }
    public string? Noun { get; init; }
    public string? Past { get; init; }
}

public sealed class EnglishNumbersDef
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();   // 0–19
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();   // ×10 (index 2–9)
    public string Hundred { get; init; } = "";
    public IReadOnlyList<string> Scale { get; init; } = Array.Empty<string>();  // thousand, million, … nonillion (10^3 … 10^30)
    public IReadOnlyDictionary<string, string> Ordinals { get; init; } = new Dictionary<string, string>();
}

// ARPABET phonetic-class sets consumed (via injection) by the pure OOV G2P. `vowels` is NOT here — the OOV
// G2P reuses arpabet.vowels (single source of truth for the ARPABET vowel bases), spliced in at build time.
public sealed class G2pClasses
{
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Voiceless { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Sibilants { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> StopPieces { get; init; } = Array.Empty<string>();
}

public sealed class EnglishManifest
{
    public IReadOnlyDictionary<string, HeteronymEntry> Heteronyms { get; init; } = new Dictionary<string, HeteronymEntry>();
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> UnstressedWords { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> NonTonicFinal { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> WhSecondary { get; init; } = Array.Empty<string>();
    public ArpabetDef Arpabet { get; init; } = new();
    public EnglishNumbersDef Numbers { get; init; } = new();
    public G2pClasses G2pClasses { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored English data facts (see english.jsonc). */
    public static readonly EnglishManifest MANIFEST =
        LoadManifest.Load<EnglishManifest>("languages/english", "english.jsonc");
}
