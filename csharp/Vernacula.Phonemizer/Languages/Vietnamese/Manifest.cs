/**
 * Loads the Vietnamese data manifest (vietnamese.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/vietnamese/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Vietnamese;

public sealed class VietnameseTones
{
    public IReadOnlyDictionary<string, string> Diacritics { get; init; } = new Dictionary<string, string>();
    public string Ngang { get; init; } = "";
}

public sealed class VietnameseNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Scales { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Ten { get; init; } = "";
    public string TensMultiplier { get; init; } = "";
    public string UnitOneAfterTen { get; init; } = "";
    public string UnitFiveAfterTen { get; init; } = "";
    public string ZeroTens { get; init; } = "";
}

public sealed class VietnameseManifest
{
    public VietnameseTones Tones { get; init; } = new();
    /**
     * ⚠ A TUPLE ARRAY IN THE TS (`[string, string][]`), so JSON gives array-of-arrays and System.Text.Json has
     * no tuple binding for it. The rows land as `JsonElement` and are projected once into `ONSETS`; FILE ORDER
     * IS PRESERVED, because the onset match is longest-first BY POSITION in that list.
     */
    public List<List<System.Text.Json.JsonElement>> Onsets { get; init; } = new();
    public string VowelLetters { get; init; } = "";
    public string VowelIpa { get; init; } = "";
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public VietnameseNumbersDef Numbers { get; init; } = new();
    /** ⚠ Keyed by UPPERCASE Latin — see the jsonc. Dictionary keys are not touched by the loader's
     *  camelCase PROPERTY policy, which is what mangled English's ARPABET block. */
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The consolidated hand-authored Vietnamese data tables (see vietnamese.jsonc). */
    public static readonly VietnameseManifest MANIFEST = LoadManifest.Load<VietnameseManifest>("languages/vietnamese", "vietnamese.jsonc");

    /** The onset table as (orthography, IPA) pairs, projected once out of their JSON arrays. */
    public static readonly IReadOnlyList<(string Orth, string Ipa)> ONSETS =
        MANIFEST.Onsets.Select(r => (r[0].GetString()!, r[1].GetString()!)).ToList();
}
