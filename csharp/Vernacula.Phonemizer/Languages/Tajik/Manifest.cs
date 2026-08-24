/**
 * Loads the Tajik data manifest (tajik.jsonc) once at module init and exposes it typed.
 *
 * ⚠ IT IS ITS OWN MODULE BECAUSE `tajik.ts` AND `normalize.ts` BOTH NEED IT. The engine imports the
 * normalizer (to run it inside `text()`) and the normalizer needs the manifest's letter names and month
 * names at module init — re-exporting the manifest from `tajik.ts` made that a cycle, and it failed at
 * import time with "Cannot access 'MANIFEST' before initialization" rather than at any gate. Same shape as
 * `russian/manifest.ts`, and for the same reason.
 *
 * Holds the context-free hand-authored DATA: the vowel/glide/consonant → IPA tables, the cardinal number
 * atoms and their scale ladder, the izofat month names, the Cyrillic letter-name table for initialisms, and
 * clause punctuation. The ALGORITHMS that read them stay in code (`tajik.ts`'s grapheme scan, final stress
 * and number compositor; `normalize.ts`'s rules).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tajik;

public sealed class TajikNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Milliard { get; init; } = "";
    public string Trillion { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class TajikManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Glides { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public TajikNumbersDef Numbers { get; init; } = new();
    /** Month names in the IZOFAT form the corpus writes (`16 ноябри соли 1992`), for the dotted-date rule. */
    public string[] Months { get; init; } = [];
    /** Tajik Cyrillic letter → its spoken NAME, for core/initialisms.ts. */
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    /** Acronyms read letter-by-letter although phonotactics would pass them as words. */
    public string[] AcronymLetters { get; init; } = [];
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The consolidated hand-authored Tajik data tables (see tajik.jsonc). */
    public static readonly TajikManifest MANIFEST = LoadManifest.Load<TajikManifest>("languages/tajik", "tajik.jsonc");
}
