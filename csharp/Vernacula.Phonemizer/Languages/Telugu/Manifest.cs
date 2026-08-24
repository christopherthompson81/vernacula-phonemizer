/**
 * Loads the Telugu data manifest (telugu.jsonc) once and exposes it typed.
 * Ported from src/languages/telugu/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Telugu;

/** The four forms a Telugu magnitude noun takes; see the `magnitudeForms` note in telugu.jsonc.
 *  Telugu is the consumer that needs all four slots of the shared `DravidianForms`. */
public sealed class TeluguNumbers : DravidianNumbersDef
{
    /**
     * ⚠ DECLARED BECAUSE THE MANIFEST DECLARES IT, AND READ BY NOTHING. The C# `DravidianNumbersDef` does
     * NOT extend `NumbersDef` — unlike the TS, where `NumbersDef.magnitudes` is required by the interface —
     * so nothing forces the field here. It is declared anyway so the manifest key has a property that
     * consumes it and `ManifestMappingTests` stays strict.
     */
    public NumbersDef.MagnitudesDef Magnitudes = new();
}

public sealed class TeluguManifest : AbugidaDef
{
    public TeluguNumbers Numbers { get; set; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; set; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly TeluguManifest MANIFEST = LoadManifest.Load<TeluguManifest>("languages/telugu", "telugu.jsonc");
}
