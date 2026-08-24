/**
 * Thai tone computation — from Wiktionary Module:th-pron (CC-BY-SA, tone facts as provenance).
 * Ported from src/languages/thai/thaiTone.ts — see that file for the corpus evidence.
 */
namespace Vernacula.Phonemizer.Languages.Thai;

/**
 * ⚠ THE THREE TS STRING-UNION TYPES ARE PLAIN `string` HERE. `ThaiConsonantClass`, `ThaiTone` and
 * `ThaiToneMark` are manifest KEYS and VALUES: they arrive from thai.jsonc as strings and are used to
 * index dictionaries loaded from it. Enums would mean a converter on every table and a mapping that
 * could drift from the data.
 */
public static class ThaiTone
{
    private static IReadOnlyDictionary<string, string> THAI_CLASS => Manifest.MANIFEST.Tone.Class;
    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> TONE_FROM_MARK => Manifest.MANIFEST.Tone.FromMark;
    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> TONE_NO_MARK => Manifest.MANIFEST.Tone.NoMark;

    /** IPA tone-contour letters per tone (th-pron `tLevels`). */
    public static IReadOnlyDictionary<string, string> THAI_TONE_IPA => Manifest.MANIFEST.Tone.Ipa;

    /** Tonal class of a Thai initial consonant, or undefined if not a consonant. */
    public static string? ThaiConsonantClass(string consonant) => THAI_CLASS.GetValueOrDefault(consonant);

    /**
     * The EFFECTIVE tonal class of a syllable initial, applying the leading-consonant raise (a silent ห
     * raises a following sonorant to HIGH; a silent อ in the อย words makes ย behave MID).
     */
    public static string? ThaiEffectiveClass(string initial, string? silentLeader = null)
    {
        if (ThaiConsonantClass(initial) is null) return null;
        if (silentLeader == "ห") return "high"; // ห is high class; it governs the syllable's tone
        if (silentLeader == "อ") return "mid"; //  อ is mid class (the อย words)
        return ThaiConsonantClass(initial);
    }

    /** Compute the lexical tone of a Thai syllable. */
    public static string ComputeThaiTone(string consonantClass, string life, string length, string? mark = null)
    {
        if (!string.IsNullOrEmpty(mark)) return TONE_FROM_MARK[mark][consonantClass];
        var key = life == "live" ? "live" : $"dead-{length}";
        return TONE_NO_MARK[key][consonantClass];
    }
}
