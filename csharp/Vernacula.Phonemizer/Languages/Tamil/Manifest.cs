/**
 * Loads the Tamil data manifest (tamil.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/tamil/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tamil;

/** The Tamil cardinal tables. */
public sealed class TamilNumbers
{
    public string[] Units { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] TensCombining { get; init; } = [];
    public string[] Hundreds { get; init; } = [];
    public string[] HundredsCombining { get; init; } = [];
    public string[] Thousands { get; init; } = [];
    public string[] ThousandsCombining { get; init; } = [];
    public MagnitudesDef Magnitudes { get; init; } = new();

    public sealed class MagnitudesDef
    {
        public string Hundred { get; init; } = "";
        public string Thousand { get; init; } = "";
        public string ThousandCombining { get; init; } = "";
        public string Lakh { get; init; } = "";
        public string LakhCombining { get; init; } = "";
        public string Crore { get; init; } = "";
        public string CroreCombining { get; init; } = "";
        public string One { get; init; } = "";
    }
}

public sealed class TamilVoicing
{
    public IReadOnlyDictionary<string, string> Voice { get; init; } = new Dictionary<string, string>();
    public string[] Nasals { get; init; } = [];
    public string[] VoicelessBlock { get; init; } = [];
}

public sealed class TamilManifest : AbugidaDef
{
    public TamilVoicing Voicing { get; set; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; set; } = new Dictionary<string, string>();
    public TamilNumbers Numbers { get; set; } = new();
    /** ⚠ WRITTEN forms for RECOGNITION, not a spelling map — see the jsonc. Never emitted. */
    public IReadOnlyList<string> InitialismLetterForms { get; init; } = Array.Empty<string>();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public TamilSymbolTier SymbolTier { get; init; } = new();
    /** Ordinal suffixes, LONGEST FIRST — order is load-bearing. See the jsonc. */
    public IReadOnlyList<string> OrdinalSuffixes { get; init; } = Array.Empty<string>();
}

public static class Manifest
{
    /** The consolidated Tamil data (abugida def + post-pass tables; see tamil.jsonc). */
    public static readonly TamilManifest MANIFEST = LoadManifest.Load<TamilManifest>("languages/tamil", "tamil.jsonc");
}

public sealed class TamilSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}
