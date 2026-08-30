/**
 * Loads the K'iche' data manifest (kiche.jsonc) once and exposes it typed.
 *
 * K'iche' (Qatzijob'al) is the largest MAYAN language (~1.1M, Guatemala), written in the ALMG
 * (Academia de Lenguas Mayas de Guatemala) orthography, which is near-1:1 phonemic: the Mayan
 * hallmark is the EJECTIVE/glottalized series ⟨b'⟩→[ɓ] (implosive), ⟨t'⟩→[tʼ], ⟨k'⟩→[kʼ], ⟨q'⟩→[qʼ],
 * ⟨tz'⟩→[t͡sʼ], ⟨ch'⟩→[t͡ʃʼ] contrasting with the ASPIRATED plain stops ⟨p t k q tz ch⟩→[pʰ tʰ kʰ qʰ
 * t͡sʰ t͡ʃʰ]. The two tables below therefore carry almost the whole g2p; only the apostrophe-glyph
 * normalisation, the multi-word split and the FINAL stress are contextual, and they live in Kiche.cs.
 *
 * Ported from src/languages/kiche/kiche.ts's `KicheDef` — see kiche.jsonc for the single-source note.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kiche;

public sealed record KicheDef
{
    /** Multi-char units, longest-match first: the glottalized series (C + ʼ), then the plain aspirated
     *  affricates. The apostrophe glyphs (' ’ `) are normalised to ʼ before matching (Kiche.cs). */
    public IReadOnlyDictionary<string, string> Units { get; init; } = new Dictionary<string, string>();

    /** Single letters. Plain voiceless stops are ASPIRATED; ⟨b⟩ is the implosive [ɓ]; the accent/
     *  diaeresis vowels fold to the base vowel; the Spanish-loan consonants are kept, not dropped. */
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly KicheDef MANIFEST = LoadManifest.Load<KicheDef>("languages/kiche", "kiche.jsonc");
}
