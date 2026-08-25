/**
 * Loads the Malayalam data manifest (malayalam.jsonc) once and exposes it typed.
 * Ported from src/languages/malayalam/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malayalam;

/** Malayalam's numbers block: the shared Dravidian composer's data plus the decimal word. */
public sealed class MalayalamNumbers : DravidianNumbersDef
{
    public string DecimalWord = "";
}

public sealed class MalayalamManifest : AbugidaDef
{
    public MalayalamNumbers Numbers { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public MalayalamSymbolTier SymbolTier { get; init; } = new();
    /** The clitics welded onto a numeral, LONGEST FIRST — order is load-bearing. See the jsonc. */
    public IReadOnlyList<string> OrdinalEndings { get; init; } = Array.Empty<string>();
}

public static class Manifest
{
    public static readonly MalayalamManifest MANIFEST =
        LoadManifest.Load<MalayalamManifest>("languages/malayalam", "malayalam.jsonc");
}

public sealed class MalayalamSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}
