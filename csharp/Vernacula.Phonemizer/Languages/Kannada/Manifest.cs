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
}

public static class Manifest
{
    public static readonly KannadaManifest MANIFEST =
        LoadManifest.Load<KannadaManifest>("languages/kannada", "kannada.jsonc");
}
