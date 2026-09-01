/**
 * The consolidated hand-authored WESTERN Armenian data tables (westarmenian.jsonc), loaded once and
 * exposed typed.
 *
 * ⚠ THE Def IS SHARED with `Armenian` — this language has its own jsonc but not its own shape. A separate
 * module from the engine so Normalize.cs can reach the tables without importing the phonemizer.
 * Ported from src/languages/westarmenian/manifest.ts — see that file for the rationale.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Armenian;

namespace Vernacula.Phonemizer.Languages.WestArmenian;

public static class Manifest
{
    public static readonly ArmenianDef MANIFEST =
        LoadManifest.Load<ArmenianDef>("languages/westarmenian", "westarmenian.jsonc");
}
