/**
 * The consolidated hand-authored Armenian data tables (armenian.jsonc), loaded once and exposed typed.
 * A separate module from the engine so normalize can reach the tables without importing the phonemizer.
 * Ported from src/languages/armenian/manifest.ts — see that file for the rationale.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Armenian;

public static class Manifest
{
    public static readonly ArmenianDef MANIFEST =
        LoadManifest.Load<ArmenianDef>("languages/armenian", "armenian.jsonc");
}
