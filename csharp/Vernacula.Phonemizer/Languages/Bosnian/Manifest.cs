/**
 * Loads the Bosnian data manifest (bosnian.jsonc). Bosnian reuses the Serbo-Croatian segmental g2p from the
 * Serbian module, so this manifest holds only the Bosnian-specific delta — the cardinal number table — plus
 * clause punctuation.
 * Ported from src/languages/bosnian/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bosnian;

public sealed class BosnianManifest
{
    /** ⚠ THE SERBIAN TYPE, NOT A COPY — the TS declares `numbers: (typeof SR)["numbers"]` and the shared
     *  compositor takes that exact shape. A second declaration here would be a table that can drift. */
    public Serbian.SerbianNumbers Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly BosnianManifest MANIFEST =
        LoadManifest.Load<BosnianManifest>("languages/bosnian", "bosnian.jsonc");
}
