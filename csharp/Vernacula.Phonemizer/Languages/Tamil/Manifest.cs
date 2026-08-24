/**
 * Loads the Tamil data manifest (tamil.jsonc) once at module init and exposes it typed. The manifest IS the
 * language data: the abugida definition (consonants / vowels / signs — read by the shared core/abugida.ts G2P),
 * plus the Tamil-specific post-pass DATA (the Dravidian voicing classes, clause punctuation, and the cardinal
 * number words). The ALGORITHMS that read it stay in code (tamil.ts / numbers.ts): the IPA-unit segmenter, the
 * context-sensitive voicing allophony, the two-level stress pass, and the number compositor.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tamil;

/**
 * The Tamil cardinal tables. Tamil numerals are SANDHI-FUSED, so every level needs two forms: the free
 * form (exact multiple — இருபது, நூறு, ஆயிரம்) and the COMBINING/oblique form used when a remainder
 * follows it (இருபத்தி, நூற்றி, ஆயிரத்து). 11–19 are suppletive and listed outright.
 */
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
}

public static class Manifest
{
    /** The consolidated Tamil data (abugida def + post-pass tables; see tamil.jsonc). */
    public static readonly TamilManifest MANIFEST = LoadManifest.Load<TamilManifest>("languages/tamil", "tamil.jsonc");
}
