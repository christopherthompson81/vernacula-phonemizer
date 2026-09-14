/**
 * Two reported misreadings — `in situ` and abbreviated `max`.
 * Ported from test/english-reported-misreadings.test.ts; the diagnosis is in
 * docs/investigations/en/en_reported_misreadings_investigation.md.
 *
 * ⚠ THE EXPECTED STRINGS ARE THE TYPESCRIPT'S, VERBATIM.
 */
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishReportedMisreadingsTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    [Theory]
    [InlineData("en", "ɪn sˈɪt͡ʃuː")]
    [InlineData("en-GB", "ɪn sˈɪt͡ʃuː")]
    public void InSitu(string lang, string ipa)
        => Assert.Equal(ipa, Phonemizer.Phonemize("in situ", lang));

    [Theory]
    [InlineData("max 40 characters", "mˈæksəməm fˈɔːɹt̬i kʰˈæɹəktɚz")]
    [InlineData("a max of 40", "ə mˈæksəməm ʌv fˈɔːɹt̬i")]
    [InlineData("to the max", "tʰuː ðə mˈæksəməm")]
    [InlineData("max. 40", "mˈæksəməm fˈɔːɹt̬i")]
    [InlineData("the max. is 40", "ðə mˈæksəməm ɪz fˈɔːɹt̬i")]
    public void MaxExpandsToMaximum(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("Max went home", "mˈæks wˈɛnt hˈoᶷm")]
    [InlineData("Max.", "mˈæks .")]
    [InlineData("max out the budget", "mˈæks ˈaᶷt ðə bˈʌd͡ʒɪt")]
    [InlineData("max it out", "mˈæks ɪt ˈaᶷt")]
    [InlineData("maxed out", "mˈækst ˈaᶷt")]
    public void TheNameAndTheVerbAreLeftAlone(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("IR spectroscopy", "ˌɪnfɹɚˈɛd spɛktɹˈɑːskəpi")]
    [InlineData("UV and IR light", "jˈuːvˈiː ənd ˌɪnfɹɚˈɛd lˈaᶦt")]
    [InlineData("Ir", "ˈɪɹ")]
    public void IrReadsAsInfraredAndOnlyInThatExactCasing(string text, string ipa)
        => Assert.Equal(ipa, Say(text));
}
