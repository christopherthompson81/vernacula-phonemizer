/**
 * English-native canonical converter: CMUdict ARPABET → canonical IPA (the en divestment convention).
 * Cleanroom GenAm allophony (flapping, aspiration, dark-l, offglides, weak-vowel ᵻ, reduction), before-
 * nucleus stress. This is the single source of truth for the en canonical convention: the compile-time
 * pronunciation-lexicon build (build-en-cmudict.ts) and the runtime OOV G2P (englishG2p.ts) both use it,
 * so dict words and G2P'd words share one convention with no seam.
 */
using System.Text;
using System.Text.Json.Serialization;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public sealed class ConditionalVowelPair
{
    public string Unstressed { get; init; } = "";
    public string Stressed { get; init; } = "";
}

public sealed class ConditionalVowelIy
{
    public string BeforeR { get; init; } = "";
    public string Unstressed { get; init; } = "";
    public string Stressed { get; init; } = "";
}

public sealed class ConditionalVowelUw
{
    public string BeforeR { get; init; } = "";
    public string Default { get; init; } = "";
}

public sealed class ConditionalVowels
{
    // ⚠ EXPLICIT JSON NAMES. The loader applies a camelCase naming policy, which does NOT leave an all-caps
    // ARPABET key alone — so `AH`/`ER`/`IY`/`UW` silently deserialized to their defaults and every vowel they
    // own came out as the EMPTY STRING: `virgin` read *vd͡ʒɪn* and `branson` *bɹˈænsn*, the nucleus simply
    // gone. Nothing threw; the tagger and the mask were byte-identical to Node's.
    [JsonPropertyName("AH")] public ConditionalVowelPair AH { get; init; } = new();
    [JsonPropertyName("ER")] public ConditionalVowelPair ER { get; init; } = new();
    [JsonPropertyName("IY")] public ConditionalVowelIy IY { get; init; } = new();
    [JsonPropertyName("UW")] public ConditionalVowelUw UW { get; init; } = new();
}

/** The ARPABET→IPA correspondence DATA (from english.jsonc's `arpabet` block). The allophony ALGORITHM
 *  below reads these values; a different English variety supplies its own `map` / `conditionalVowels`. */
public sealed class ArpabetDef
{
    /** ARPABET phone → IPA: consonants + simple (unconditional) vowels. */
    public IReadOnlyDictionary<string, string> Map { get; init; } = new Dictionary<string, string>();
    /** The ARPABET vowel bases (a fixed property of the notation) — used to locate nuclei. */
    public IReadOnlyList<string> Vowels { get; init; } = Array.Empty<string>();
    /** Vowels resolved by stress (AH, ER) or a following R (IY, UW). */
    public ConditionalVowels ConditionalVowels { get; init; } = new();
}

public static class EnglishArpabet
{
    private readonly record struct Phone(string Base, int Stress);

    private static readonly JsRe PHONE = JsRegex.Compile("^([A-Z]+)([0-2])?$");

    /** One CMUdict phone (e.g. "AH0", "T", "ER1") → {base, stress}. */
    private static Phone Split(string phone)
    {
        var m = PHONE.Match(phone);
        return new Phone(
            m.Success ? m.Groups[1].Value : phone,
            m.Success && m.Groups[2].Success && m.Groups[2].Value.Length > 0 ? int.Parse(m.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture) : -1);
    }

    private static readonly JsRe ED_ES = JsRegex.Compile("(ed|es)$");
    private static readonly JsRe ITY = JsRegex.Compile("(it|iti|ities|ety|ities)y?$");
    private static readonly JsRe IBLE = JsRegex.Compile("ibl[ey]?$");
    private static readonly JsRe LATINATE_PREFIX = JsRegex.Compile("^(be|de|re|se|pre)[^aeiouy]");

    /** Should this unstressed vowel-phone at index `vi` (nucleus number `ni`) surface as the weak vowel ᵻ?
     *  Cleanroom weak-vowel-merger rule from the WORD's morphology (public GenAm phonology). */
    private static bool IsBarredI(string word, IReadOnlyList<Phone> P, int vi, int ni, int nucleiCount)
    {
        var (bas, stress) = P[vi];
        if (stress > 0 || (bas != "IH" && bas != "AH")) return false;
        // -ed / -ted / -ded after an alveolar stop (started, wanted, united, decided → ᵻd)
        if (ED_ES.IsMatch(word)
            && ni == nucleiCount - 1
            && vi + 1 < P.Count
            && vi > 0
            && (P[vi - 1].Base == "T" || P[vi - 1].Base == "D"))
            return true;
        // -ity/-ety/-ities/-ility (university, quality, security → ᵻti); the vowel before the final -t- cluster
        if (ITY.IsMatch(word) && vi + 1 < P.Count && P[vi + 1].Base == "T")
            return true;
        // -ible (possible → ᵻbəl)
        if (IBLE.IsMatch(word) && vi + 1 < P.Count && P[vi + 1].Base == "B")
            return true;
        // Latinate reduced prefix be/de/re/se/pre + consonant (believe, decide, review, security → ᵻ)
        if (ni == 0 && LATINATE_PREFIX.IsMatch(word)) return true;
        return false;
    }

