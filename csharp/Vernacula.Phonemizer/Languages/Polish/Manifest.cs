/**
 * Loads the consolidated Polish data manifest (polish.jsonc) once and exposes it typed.
 * Ported from src/languages/polish/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Polish;

/** A Slavic magnitude noun's three count forms: sg (1), paucal (2–4), gen-pl (5+ / 11–14). */
public sealed class Agreement
{
    public string Sg { get; init; } = "";
    public string Paucal { get; init; } = "";
    public string Plural { get; init; } = "";
}

public sealed class PolishVoicing
{
    public IReadOnlyDictionary<string, string> ToVoiceless { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ToVoiced { get; init; } = new Dictionary<string, string>();
}

public sealed class PolishMagnitudes
{
    public Agreement Thousand { get; init; } = new();
    public Agreement Million { get; init; } = new();
    public Agreement Billion { get; init; } = new();
}

public sealed class PolishNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string[] Hundreds { get; init; } = [];
    public PolishMagnitudes Magnitudes { get; init; } = new();
}

public sealed class PolishManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> NasalVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> SoftI { get; init; } = new Dictionary<string, string>();
    public PolishVoicing Voicing { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** LEXICAL: acronyms read letter-by-letter even though the letters could form a readable word. */
    public string[] AcronymLetters { get; init; } = [];
    public PolishNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public PolishPhonotactics Phonotactics { get; init; } = new();
    /** The name of the DECIMAL COMMA, between the integer and fractional parts. */
    public string DecimalWord { get; init; } = "";
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public PolishSymbolTier SymbolTier { get; init; } = new();
    /** Roman-numeral ordinals 1–19; index 0 is empty. */
    public IReadOnlyList<string> RomanOrdinals { get; init; } = Array.Empty<string>();
}

public sealed class PolishPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

public static class Manifest
{
    public static readonly PolishManifest MANIFEST = LoadManifest.Load<PolishManifest>("languages/polish", "polish.jsonc");
}

public sealed class PolishSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}
