/**
 * Loads the Croatian data manifest (croatian.jsonc). Croatian reuses the Serbo-Croatian SEGMENTAL g2p from
 * the Serbian module, so this manifest holds only the Croatian-specific delta — the cardinal number-word
 * table (tisuća/milijun/dvjesto) — plus clause punctuation.
 * Ported from src/languages/croatian/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Serbian;

namespace Vernacula.Phonemizer.Languages.Croatian;

public sealed class CroatianManifest
{
    /** ⚠ THE SAME TYPE AS SERBIAN'S, not a Croatian copy of it: the shape is identical and only the word
     *  forms differ, which is what lets `ComposeSlavicNumber` be parameterized by the table. */
    public SerbianNumbers Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly CroatianManifest MANIFEST =
        LoadManifest.Load<CroatianManifest>("languages/croatian", "croatian.jsonc");
}
