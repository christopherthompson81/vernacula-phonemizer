/**
 * Loads the Tibetan data manifest (tibetan.jsonc) once and exposes it typed.
 *
 * Tibetan has one of the DEEPEST orthographies in the world — Classical spelling encodes Old Tibetan and the
 * Lhasa reading diverges massively — so the engine is a syllable-STACK rule engine rather than a scan. This
 * file carries only the DATA it reads: letter values, the onset realization tables by tonogenetic class, and
 * the number words. The stack grammar (letter classes, prefix legality, suffix effects) lives with the
 * parser in Tibetan.cs, mirroring the TS split.
 *
 * Ported from src/languages/tibetan/tibetan.ts's `TibetanDef`.
 */
using System.Text.Json;

using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tibetan;

public sealed record TibetanNumbers
{
    public string Zero { get; init; } = "";
    public IReadOnlyList<string> Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public IReadOnlyList<string> Decades { get; init; } = [];
    /** The decade connective used before a unit (21…): ཉེར, སོ, ཞེ … — a different series from `Decades`. */
    public IReadOnlyList<string> Connectives { get; init; } = [];
    public string And { get; init; } = "";
    /** The named 10²…10⁹ ladder, LARGEST FIRST. ⚠ JSON tuples, so they arrive as arrays. */
    public IReadOnlyList<JsonElement> Magnitudes { get; init; } = [];
}

public sealed record TibetanDef
{
    /** Full consonant letters (U+0F40–0F6C) → Wylie token. ⚠ The SUBJOINED forms (U+0F90–0FBC) map to the
     *  same token at codepoint − 0x50, computed in Tibetan.cs rather than duplicated here. */
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
    /** Vowel signs → base vowel. ⚠ LENGTH IS FOLDED OUT — it comes from the coda, not the sign. */
    public IReadOnlyDictionary<string, string> VowelSigns { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Unaspirated { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Aspirated { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Fricatives { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Sonorants { get; init; } = new Dictionary<string, string>();
    public TibetanNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly TibetanDef MANIFEST = LoadManifest.Load<TibetanDef>("languages/tibetan", "tibetan.jsonc");

    /** The magnitude ladder projected out of its JSON arrays, largest first. */
    public static readonly IReadOnlyList<(long Value, string Word)> MAGNITUDES =
        MANIFEST.Numbers.Magnitudes
            .Select(m => (m[0].GetInt64(), m[1].GetString()!))
            .ToList();
}
