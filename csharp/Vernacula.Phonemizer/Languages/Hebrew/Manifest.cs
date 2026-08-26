/**
 * Loads the Hebrew data manifest (hebrew.jsonc) once and exposes it typed: the base consonant→IPA table,
 * the dagesh-hard (bgdkpt) overrides, the niqqud vowel table and the cardinal number words.
 * Ported from src/languages/hebrew/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hebrew;

/** Cardinal number words (niqqud-authored) — composed by Numbers.cs, rendered by the rule g2p. */
public sealed class HebrewNumbers
{
    public string Point { get; set; } = "";
    public string And { get; set; } = "";
    public string[] UnitsF { get; set; } = Array.Empty<string>();
    public string[] UnitsM { get; set; } = Array.Empty<string>();
    public string[] TeensOnes { get; set; } = Array.Empty<string>();
    public string Ten { get; set; } = "";
    public string TeenSuffix { get; set; } = "";
    public string[] Tens { get; set; } = Array.Empty<string>();
    public string Hundred { get; set; } = "";
    public string TwoHundred { get; set; } = "";
    public string HundredsPlural { get; set; } = "";
    public string Thousand { get; set; } = "";
    public string TwoConstruct { get; set; } = "";
    public string TwoThousand { get; set; } = "";
    public string ThousandsPlural { get; set; } = "";
    public string[] ThousandsConstruct { get; set; } = Array.Empty<string>();
    public string Million { get; set; } = "";
    public string Milliard { get; set; } = "";
}

public sealed class HebrewManifest
{
    public string Language { get; set; } = "";
    public string Name { get; set; } = "";
    public string[] Script { get; set; } = Array.Empty<string>();
    public Dictionary<string, string> Consonants { get; set; } = new(StringComparer.Ordinal);
    /** Gutturals whose word-final patach is FURTIVE — read before the consonant, not after it. */
    public string[] FurtivePatachGutturals { get; set; } = Array.Empty<string>();
    /** The one-letter prefixes under which a word-initial sheva is realised [e]. */
    public string[] Proclitics { get; set; } = Array.Empty<string>();
    public Dictionary<string, string> DageshHard { get; set; } = new(StringComparer.Ordinal);
    /** Letter + GERESH ׳ = one grapheme for a phoneme the abjad cannot write (ג׳ d͡ʒ, צ׳ t͡ʃ, ז׳ ʒ). */
    public Dictionary<string, string> GereshDigraphs { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, string> Vowels { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, string> ClausePunctuation { get; set; } = new(StringComparer.Ordinal);
    public HebrewNumbers Numbers { get; set; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Hebrew data tables (see hebrew.jsonc). */
    public static readonly HebrewManifest MANIFEST =
        LoadManifest.Load<HebrewManifest>("languages/hebrew", "hebrew.jsonc");
}
