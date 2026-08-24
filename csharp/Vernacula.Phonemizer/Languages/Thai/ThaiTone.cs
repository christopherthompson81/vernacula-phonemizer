/**
 * Thai tone computation — from Wiktionary Module:th-pron (CC-BY-SA, tone facts as provenance).
 * The tone is a deterministic function of initial-consonant CLASS ×
 * syllable LIFE × vowel LENGTH × any tone mark (the "tone triangle").
 */
namespace Vernacula.Phonemizer.Languages.Thai;

/**
 * ⚠ THE THREE TS STRING-UNION TYPES ARE PLAIN `string` HERE. `ThaiConsonantClass` ("mid"|"high"|"low"),
 * `ThaiTone` ("mid"|"low"|"falling"|"high"|"rising") and `ThaiToneMark` (the four marks plus the
 * respelling macron) are all manifest KEYS and manifest VALUES — they arrive from thai.jsonc as strings
 * and are used to index dictionaries loaded from it. Modelling them as C# enums would mean a converter on
 * every one of those tables and a mapping that could drift from the data; the TS gets its checking for
 * free from the literal types and C# cannot. The tables are asserted whole by ManifestMappingTests.
 */
public static class ThaiTone
{
    // The tone tables are DATA (thai.jsonc → tone). THAI_CLASS: consonant → tonal class (9 mid, 11 high, 24 low);
    // TONE_FROM_MARK: mark × class; TONE_NO_MARK: (life+length) × class; THAI_TONE_IPA: tone → Chao letters.
    private static IReadOnlyDictionary<string, string> THAI_CLASS => Manifest.MANIFEST.Tone.Class;
    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> TONE_FROM_MARK => Manifest.MANIFEST.Tone.FromMark;
    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> TONE_NO_MARK => Manifest.MANIFEST.Tone.NoMark;

    /** IPA tone-contour letters per tone (th-pron `tLevels`). */
    public static IReadOnlyDictionary<string, string> THAI_TONE_IPA => Manifest.MANIFEST.Tone.Ipa;

    /** Tonal class of a Thai initial consonant, or undefined if not a consonant. */
    public static string? ThaiConsonantClass(string consonant) => THAI_CLASS.GetValueOrDefault(consonant);

    /**
     * The EFFECTIVE tonal class of a syllable initial, applying the leading-consonant
     * raise — the single most error-prone step when computing Thai tone:
     *  - a silent leading ห raises a following sonorant (low class) to HIGH (หมา → rising);
     *  - a silent leading อ in the four อย words (อย่า อยาก อยู่ อย่าง) makes ย behave MID.
     * Pass the base initial plus the silent leader (if any — the syllable parser
     * identifies it). Centralising this here means `computeThaiTone` callers can't forget
     * the raise: they ask THIS for the class. Returns undefined if `initial` isn't a consonant.
     */
    public static string? ThaiEffectiveClass(string initial, string? silentLeader = null)
    {
        if (ThaiConsonantClass(initial) is null) return null;
        if (silentLeader == "ห") return "high"; // ห is high class; it governs the syllable's tone
        if (silentLeader == "อ") return "mid"; //  อ is mid class (the อย words)
        return ThaiConsonantClass(initial);
    }

    /**
     * Compute the lexical tone of a Thai syllable.
     *  - `consonantClass`: the EFFECTIVE class of the initial — use `thaiEffectiveClass`
     *    so a silent ห/อ leader is applied (passing the raw low class of e.g. ม in หมา
     *    yields the wrong tone).
     *  - `life`: "live" (sonorant/open-long coda, or a live-exception vowel) or "dead"
     *    (stop coda, or open-short).
     *  - `length`: vowel length. NOTE it is IGNORED for live syllables (mirrors th-pron's
     *    single `live` key) — the caller may pass the measured length unconditionally.
     *  - `mark`: the syllable's single tone mark, if any (it overrides life/length). The
     *    caller must reject syllables with >1 tone mark upstream (th-pron returns nil on
     *    `[่้๊๋̄].?[่้๊๋̄]`); this takes one already-resolved mark.
     */
    public static string ComputeThaiTone(string consonantClass, string life, string length, string? mark = null)
    {
        if (!string.IsNullOrEmpty(mark)) return TONE_FROM_MARK[mark][consonantClass];
        var key = life == "live" ? "live" : $"dead-{length}";
        return TONE_NO_MARK[key][consonantClass];
    }
}
