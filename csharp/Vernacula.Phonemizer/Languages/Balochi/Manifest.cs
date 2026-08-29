/**
 * Loads the Balochi (bal) data manifest (balochi.jsonc) once and exposes it typed. DATA only; the
 * algorithms stay in code. The TS declares `BalochiDef` inline in balochi.ts, so C# names the whole
 * shape here.
 * Ported from src/languages/balochi/balochi.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Balochi;

/** The ROMAN half of the g2p — a phonemic orthography that resolves to full IPA on its own. */
public sealed class BalochiRomanDef
{
    public string[] VowelLetters = [];
    public IReadOnlyDictionary<string, string> Long { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Short { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Retroflex { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Postalveolar { get; init; } = new Dictionary<string, string>();
}

/** Balochi numbers: the shared schema (lakh/crore magnitudes, arab at 10^9) + the enclitic connective. */
public sealed class BalochiNumbersDef : NumbersDef
{
    /** IPA of the enclitic connective -u (J&K bīst-u-yak); appended after the preceding word is phonemized. */
    public string ConnectiveIpa = "";
}

public sealed class BalochiDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public string[] VowelLetters = [];
    public IReadOnlyDictionary<string, string> Harakat { get; init; } = new Dictionary<string, string>();
    public string Sukun = "";
    public string Shadda = "";
    public BalochiRomanDef Roman { get; init; } = new();
    public BalochiNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly BalochiDef DEF = LoadManifest.Load<BalochiDef>("languages/balochi", "balochi.jsonc");
}
