/**
 * #1551: Polish ą/ę before a dental or retroflex fricative is the [w̃] glide. Ported from test/polish-1551.test.ts;
 * the expectations were derived by running the fixed TypeScript engine, never typed.
 */
using PolishEngine = Vernacula.Phonemizer.Languages.Polish.PolishPhonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class Polish1551Tests
{
    [Theory]
    [InlineData("wąs", "vˈɔw̃s")]
    [InlineData("język", "jˈɛw̃zɨk")]
    [InlineData("mąż", "mˈɔw̃ʂ")] // ż devoiced word-finally
    [InlineData("węże", "vˈɛw̃ʐɛ")]
    [InlineData("mięso", "mjˈɛw̃sɔ")]
    public void NasalBeforeADentalOrRetroflexFricativeIsTheGlide(string word, string ipa) =>
        Assert.Equal(ipa, PolishEngine.PhonemizeWord(word));

    [Theory]
    [InlineData("wąchać", "vˈɔŋxat͡ɕ")]
    [InlineData("ręce", "rˈɛnt͡sɛ")]
    [InlineData("kąt", "kˈɔnt")]
    [InlineData("gęś", "ɡˈɛw̃ɕ")] // the soft fricative was already [w̃]
    public void StopsAffricatesAndTheVelarKeepTheirNasal(string word, string ipa) =>
        Assert.Equal(ipa, PolishEngine.PhonemizeWord(word));
}
