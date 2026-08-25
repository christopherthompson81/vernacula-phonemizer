/**
 * Loads the Japanese data manifest (japanese.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/japanese/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public sealed class NasalAssimilationClass
{
    public string Onsets { get; init; } = "";
    public string Nasal { get; init; } = "";
}

public sealed class JapaneseNumberData
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Thousands { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> MyriadUnits { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public string Zero { get; init; } = "";
}

public sealed class PitchStripDef
{
    public string Particles { get; init; } = "";
    public IReadOnlyList<string> Copula { get; init; } = Array.Empty<string>();
    public string CopulaFinalParticles { get; init; } = "";
}

public sealed class JapaneseManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Mora { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> YouonOnset { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> SmallY { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Foreign { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelKana { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<NasalAssimilationClass> NasalAssimilation { get; init; } = Array.Empty<NasalAssimilationClass>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public JapaneseNumberData Numbers { get; init; } = new();
    public PitchStripDef PitchStrip { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public JapaneseSymbolTier SymbolTier { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Japanese data tables (see japanese.jsonc). */
    public static readonly JapaneseManifest MANIFEST =
        LoadManifest.Load<JapaneseManifest>("languages/japanese", "japanese.jsonc");
}

public sealed class JapaneseSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public BareExponentDef BareExponent { get; init; } = new();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
    public bool UnspacedScript { get; init; } = false;
}
