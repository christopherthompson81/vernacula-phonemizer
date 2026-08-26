/**
 * Azerbaijani Roman-numeral reading — ORDINAL. `XIX əsr` is *on doqquzuncu əsr*; the orthography writes no
 * suffix after a Roman numeral, so the numeral IS the ordinal writing.
 * Ported from src/languages/azerbaijani/romanOrdinals.ts — see that file for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Azerbaijani;

public static class RomanOrdinals
{
    private static AzerbaijaniNumbersDef N => Manifest.MANIFEST.Numbers;

    private const string VOWELS = "aıeəiouöü";

    /** Four-way harmony class of a stem, from its LAST vowel. */
    private static readonly IReadOnlyDictionary<string, string> HARMONY = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "ı", ["ı"] = "ı", ["e"] = "i", ["ə"] = "i", ["i"] = "i",
        ["o"] = "u", ["u"] = "u", ["ö"] = "ü", ["ü"] = "ü",
    };
    private static readonly IReadOnlyDictionary<string, string> SUFFIX = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ı"] = "ncı", ["i"] = "nci", ["u"] = "ncu", ["ü"] = "ncü",
    };

    /** Cardinal stem → ordinal: doqquz → doqquzuncu, iyirmi → iyirminci, yüz → yüzüncü. */
    private static string? Suffixed(string stem)
    {
        string? cls = null;
        foreach (var ch in Js.CodePoints(stem))
            if (HARMONY.TryGetValue(ch, out var h)) cls = h; // last vowel wins
        if (cls is null) return null;
        var linking = VOWELS.Contains(stem[^1]) ? "" : cls;
        return $"{stem}{linking}{SUFFIX[cls]}";
    }

    /** Integer → Azerbaijani ordinal. `null` above 100 falls back to the cardinal. */
    public static string? Ordinal(int n)
    {
        if (n < 1 || n > 100) return null;
        if (n == 100) return Suffixed(N.Hundred);
        if (n < 10) return Suffixed(N.Ones[n]);
        int t = n / 10, u = n % 10;
        var tens = N.Tens[t];
        return u == 0 ? Suffixed(tens) : $"{tens} {Suffixed(N.Ones[u])}";
    }

    /** Agglutinative, so unanchored at the end: `əsr` also matches əsrdə, əsrin, əsri, əsrlər, əsrdən. */
    private static readonly JsRe CONTEXT =
        JsRegex.Compile("^(əsr|yüzil|minillik|ildönüm|konqres|sinif)", "iu");

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
