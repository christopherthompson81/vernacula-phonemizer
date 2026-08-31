/**
 * Loads the Papiamentu data manifest (papiamento.jsonc) once and exposes it typed.
 * Ported from the `PapiamentoDef` interface in src/languages/papiamento/papiamento.ts — see the
 * jsonc for the table's sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Papiamento;

public sealed record PapiamentoDef
{
    /** Multi-letter units ⟨ch sh dj zj⟩, scanned in declaration order. */
    public IReadOnlyList<IReadOnlyList<string>> Digraphs { get; init; } = Array.Empty<IReadOnlyList<string>>();

    /** Every letter that writes a vowel. Used for COUNTING, not scanning: to place an acute-marked
     *  stress the engine counts the vowel letters before the acute. */
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();

    /** Single graphemes — the plain and accented vowels plus the consonants. */
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();

    /** Nasalized counterparts for the word-final-⟨n⟩ rule. */
    public IReadOnlyDictionary<string, string> Nasalized { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly PapiamentoDef MANIFEST =
        LoadManifest.Load<PapiamentoDef>("languages/papiamento", "papiamento.jsonc");
}
