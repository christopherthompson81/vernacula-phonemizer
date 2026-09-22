/**
 * Loads the English data manifest (english.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/english/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public sealed class HeteronymEntry
{
    public string Default { get; init; } = "";
    public string? Verb { get; init; }
    public string? Noun { get; init; }
    public string? Past { get; init; }
    /** The ADJECTIVE reading, where it differs from the default. See the TypeScript. */
    public string? Adj { get; init; }
    /** A FOLLOWING-WORD CONDITION, for the pairs no POS tag separates. See the TypeScript. */
    public BeforeCondition? Before { get; init; }
}

/**
 * ⚠ `used to` IS THE CASE THIS EXISTS FOR AND THE MEASUREMENT IS THE WHOLE JUSTIFICATION. `used` is
 * rank 125, and the habitual /juːst/ and the passive /juːzd/ are both VBD-or-VBN before an infinitival
 * `to`. Counted over the 101 `used to` tokens in the UD English treebanks, scored with THIS tagger:
 * 41% today (always juːzd), 59% for a flat bigram, 81% for VBD alone, 85% for VBD-or-next-tag-IN.
 * The second test is what reaches "be/get used to &lt;noun|gerund&gt;", where `to` is a PREPOSITION (IN)
 * rather than the infinitive marker (TO) and the reading is /juːst/ as well. See the TypeScript.
 */
public sealed class BeforeCondition
{
    /** The following surface word, lower-cased. */
    public string Word { get; init; } = "";
    /** Tags of THIS word that select the marked reading. */
    public IReadOnlyList<string>? Tags { get; init; }
    /** Tags of the FOLLOWING word that select it, independently of `Tags`. */
    public IReadOnlyList<string>? NextTags { get; init; }
    /** Which slot the condition drives. The slot is true exactly when the condition fires. */
    public string Slot { get; init; } = "";
}

public sealed class EnglishNumbersDef
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();   // 0–19
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();   // ×10 (index 2–9)
    public string Hundred { get; init; } = "";
    public IReadOnlyList<string> Scale { get; init; } = Array.Empty<string>();  // thousand, million, … nonillion (10^3 … 10^30)
    public IReadOnlyDictionary<string, string> Ordinals { get; init; } = new Dictionary<string, string>();
}

public sealed class G2pClasses
{
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Voiceless { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Sibilants { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> StopPieces { get; init; } = Array.Empty<string>();

    public IReadOnlyList<string> StemStressPrefixes { get; init; } = Array.Empty<string>();
}

public sealed class EnglishManifest
{
    public IReadOnlyDictionary<string, HeteronymEntry> Heteronyms { get; init; } = new Dictionary<string, HeteronymEntry>();
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> UnstressedWords { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> NonTonicFinal { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> WhSecondary { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClauseInitialStressed { get; init; }
        = new Dictionary<string, string>();
    public ArpabetDef Arpabet { get; init; } = new();
    public EnglishNumbersDef Numbers { get; init; } = new();
    public G2pClasses G2pClasses { get; init; } = new();
    /** ⚠ NOT a letter-name table — CMUdict already names all 26. Only the ⟨a⟩ exception is data. */
    public IReadOnlyDictionary<string, string> LetterNameExceptions { get; init; } = new Dictionary<string, string>();
    public EnglishPhonotactics Phonotactics { get; init; } = new();
}

public sealed class EnglishPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

public static class Manifest
{
    /** The consolidated hand-authored English data facts (see english.jsonc). */
    public static readonly EnglishManifest MANIFEST =
        LoadManifest.Load<EnglishManifest>("languages/english", "english.jsonc");
}
