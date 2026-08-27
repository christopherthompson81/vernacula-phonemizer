/**
 * Loads the Central Kurdish data manifest (central-kurdish.jsonc) once and exposes it typed. DATA only;
 * the algorithms stay in code. The TS declares `CkbDef` inline in central-kurdish.ts.
 * Ported from src/languages/central-kurdish/central-kurdish.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.CentralKurdish;

public sealed class CkbDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();

    /** Letters that unambiguously WRITE a vowel — the environment for the و/ی glide test. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    public CkbNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly CkbDef DEF = LoadManifest.Load<CkbDef>("languages/central-kurdish", "central-kurdish.jsonc");
}
