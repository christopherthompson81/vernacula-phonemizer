/**
 * Loads the Sinhala data manifest (sinhala.jsonc) once and exposes it typed: the abugida definition read by
 * the shared Core/Abugida.cs, plus the Sinhala-specific post-pass data (anusvara classes, clause punctuation,
 * cardinal number words).
 * Ported from src/languages/sinhala/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sinhala;

public sealed class SinhalaAnusvaraClass
{
    public string Triggers { get; set; } = "";
    public string Nasal { get; set; } = "";
    public string? Note { get; set; }
}

public sealed class SinhalaAnusvara
{
    public string Default { get; set; } = "";
    public IReadOnlyList<SinhalaAnusvaraClass> Classes { get; set; } = Array.Empty<SinhalaAnusvaraClass>();
}

public sealed class SinhalaMagnitudes
{
    public string Hundred { get; set; } = "";
    public string Thousand { get; set; } = "";
    public string Lakh { get; set; } = "";
    public string Million { get; set; } = "";
}

public sealed class SinhalaNumbers
{
    public IReadOnlyList<string> Units { get; set; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; set; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> TensWord { get; set; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> TensStem { get; set; } = new Dictionary<string, string>();
    public SinhalaMagnitudes Magnitudes { get; set; } = new();
}

public sealed class SinhalaManifest : AbugidaDef
{
    public SinhalaAnusvara Anusvara { get; set; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; set; } = new Dictionary<string, string>();
    public SinhalaNumbers Numbers { get; set; } = new();
}

public static class Manifest
{
    public static readonly SinhalaManifest MANIFEST =
        LoadManifest.Load<SinhalaManifest>("languages/sinhala", "sinhala.jsonc");
}
