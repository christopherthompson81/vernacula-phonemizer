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
}

public static class Manifest
{
    public static readonly MalayalamManifest MANIFEST =
        LoadManifest.Load<MalayalamManifest>("languages/malayalam", "malayalam.jsonc");
}
