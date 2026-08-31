/**
 * Loads the Luo (Dholuo) data manifest (luo.jsonc) once and exposes it typed. Holds the hand-authored DATA:
 * the orthography→IPA grapheme table (dental/palatal/prenasal digraphs, ⟨ng'⟩, the 5 default-ATR vowels)
 * plus the spelling-vowel set and clause punctuation. The high-vowel-glide ALGORITHM stays in code (Luo.cs).
 * Ported from src/languages/luo/manifest.ts — see the jsonc for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Luo;

public sealed class LuoManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    /** The SPELLING vowels — the gi-/g- elision reads them; not IPA. */
    public IReadOnlyList<string> SpellingVowels { get; init; } = [];
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly LuoManifest MANIFEST = LoadManifest.Load<LuoManifest>("languages/luo", "luo.jsonc");

    /** Grapheme keys sorted LENGTH DESC so the greedy scan tries ng' → the two-letter digraphs → singles.
     *  A stable sort, matching the TS `sort((a, b) => b.length - a.length)`; equal-length keys cannot both
     *  match one position, so their relative order is immaterial to the scan. */
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}
