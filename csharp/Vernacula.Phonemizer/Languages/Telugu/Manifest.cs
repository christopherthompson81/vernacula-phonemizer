/**
 * Loads the Telugu data manifest (telugu.jsonc) once and exposes it typed. The manifest IS the language
 * data: the abugida definition read by the shared core/abugida.ts G2P, the clause punctuation, and the
 * cardinal number words including the magnitude-agreement forms. The ALGORITHMS that read it stay in
 * code — the G2P post-pass (telugu.ts) and the number compositor (numbers.ts).
 *
 * Split out of telugu.ts so numbers.ts and normalize.ts can read the same single load.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Telugu;

/** The four forms a Telugu magnitude noun takes; see the `magnitudeForms` note in telugu.jsonc.
 *  Telugu is the consumer that needs all four slots of the shared `DravidianForms`. */
public sealed class TeluguNumbers : DravidianNumbersDef
{
    /**
     * ⚠ DECLARED BECAUSE THE MANIFEST DECLARES IT, AND READ BY NOTHING. `dravidianNumberWords` composes
     * from `magnitudeForms` — the four agreeing forms — and never touches this flat table; a grep for it
     * in the composer returns zero. It is in telugu.jsonc (and kannada.jsonc) because the TypeScript's
     * `TeluguNumbers extends NumbersDef`, and `NumbersDef.magnitudes` is REQUIRED by that interface, so
     * the data file has to carry it whether or not the Dravidian path consults it.
     *
     * The C# `DravidianNumbersDef` does not extend `NumbersDef`, so nothing forces the field here — it is
     * declared anyway, so the manifest key has a property that consumes it and `ManifestMappingTests`
     * stays strict. Removing the key from the data would be the other fix, but it would break the TS
     * type, so the two engines keep the same shape and the redundancy is written down instead.
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
