/**
 * Loads the Abkhaz data manifest (abkhaz.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/abkhaz/manifest.ts — see that file and the jsonc for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Abkhaz;

/** An Abkhaz numeral with two shapes: `bare` (group-final) and `comb` — the -и connective form used when a
 *  smaller number FOLLOWS it (шәкы → шәи акы, ҩажәа → ҩажәи жәаба). */
public sealed class NumeralSeries
{
    public IReadOnlyList<string> Bare { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Comb { get; init; } = Array.Empty<string>();
}

/** Fused thousands by multiplier 1–10 (index 0 is unused padding), the fused 100 000, and the free-standing
 *  нызқь used with any other multiplier. */
public sealed class AbkhazThousands
{
    public IReadOnlyList<string> Fused { get; init; } = Array.Empty<string>();
    public string Hundred { get; init; } = "";
    public string Word { get; init; } = "";
}

public sealed class AbkhazNumbersDef
{
    /** 0–9 → the plain Abkhaz numeral (аноль…жәба). */
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    /** 10–19 → the teen series (жәаба…зеижә). */
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    /** Vigesimal score words indexed by the score count 1–4 (20, 40, 60, 80). */
    public NumeralSeries Scores { get; init; } = new();
    /** Round-hundred words indexed by the hundreds digit 1–9. */
    public NumeralSeries Hundreds { get; init; } = new();
    public AbkhazThousands Thousands { get; init; } = new();
    public string Million { get; init; } = "";
    public string Milliard { get; init; } = "";
    /** ⟨тәи⟩ — the ordinal suffix; the numeral takes а- in front and this behind. */
    public string OrdinalSuffix { get; init; } = "";
    /** ⟨актәи⟩ — suppletive, because the cardinal акы would give *акытәи. */
    public string OrdinalOne { get; init; } = "";
    /** The range connectives ("from" / "to"). */
    public string RangeFrom { get; init; } = "";
    public string RangeTo { get; init; } = "";
}

/** Words for symbols (%, °, currency, км², the clock) — attested in FULL ab.wikipedia text, not the
 *  sampled corpus artifact; sourcing in docs/abkhaz_vocabulary_investigation.md. */
public sealed class AbkhazSymbolsDef
{
    public string Percent { get; init; } = "";
    public string Degree { get; init; } = "";
    /** The MINUS marker — see the jsonc: declared on the block's Russian-loan pattern, ×0 itself. */
    public string Minus { get; init; } = "";
    /** ⟨Цельси иградус⟩ — the attested unit NAME, used verbatim; Цельси is never attested bare. */
    public string Celsius { get; init; } = "";
    /** ⟨асааҭ⟩ — goes BEFORE the number ("асааҭ 6 рзы"). */
    public string Hour { get; init; } = "";
    /** [symbol, word] — km/m, in the corpus's own digit-adjacent spellings (километра, метра). */
    public IReadOnlyList<IReadOnlyList<string>> Units { get; init; } = Array.Empty<IReadOnlyList<string>>();
    /** ⟨квадрат⟩ — postposed measure word for ²; no cubed word is sourceable. */
    public string Squared { get; init; } = "";
    /** [symbol, word] — the symbol precedes the number in text, the word follows it in speech.
     *  Compound keys (US$, B£) included, because the shared tier letter-bounds a bare sign. */
    public IReadOnlyList<IReadOnlyList<string>> Currencies { get; init; } = Array.Empty<IReadOnlyList<string>>();
    /** Scale abbreviation (млрд/млн) → the KEY in `numbers` holding its word — a reference, so the
     *  word cannot drift from the copy the number path reads. */
    public IReadOnlyDictionary<string, string> Scales { get; init; } = new Dictionary<string, string>();
}

public sealed class AbkhazManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    /** Base letter + modifier (⟨ь⟩ palatal / ⟨ә⟩ labial / ⟨'⟩ pharyngeal) → the specific IPA cluster. */
    public IReadOnlyDictionary<string, string> Clusters { get; init; } = new Dictionary<string, string>();
    /** Base letters (single Cyrillic) → the IPA. */
    public IReadOnlyDictionary<string, string> Base { get; init; } = new Dictionary<string, string>();
    /** A modifier standing after a base with no CLUSTER entry → the generic modifier IPA is appended. */
    public IReadOnlyDictionary<string, string> Modifiers { get; init; } = new Dictionary<string, string>();
    /** Letters that write a vowel — the environment for the ⟨у⟩/⟨и⟩ glide-vs-syllabic rule in Abkhaz.cs. */
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    /** [abbreviation, expansion] — LONGEST FIRST; the scan applies them in order. */
    public IReadOnlyList<IReadOnlyList<string>> Abbreviations { get; init; } = Array.Empty<IReadOnlyList<string>>();
    public AbkhazNumbersDef Numbers { get; init; } = new();
    public AbkhazSymbolsDef Symbols { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Abkhaz data tables (see abkhaz.jsonc). */
    public static readonly AbkhazManifest MANIFEST =
        LoadManifest.Load<AbkhazManifest>("languages/abkhaz", "abkhaz.jsonc");
}
