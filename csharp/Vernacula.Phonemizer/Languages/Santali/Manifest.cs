/**
 * Loads the Santali data manifest (santali.jsonc) once and exposes it typed: the Ol Chiki letter → IPA
 * table and the three sign-driven substitution tables.
 *
 * Santali (ᱥᱟᱱᱛᱟᱲᱤ) is Munda (Austroasiatic), written in OL CHIKI (U+1C50–1C7F) — a distinct ALPHABET,
 * not an abugida, which is why every sign here is `\p{L}` and nothing decomposes. The sign rules
 * themselves are code, in Santali.cs.
 *
 * Ported from src/languages/santali/santali.ts's `SantaliDef` — see santali.jsonc for the
 * thin-attestation caveat.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Santali;

public sealed record SantaliDef
{
    /** Ol Chiki letter → IPA. Vowels + consonants; ⟨ᱶ OV⟩ is the NASAL labial glide /w̃/. */
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();

    /** The VOICED stops only — the half the word-final checking rule applies to. */
    public IReadOnlyList<string> VoicedStops { get; init; } = [];

    /** A checked (glottalized) stop: devoice + a glottal release ⟨ʼ⟩ (ɡ→kʼ, d→tʼ …). */
    public IReadOnlyDictionary<string, string> Checked { get; init; } = new Dictionary<string, string>();

    /** Aspiration by ⟨ᱷ OH⟩: voiceless → ʰ, voiced → breathy ʱ. */
    public IReadOnlyDictionary<string, string> Aspirated { get; init; } = new Dictionary<string, string>();

    /** ⟨ᱹ GAAHLAA⟩ vowel modification — the "extra" Santali vowels (chiefly a→ə). */
    public IReadOnlyDictionary<string, string> Gahla { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly SantaliDef DEF = LoadManifest.Load<SantaliDef>("languages/santali", "santali.jsonc");

    /** The voiced stops as a set — the word-final checking test. */
    public static readonly IReadOnlySet<string> VOICED_STOP =
        new HashSet<string>(DEF.VoicedStops, StringComparer.Ordinal);
}
