/**
 * Loads the Tashelhit data manifest (tashelhit.jsonc) once and exposes it typed.
 *
 * ⚠ TWO GRAPHEME TABLES, ONE LANGUAGE. Tashelhit is written in BOTH the Berber Latin alphabet and
 * Neo-Tifinagh (ⵜⵉⴼⵉⵏⴰⵖ, Morocco's constitutionally-official IRCAM script). Both are phonemic alphabets for
 * the same phonology, so they yield IDENTICAL IPA and the engine picks the table per word by codepoint.
 *
 * Ported from src/languages/tashelhit/tashelhit.ts's `TashelhitDef`.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tashelhit;

public sealed record TashelhitDef
{
    /** Berber Latin alphabet → IPA. */
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    /** Neo-Tifinagh (IRCAM) letter → IPA — the same phonemes, the official Moroccan script. */
    public IReadOnlyDictionary<string, string> Tifinagh { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly TashelhitDef MANIFEST =
        LoadManifest.Load<TashelhitDef>("languages/tashelhit", "tashelhit.jsonc");
}
