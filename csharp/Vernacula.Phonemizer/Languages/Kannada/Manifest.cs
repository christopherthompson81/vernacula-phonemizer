/**
 * Loads the Kannada data manifest (kannada.jsonc) once and exposes it typed. The manifest IS the
 * language data: the abugida definition read by the shared core/abugida.ts G2P, the clause punctuation,
 * and the cardinal number words including the fused 21-99 compounds, the irregular round hundreds and
 * the combining ("oblique") magnitude forms. The ALGORITHMS that read it stay in code — the G2P
 * post-pass (kannada.ts) and the number compositor (numbers.ts).
 *
 * Split out of kannada.ts so numbers.ts and normalize.ts can read the same single load.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kannada;

/** Kannada's numbers block: the shared Dravidian composer's data plus the decimal word. */
public sealed class KannadaNumbers : DravidianNumbersDef
{
    public string DecimalWord = "";
}

public sealed class KannadaManifest : AbugidaDef
{
    public KannadaNumbers Numbers { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
}

public static class Manifest
{
    public static readonly KannadaManifest MANIFEST =
        LoadManifest.Load<KannadaManifest>("languages/kannada", "kannada.jsonc");
}
