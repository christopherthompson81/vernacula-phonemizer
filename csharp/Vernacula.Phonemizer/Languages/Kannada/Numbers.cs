/**
 * Kannada cardinal number → words, Indian grouping (ಸಾವಿರ 10³ / ಲಕ್ಷ 10⁵ / ಕೋಟಿ 10⁷).
 *
 * THE COMPOSITION NOW LIVES IN `core/numbers.ts` as `dravidianNumberWords`, shared with Telugu and
 * Malayalam. This file is the Kannada-facing wrapper plus the ordinal morphology, which is not shared.
 *
 * WHY KANNADA CANNOT USE THE SHARED `indicNumberWords` COMPOSER — the reasons that motivated the private
 * composer this file used to carry, all three now expressed as data read by the Dravidian composer.
 * Measured over the kn_in FLEURS corpus (561 bare numerals): 73 two-digit non-round, 75 three-digit,
 * 146 in the 1000-2999 band.
 *
 *   1. FUSION. Kannada 21-99 is ONE word — ಇಪ್ಪತ್ತೊಂದು, not ಇಪ್ಪತ್ತು ಒಂದು. `indicNumberWords` has a
 *      `compound` map for exactly this and kannada.jsonc carries all 72 forms, so this reason alone
 *      would not need a different composer; the next two do.
 *   2. IRREGULAR ROUND HUNDREDS. 200 is ಇನ್ನೂರು, 300 ಮುನ್ನೂರು, 500 ಐನೂರು, 900 ಒಂಬೈನೂರು — fused and
 *      suppletive. `indicNumberWords` writes `units[h] + magnitudes.hundred` unconditionally, so it
 *      read 200 as ಎರಡು ನೂರು. `NumbersDef.hundreds` exists for the Western composer but
 *      `indicNumberWords` never reads it.
 *   3. COMBINING (oblique) MAGNITUDE FORMS. When a remainder follows, the magnitude takes -ಾ / -ದ:
 *      150 is ನೂರಾ ಐವತ್ತು and 1976 is ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು. `indicNumberWords` emits the bare
 *      noun in every position, so 1976 came out ಸಾವಿರ ಒಂಬತ್ತು ನೂರು ಎಪ್ಪತ್ತು ಆರು — five words where
 *      Kannada says three, with the wrong hundred and no linkage at all.
 *
 * The migration to the shared composer is BYTE-IDENTICAL over the kn_in corpus (0/1811 utterances
 * changed), which is the gate for lifting a local rule to a shared seam.
 *
 *
 * YEARS NEED NO SPECIAL RULE. Unlike Telugu (which reads 1976 as "nineteen hundred seventy-six" and had
 * to arbitrate that on audio), the ordinary Kannada cardinal already IS the year reading:
 * ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು. No kn_in audio is cached under corpus/audio_cache/data/, so no arbitration
 * was possible here in any case — see the report.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kannada;

public static class Numbers
{
    private static KannadaNumbers N => Manifest.MANIFEST.Numbers;

    /** The decimal separator word */
    public static string DECIMAL_WORD => N.DecimalWord;

    /** Non-negative integer → Kannada words, space-separated. */
    public static string NumberToWords(double n) =>
        string.Join(" ", Core.Numbers.DravidianNumberWords(n, N));

    /**
     * The ORDINAL stem of a cardinal word. Kannada forms an ordinal by attaching ನೇ (or ನೆಯ) to the LAST
     * word of the cardinal after dropping its final -ು, and writes it FUSED. Emitted apart, ನೇ reaches the
     * G2P as a stray syllable carrying its own primary stress, [nˈeː].
     *
     * The -ು → ∅ rule is not invented: this corpus writes the fused result for thirteen different cardinals
     * and every one is its cardinal minus the final -ು plus ನೇ. A word with no final -ು (ಸಾವಿರ, ಲಕ್ಷ) takes
     * the suffix directly.
     */
    public static string OrdinalStem(string word) =>
        word.EndsWith("ು", StringComparison.Ordinal) ? word[..^"ು".Length] : word;

    /** N + ನೇ, fused onto the final cardinal word (15ನೇ → ಹದಿನೈದನೇ, 20ನೇ → ಇಪ್ಪತ್ತನೇ). */
    public static string OrdinalToWords(double n, string suffix = "ನೇ")
    {
        var words = NumberToWords(n).Split(' ').ToList();
        var last = words.Count > 0 ? words[^1] : "";
        if (last == "") return "";
        words[^1] = $"{OrdinalStem(last)}{suffix}";
        return string.Join(" ", words);
    }
}
