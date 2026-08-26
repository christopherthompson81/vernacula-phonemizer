/**
 * Loads the Uyghur data manifest (uyghur.jsonc) once and exposes it typed — the letter→IPA grapheme table,
 * the Turkic numeral spellings and the clause punctuation. The final-devoicing algorithm stays in Uyghur.cs.
 * Ported from src/languages/uyghur/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Uyghur;

public sealed class UyghurManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public string[] Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public NumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly UyghurManifest MANIFEST =
        LoadManifest.Load<UyghurManifest>("languages/uyghur", "uyghur.jsonc");
}
