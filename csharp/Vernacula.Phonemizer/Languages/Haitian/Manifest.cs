/**
 * The consolidated hand-authored haitian data tables (haitian.jsonc).
 * Ported from src/languages/haitian/manifest.ts — see that file for why the tables live in their own module.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Haitian;

public static class Manifest
{
    public static readonly HaitianDef MANIFEST =
        LoadManifest.Load<HaitianDef>("languages/haitian", "haitian.jsonc");
}
