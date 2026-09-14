/**
 * Two reported misreadings — `in situ` and abbreviated `max`.
 * Ported from test/english-reported-misreadings.test.ts; the diagnosis is in
 * docs/investigations/en/en_reported_misreadings_investigation.md.
 *
 * ⚠ THE EXPECTED STRINGS ARE THE TYPESCRIPT'S, VERBATIM.
 */
using System.IO;
using System.Linq;
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

    [Theory]
    [InlineData("CH₄", "sˈiː ˈeᶦt͡ʃ fˈɔːɹ")]
    [InlineData("N₂ and CH₄", "ˈɛn tʰˈuː ənd sˈiː ˈeᶦt͡ʃ fˈɔːɹ")]
    [InlineData("x²", "ˈɛks skwˈɛɹd")]
    public void SubscriptDigitsRead(string text, string ipa) => Assert.Equal(ipa, Say(text));

    // ⚠ EVERY ported language, not a sample — see the TS test for why the first, tier-by-tier
    // attempt looked like full coverage and reached only 151 of 189.
    [Fact]
    public void EveryLanguageReadsASubscriptLikeItsAsciiSpelling()
    {
        var dir = AppContext.BaseDirectory;
        while (dir is not null && !Directory.Exists(Path.Combine(dir, "goldens")))
            dir = Path.GetDirectoryName(dir);
        Assert.NotNull(dir);
        var langs = Directory.EnumerateFiles(Path.Combine(dir!, "goldens"), "*.tsv")
            .Select(Path.GetFileNameWithoutExtension).Where(l => l is not null).Select(l => l!)
            .Order(StringComparer.Ordinal).ToList();
        Assert.True(langs.Count > 180, $"only {langs.Count} languages enumerated");
        var differ = langs.Where(l =>
            Phonemizer.Phonemize("CH₄", l) != Phonemizer.Phonemize("CH4", l)).ToList();
        Assert.Empty(differ);
    }

    [Theory]
    [InlineData("It rained, and it was cold.", "ɪt ɹˈeᶦnd , ˈænd ɪt wʌz kʰˈoᶷɫd .")]
    [InlineData("And then we left.", "ˈænd ðˈɛn wiː lˈɛft .")]
    [InlineData("dogs and cats", "dˈɑːɡz ənd kʰˈæts")]
    [InlineData("he and I", "hiː ənd ˈaᶦ")]
    [InlineData("The man arrived, the woman left.", "ðə mˈæn ɚˈaᶦvd , ðə wˈʊmən lˈɛft .")]
    [InlineData(", and it was", "ˈænd ɪt wˈʌz")]
    [InlineData("Coffee, tea, or water.", "kʰˈɑːfi , tʰˈiː , ɔːɹ wˈɔːt̬ɚ .")]
    public void AClauseInitialCoordinatorTakesItsStrongForm(string text, string ipa)
        => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("profile", "pɹˈoᶷfˌaᶦɫ")]
    [InlineData("textile", "tʰˈɛkstˌaᶦɫ")]
    [InlineData("skylines", "skˈaᶦlˌaᶦnz")]
    [InlineData("zeitgeist", "tsˈaᶦtɡˌaᶦst")]
    // …and the guards: OW/EY are not true diphthongs here, and an open final syllable is excluded.
    [InlineData("zorro", "zˈɔːɹoᶷ")]
    [InlineData("window", "wˈɪndoᶷ")]
    [InlineData("airplane", "ˈɛɹpleᶦn")]
    [InlineData("crocodile", "kɹˈɑːkəd̬ˌaᶦɫ")]
    [InlineData("compile", "kəmpˈaᶦɫ")]
    public void AClosedFinalSyllableOnATrueDiphthongKeepsItsSecondaryStress(string w, string ipa)
        => Assert.Equal(ipa, Say(w));
}
