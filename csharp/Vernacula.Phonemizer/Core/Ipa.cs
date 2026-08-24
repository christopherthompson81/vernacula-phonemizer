/**
 * The universal IPA phone classes — notation constants, NOT per-language data.
 * Ported from src/core/ipa.ts — see that file for the corpus evidence.
 */
namespace Vernacula.Phonemizer.Core;

public static class Ipa
{
    /**
     * The vowel letters as a STRING, so it can go straight into a regex character class.
     *
     * ⚠ THIS IS ALSO THE STRESS-NUCLEUS CLASS — Core/WeightStress.cs builds its VOWEL regex from it, so a
     * letter missing here is a syllable the weight rule cannot see, and a word whose every vowel is
     * invisible gets NO STRESS AT ALL. Anything added here must be a genuine vowel LETTER; length, stress
     * and tone marks attach to a vowel and are not one.
     */
    public const string IPA_VOWELS = "əaeiouɪʊɛɔɐæyøɘɤʌɯɵœɜɞʉɨɶɑɒʏ";

    /** The same class as a set, for the per-segment "is this a vowel?" tests the engines do. */
    public static readonly IReadOnlySet<string> IPA_VOWEL =
        new HashSet<string>(Js.CodePoints(IPA_VOWELS));
}
