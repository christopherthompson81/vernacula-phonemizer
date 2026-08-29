/**
 * Loads the Estonian data manifest (estonian.jsonc) once at module init and exposes it typed: the grapheme
 * table, the vowel letters (which split the DOUBLING rule), the clause punctuation and the cardinal number
 * words. The scan, the gemination rule and the composition stay in code.
 * Ported from src/languages/estonian/estonian.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Estonian;

/** Cardinal number words. Tens (unit+kümmend) and hundreds (unit+sada) are single words; the sub-parts
 *  join with a space (kakskümmend üks = 21). */
public sealed class EstonianNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public IReadOnlyList<string> Teens { get; init; } = [];
    public string TensSuffix { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
}

public sealed class EstonianManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Grapheme → canonical IPA. ⟨b d g⟩ are the VOICELESS-LENIS stops (Estonian has no true voiced
     *  stops); the 9 vowels include õ→ɤ. */
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();

    /** ⚠ THE VOWEL LETTERS SPLIT THE DOUBLING RULE — a doubled vowel is always long (aa→ɑː), a doubled
     *  consonant is a geminate only after a vowel — so a loan vowel missing here would be GEMINATED
     *  instead of lengthened. The nine native ones plus the accented loan vowels and the loan ⟨y⟩. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();

    public EstonianNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly EstonianManifest MANIFEST =
        LoadManifest.Load<EstonianManifest>("languages/estonian", "estonian.jsonc");

    public static readonly IReadOnlySet<string> VOWEL_LETTERS =
        new HashSet<string>(MANIFEST.VowelLetters, StringComparer.Ordinal);
}
