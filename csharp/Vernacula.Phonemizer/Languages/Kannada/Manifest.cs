/**
 * Loads the Kannada data manifest (kannada.jsonc) once and exposes it typed.
 * Ported from src/languages/kannada/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kannada;

/** Kannada's numbers block: the shared Dravidian composer's data plus the decimal word. */
public sealed class KannadaNumbers : DravidianNumbersDef
{
    public string DecimalWord = "";
}

public sealed class KannadaManifest : AbugidaDef
{
    public KannadaNumbers Numbers { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
    /** ⚠ WRITTEN forms for RECOGNITION, not a spelling map — see the jsonc. Never emitted. */
    public IReadOnlyList<string> InitialismLetterForms { get; init; } = Array.Empty<string>();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public KannadaSymbolTier SymbolTier { get; init; } = new();
}

public static class Manifest
{
    public static readonly KannadaManifest MANIFEST =
        LoadManifest.Load<KannadaManifest>("languages/kannada", "kannada.jsonc");
}

public sealed class KannadaSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}
