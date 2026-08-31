/**
 * Loads the Nama (Khoekhoegowab) data manifest (nama.jsonc) once at module init and exposes it typed: the
 * four click letters, the five plain vowels, and the non-click letter table.
 * Ported from src/languages/nama/nama.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nama;

public sealed class NamaDef
{
    public IReadOnlyList<string> Clicks { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> PlainVowels { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly NamaDef DEF = LoadManifest.Load<NamaDef>("languages/nama", "nama.jsonc");

    public static readonly HashSet<string> CLICK = new(DEF.Clicks);
    public static readonly HashSet<string> PLAIN_VOWEL = new(DEF.PlainVowels);
}
