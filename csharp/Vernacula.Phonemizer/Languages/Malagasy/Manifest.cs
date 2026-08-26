/**
 * Loads the Malagasy data manifest (malagasy.jsonc) once and exposes it typed — the vowel/consonant
 * tables, clause punctuation and number words. The algorithms that read them stay in code.
 * Ported from src/languages/malagasy/manifest.ts — see that file for the provenance.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malagasy;

public sealed class MalagasyNumbers
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string[] Hundreds { get; init; } = [];
    public string Connector { get; init; } = "";
    public string Join { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Zero { get; init; } = "";
}

public sealed class MalagasyManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public MalagasyNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly MalagasyManifest MANIFEST =
        LoadManifest.Load<MalagasyManifest>("languages/malagasy", "malagasy.jsonc");
}
