/**
 * Loads the Welsh data manifest (welsh.jsonc) once and exposes it typed. The hand-authored DATA
 * (digraph + consonant maps, vowel-cluster lookup, length sets, obscure-y clitics, number words) lives in
 * the JSONC; the ALGORITHMS (G2p.cs, Welsh.cs, Numbers.cs) read it.
 *
 * Ported from src/languages/welsh/manifest.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Welsh;

public sealed record WelshNumbers
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
}

public sealed record WelshDef
{
    /** Digraphs (ch dd ff ng ll ph rh th) — resolved before single letters. */
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    /** Word-initial nasal mutation (treiglad trwynol). */
    public IReadOnlyDictionary<string, string> NasalMutation { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    /**
     * Vowel-cluster → IPA. ⚠ THE INSERTION ORDER IS LOAD-BEARING: G2p sorts these keys longest-first with a
     * STABLE sort, exactly as the TS's `Object.keys(...).sort((a, b) => b.length - a.length)` does, so two
     * keys of equal length keep the order the JSONC writes them in.
     */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    /** Short-quality → long-quality (lengthening raises/tenses). */
    public IReadOnlyDictionary<string, string> LongVowel { get; init; } = new Dictionary<string, string>();
    /** A single coda consonant from this set gives a long/tense context. */
    public string LengthenBefore { get; init; } = "";
    /** Function-word clitics where ⟨y⟩ stays obscure (ə). */
    public IReadOnlyList<string> ObscureY { get; init; } = Array.Empty<string>();
    /** Irregular function words, consulted before the rules. */
    public IReadOnlyDictionary<string, string> Exceptions { get; init; } = new Dictionary<string, string>();
    /** Apostrophe-contracted enclitics (o'r, hi'n). */
    public IReadOnlyDictionary<string, string> Enclitics { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public WelshNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Welsh data tables (see welsh.jsonc). */
    public static readonly WelshDef MANIFEST = LoadManifest.Load<WelshDef>("languages/welsh", "welsh.jsonc");
}
