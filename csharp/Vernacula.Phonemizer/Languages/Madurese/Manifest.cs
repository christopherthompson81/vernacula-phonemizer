/**
 * The Madurese data manifest (madurese.jsonc), loaded once and exposed typed: consonant register classes,
 * the vowel + raising tables, final devoicing, clause punctuation and number words.
 * Ported from src/languages/madurese/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Madurese;

public sealed class MadureseNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public string Tens { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
    public string Trillion { get; init; } = "";
    public string And { get; init; } = "";
    public string DecimalWord { get; init; } = "";
}

public sealed class MadureseManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> RaiseCons { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LowCons { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> TranspCons { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string[]> VowelSpec { get; init; } = new Dictionary<string, string[]>();
    public IReadOnlyDictionary<string, string> FinalDevoice { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public MadureseNumbersDef Numbers { get; init; } = new();
}

/** TS `Reg` — the register class an orthographic consonant carries. */
public static class Reg
{
    public const string Raise = "raise";
    public const string Low = "low";
    public const string Transp = "transp";
}

public sealed class Cons
{
    public required string Ipa { get; init; }
    public required string RegClass { get; init; }
}

public static class Manifest
{
    public static readonly MadureseManifest MANIFEST =
        LoadManifest.Load<MadureseManifest>("languages/madurese", "madurese.jsonc");

    /** One orthography→(ipa, register) table; `CONS_KEYS` sorts it length-desc so digraphs beat letters. */
    public static readonly IReadOnlyDictionary<string, Cons> CONS = BuildCons();

    private static Dictionary<string, Cons> BuildCons()
    {
        // ⚠ INSERTION-ORDERED, like the JS Map it ports: the length-desc sort below is STABLE in both
        // engines, so same-length keys keep raise → low → transp declaration order.
        var m = new Dictionary<string, Cons>(StringComparer.Ordinal);
        foreach (var kv in MANIFEST.RaiseCons) m[kv.Key] = new Cons { Ipa = kv.Value, RegClass = Reg.Raise };
        foreach (var kv in MANIFEST.LowCons) m[kv.Key] = new Cons { Ipa = kv.Value, RegClass = Reg.Low };
        foreach (var kv in MANIFEST.TranspCons) m[kv.Key] = new Cons { Ipa = kv.Value, RegClass = Reg.Transp };
        return m;
    }

    public static readonly IReadOnlyList<string> CONS_KEYS =
        CONS.Keys.OrderByDescending(k => k.Length).ToList();

    public static readonly IReadOnlyList<string> VOWEL_KEYS =
        MANIFEST.VowelSpec.Keys.OrderByDescending(k => k.Length).ToList();
}