    /** Build the ARPABET→IPA converter from a correspondence def. The allophony (flap/aspirate/dark-l/ŋ/ʲ,
     *  stress marking, weak-vowel merger) is the shared engine; `def` supplies the variety-specific IPA values. */
    public static Func<IReadOnlyList<string>, string, string> MakeArpabetToIpa(ArpabetDef def)
    {
        var map = def.Map;
        var cv = def.ConditionalVowels;
        var VOWELS = new HashSet<string>(def.Vowels, StringComparer.Ordinal);

        /** Convert a CMUdict ARPABET phone list → canonical IPA (before-nucleus stress + cleanroom GenAm allophony). */
        return (phones, word) =>
        {
            word ??= "";
            var P = phones.Select(Split).ToList();
            var nucleiIdx = new List<int>();
            for (var i = 0; i < P.Count; i++) if (VOWELS.Contains(P[i].Base)) nucleiIdx.Add(i);
            var nucleusNum = new Dictionary<int, int>();
            for (var ni = 0; ni < nucleiIdx.Count; ni++) nucleusNum[nucleiIdx[ni]] = ni;
            var primaryNi = nucleiIdx.FindIndex(vi => P[vi].Stress == 1);
            var outSb = new StringBuilder();
            for (var i = 0; i < P.Count; i++)
            {
                var (bas, stress) = P[i];
                var nextIsR = i + 1 < P.Count && P[i + 1].Base == "R";
                var nextIsV = i + 1 < P.Count && VOWELS.Contains(P[i + 1].Base);
                if (VOWELS.Contains(bas))
                {
                    var ni = nucleusNum[i];
                    // Secondary-stress clash: drop a 2° whose syllable is ADJACENT (consecutive nucleus) to the 1°.
                    var mark = stress == 1 ? "ˈ" : stress == 2 ? "ˌ" : "";
                    if (stress == 2 && primaryNi >= 0 && Math.Abs(ni - primaryNi) == 1) mark = "";
                    outSb.Append(mark);
                    if (bas == "AH" && IsBarredI(word, P, i, ni, nucleiIdx.Count)) outSb.Append('ᵻ');
                    else if (bas == "IH" && IsBarredI(word, P, i, ni, nucleiIdx.Count)) outSb.Append('ᵻ');
                    else if (bas == "AH") outSb.Append(stress <= 0 ? cv.AH.Unstressed : cv.AH.Stressed);
                    else if (bas == "ER") outSb.Append(stress <= 0 ? cv.ER.Unstressed : cv.ER.Stressed);
                    else if (bas == "IY") outSb.Append(nextIsR ? cv.IY.BeforeR : stress <= 0 ? cv.IY.Unstressed : cv.IY.Stressed);
                    else if (bas == "UW") outSb.Append(nextIsR ? cv.UW.BeforeR : cv.UW.Default);
                    else outSb.Append(map.TryGetValue(bas, out var mv) ? mv : bas);
                    // ʲ-glide hiatus: a high front nucleus (i/iː) directly before another vowel inserts ʲ.
                    if (bas == "IY" && nextIsV) outSb.Append('ʲ');
                    continue;
                }
                if (bas == "N" && i + 1 < P.Count && (P[i + 1].Base == "K" || P[i + 1].Base == "G"))
                {
                    outSb.Append('ŋ');
                    continue;
                }
                // FLAP (mined t:V_V0=ɾ79 / d:V_V0=ɾ64): t/d intervocalic before a NON-primary vowel → voiced flap.
                if ((bas == "T" || bas == "D") && i > 0 && i + 1 < P.Count)
                {
                    var prev = P[i - 1];
                    var next = P[i + 1];
                    if ((VOWELS.Contains(prev.Base) || prev.Base == "R") && VOWELS.Contains(next.Base) && next.Stress != 1)
                    {
                        outSb.Append(bas == "T" ? "t̬" : "d̬");
                        continue;
                    }
                }
                // ASPIRATE (mined #_V1=ʰ~75, NOT after /s/): p/t/k at a syllable onset before a STRESSED vowel.
                if (bas == "P" || bas == "T" || bas == "K")
                {
                    var prevBase = i > 0 ? P[i - 1].Base : "#";
                    Phone? next = i + 1 < P.Count ? P[i + 1] : null;
                    var onset = i == 0 || VOWELS.Contains(prevBase); // word-initial or after a vowel (starts a syllable)
                    if (prevBase != "S" && onset && next is not null && VOWELS.Contains(next.Value.Base) && next.Value.Stress >= 1)
                    {
                        outSb.Append(bas == "P" ? "pʰ" : bas == "T" ? "tʰ" : "kʰ");
                        continue;
                    }
                }
                // DARK-L (mined coda l→ɫ): l is velarized in the coda (before a consonant or word-finally).
                if (bas == "L" && !(i + 1 < P.Count && VOWELS.Contains(P[i + 1].Base)))
                {
                    outSb.Append('ɫ');
                    continue;
                }
                outSb.Append(map.TryGetValue(bas, out var mv2) ? mv2 : bas);
            }
            return outSb.ToString();
        };
    }
}
