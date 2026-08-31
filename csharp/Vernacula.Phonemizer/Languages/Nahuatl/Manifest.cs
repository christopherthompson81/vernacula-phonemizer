/**
 * Loads the Nahuatl data manifest (nahuatl.jsonc) once and exposes it typed.
 *
 * Classical Nahuatl (nāhuatlahtōlli) is Uto-Aztecan, written in the traditional Spanish-based Latin
 * orthography (Andrews §2): 8 vowels × length (macron → [Vː]), the acute spellings folded to the plain
 * vowel, and the context-free consonant table. The context-dependent letters (⟨c z x h q u⟩) are code,
 * in Nahuatl.cs.
 *
 * Ported from src/languages/nahuatl/nahuatl.ts's `NahuatlDef` — see nahuatl.jsonc for the single-source note.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nahuatl;

public sealed record NahuatlDef
{
    /** Vowels; the macron spellings are long, the acute spellings (some texts) fold to the plain vowel. */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();

    /** Non-contextual single consonants (⟨c z x h q u⟩ are handled positionally in Nahuatl.cs; loan
     *  letters map to the nearest sound). */
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly NahuatlDef MANIFEST = LoadManifest.Load<NahuatlDef>("languages/nahuatl", "nahuatl.jsonc");
}
