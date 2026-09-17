/**
 * The flap needs the vowel after it UNSTRESSED — the dictionary's own stress digit.
 * Ported from test/english-reported-misreadings.test.ts.
 *
 * The guard was `!= 1`, which admits stress 2, and the prose had been rewritten to match it ("a
 * NON-primary vowel") so the rule documented the code rather than the `V_V0` context it was mined
 * from. Against misaki's us_gold — what Kokoro was trained on — over 80,222 words: a flap
 * immediately before a secondary-stress mark 1,112 times to gold's 47, agreeing on 0.4%. After: 5.
 * Whole-word exact 41.10% → 41.63%; flap errors 2,214 → 1,290.
 *
 * ⚠ THE FIRST TWO CASES DRIVE THE CONVERTER DIRECTLY, NOT Phonemize. `thirty` is a flat-lexicon hit,
 * so a Phonemize assertion pins the RECORDED IPA and passes with the rule reverted — the split
 * tools/english/en_rebuild_lexicon.mts exists to warn about. Both paths are asserted, separately.
 */
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishFlapStressTests
{
    private static string Say(string phones, string word)
        => EnglishArpabet.MakeArpabetToIpa(Manifest.MANIFEST.Arpabet)(phones.Split(' '), word);

    /// <summary>A 2° blocks the flap — that syllable takes a real onset.</summary>
    [Theory]
    [InlineData("AE1 S AH0 T EY2 T", "acetate", "ˈæsətʰˌeᶦt")]
    [InlineData("AE1 S AH0 T OW2 N", "acetone", "ˈæsətʰˌoᶷn")]
    // ⚠ WAS the synthetic ("TH ER1 D IY2", "thirty"). `DemoteFinalIy2` fires on a `-y` SPELLING, so
    // that case no longer reaches this branch; `manatee` is a real final-IY2 row that does, and gold
    // confirms it (`mˈænətˌi` — 2° kept, t unflapped). Mirrors english-reported-misreadings.test.ts.
    [InlineData("M AE1 N AH0 T IY2", "manatee", "mˈænətʰˌiː")]
    public void ASecondaryStressBlocksTheFlap(string phones, string word, string expected)
        => Assert.Equal(expected, Say(phones, word));

    /// <summary>Stress 0 flaps.</summary>
    [Theory]
    [InlineData("TH ER1 D IY0", "thirty", "θˈɝd̬i")]
    [InlineData("F AO1 R T IY0", "forty", "fˈɔːɹt̬i")]
    [InlineData("S IH1 T IY0", "city", "sˈɪt̬i")]
    public void StressZeroFlaps(string phones, string word, string expected)
        => Assert.Equal(expected, Say(phones, word));

    /// <summary>
    /// ⚠ `thirty` WAS THE ONE DECADE WRITTEN IY2 — twenty, forty, fifty, sixty, seventy, eighty and
    /// ninety are all IY0, and gold says θˈɜɹɾi. A bad dictionary row, fixed in g2p-dict.tsv rather
    /// than by bending the flap rule around it. (twenty is not a flap case at all: its t follows N.)
    /// </summary>
    [Theory]
    [InlineData("thirty", "θˈɝd̬i")]
    [InlineData("forty", "fˈɔːɹt̬i")]
    [InlineData("twenty", "twˈɛnti")]
    public void TheDecadesAgreeWithEachOther(string word, string expected)
        => Assert.Equal(expected, Phonemizer.Phonemize(word, "en"));
}
