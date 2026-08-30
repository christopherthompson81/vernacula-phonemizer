/**
 * Loads the Karakalpak data manifest (karakalpak.jsonc) once and exposes it typed — the digraph and
 * letter→IPA tables of the 2016 Latin orthography.
 * Ported from src/languages/karakalpak/karakalpak.ts (the inline KarakalpakDef) — see that file for the
 * corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Karakalpak;

public sealed class KarakalpakManifest
{
    public IReadOnlyList<string[]> Digraphs { get; init; } = [];
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The hand-authored Karakalpak letter tables (see karakalpak.jsonc). */
    public static readonly KarakalpakManifest MANIFEST =
        LoadManifest.Load<KarakalpakManifest>("languages/karakalpak", "karakalpak.jsonc");

    /** The digraph table as a lookup keyed by the full grapheme. Every key in the jsonc is exactly two
     *  letters, and the TS scan tests `chars[i] === k[0] && chars[i+1] === k[1]` — for two-letter keys
     *  that is whole-key equality, which is what the lookup does. */
    public static readonly IReadOnlyDictionary<string, string> DIGRAPHS =
        MANIFEST.Digraphs.ToDictionary(p => p[0], p => p[1], StringComparer.Ordinal);
}
