/**
 * Loads the Dutch data manifest (dutch.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/dutch/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Dutch;

public sealed class DutchVowels
{
    public IReadOnlyDictionary<string, string> Long { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Short { get; init; } = new Dictionary<string, string>();
}

public sealed class MagnitudeSgPl
{
    public string Sg { get; init; } = "";
    public string Pl { get; init; } = "";
}

public sealed class DutchNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Connector { get; init; } = "";
    /** The connector after a vowel-final unit, with the trema (tweeën). */
    public string ConnectorTrema { get; init; } = "";
    public string DecimalWord { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public MagnitudeSgPl Million { get; init; } = new();
    public MagnitudeSgPl Milliard { get; init; } = new();
}

public sealed class DutchMorphologyDef
{
    public string[] PrefixUnstressed { get; init; } = [];
    public string[] PrefixStressed { get; init; } = [];
    public string[] AmbiguousPrefixes { get; init; } = [];
    /** The subset of `PrefixUnstressed` whose vowel also reduces to schwa — NOT `AmbiguousPrefixes`. */
    public string[] PrefixSchwa { get; init; } = [];
    public string[] Suffixes { get; init; } = [];
    public string[] VowelInitialSuffixes { get; init; } = [];
    public string[] LinkingElements { get; init; } = [];
    public string[] ValidOnsets { get; init; } = [];
    public string[] StKeep { get; init; } = [];
}

public sealed class DutchManifest
{
    public string VowelChars { get; init; } = "";
    /** The ORTHOGRAPHIC vowel letters. ⚠ Not `VowelChars`, which is the IPA set. */
    public string VowelLetters { get; init; } = "";
    /** Function words / clitics → their reduced (schwa) IPA reading. */
    public IReadOnlyDictionary<string, string> FunctionWords { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> ConsonantPhones { get; init; } = Array.Empty<string>();
    public DutchVowels Vowels { get; init; } = new();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VoicedFinal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** Acronyms read LETTER-BY-LETTER although their lowercase form is readable, so neither a dictionary
     *  nor a phonotactic test can express it. Lowercase keys; consumed by core/initialisms.ts. */
    public string[] AcronymLetters { get; init; } = [];
    public DutchNumbersDef Numbers { get; init; } = new();
    public DutchMorphologyDef Morphology { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Dutch data tables (see dutch.jsonc). */
    public static readonly DutchManifest MANIFEST = LoadManifest.Load<DutchManifest>("languages/dutch", "dutch.jsonc");
}
