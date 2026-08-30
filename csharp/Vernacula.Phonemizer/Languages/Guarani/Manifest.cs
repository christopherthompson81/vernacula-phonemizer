/**
 * Loads the Guaraní data manifest (guarani.jsonc) once and exposes it typed.
 *
 * ⚠ A SEPARATE MODULE, not a `LoadManifest` call inside the engine file: Normalize.cs needs the ordinal
 * suffix and importing the engine to reach it would drag the whole phonemizer in — the TS split that
 * src/languages/guarani/manifest.ts exists for.
 * Ported from src/languages/guarani/manifest.ts and the `GuaraniDef` interface in guarani.ts — see the
 * jsonc for the table's sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Guarani;

public sealed record GuaraniDef
{
    /** The ACUTE vowels — Guaraní marks stress with an acute and an unmarked word is oxytone, so this
     *  list is the whole stress rule's input. */
    public IReadOnlyList<string> AcuteVowels { get; init; } = Array.Empty<string>();

    /** The TILDE vowels — the tilde writes NASALITY, and a nasal vowel also attracts stress. */
    public IReadOnlyList<string> NasalVowels { get; init; } = Array.Empty<string>();

    /** The FRONT/CENTRAL vowel letters in every marked form: ⟨gu⟩ is u-silent [ɰ] before one of these. */
    public IReadOnlyList<string> FrontLetters { get; init; } = Array.Empty<string>();

    /** Multi-letter units, scanned longest-first: the prenasalized stops, ⟨ng⟩, ⟨ch⟩, ⟨gu⟩, ⟨rr⟩. */
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();

    /** Single graphemes — the 12-vowel system and the achegety consonants plus the loan letters. */
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();

    /** Clause punctuation → the pause it becomes. */
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();

    /** The ordinal suffix, glued to the worded numeral (normalize.cs step 7). */
    public string OrdinalSuffix { get; init; } = "";
}

public static class Manifest
{
    public static readonly GuaraniDef MANIFEST = LoadManifest.Load<GuaraniDef>("languages/guarani", "guarani.jsonc");
}
