/**
 * Loads the Hawaiian data manifest (hawaiian.jsonc): the single-grapheme→IPA table (the 5 vowels and
 * their macron forms, the 8 consonants, the ʻokina variants, and the loan-letter adaptations), the
 * cardinal-numeral tables, and clause punctuation. The g2p and number ALGORITHMS stay in code.
 * Ported from src/languages/hawaiian/hawaiian.ts — see the jsonc for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hawaiian;

public sealed class HawaiianManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public HawNumbers Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly HawaiianManifest MANIFEST =
        LoadManifest.Load<HawaiianManifest>("languages/hawaiian", "hawaiian.jsonc");
}
