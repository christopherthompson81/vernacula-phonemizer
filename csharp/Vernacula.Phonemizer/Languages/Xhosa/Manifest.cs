/**
 * Loads the Xhosa data manifest (xhosa.jsonc) once and exposes it typed. Xhosa reuses the Zulu manifest SHAPE
 * — the same rule table, tone-code→Chao map, clause punctuation and Nguni number words — differing only in
 * the DATA (⟨rh⟩→x, the Xhosa number words).
 * Ported from src/languages/xhosa/manifest.ts — see that file for the sibling relationship.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Zulu;

namespace Vernacula.Phonemizer.Languages.Xhosa;

public static class Manifest
{
    /** The consolidated hand-authored Xhosa data tables (see xhosa.jsonc). */
    public static readonly ZuluManifest MANIFEST = LoadManifest.Load<ZuluManifest>("languages/xhosa", "xhosa.jsonc");

    /** The rule tuples, projected once out of their JSON arrays. ⚠ FILE ORDER IS THE SCAN ORDER — the shared
     *  Nguni scan is longest-match BY POSITION in this list, not by string length. */
    public static readonly IReadOnlyList<Rule> RULES = MANIFEST.Rules
        .Select(r => new Rule(r[0].GetString()!, r[1].GetString()!, r[2].GetBoolean()))
        .ToList();
}
