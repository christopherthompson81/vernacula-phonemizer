/**
 * Two Italian defects the Rust port found by reading (#1463), fixed TS-first.
 * Ported from test/italian-port-findings.test.ts — see that file for the account.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Italian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ItalianPortFindingsTests
{
    private static string Word(string w) => ItalianPhonemizer.PhonemizeWord(w);
    private static string Say(string s) => Phonemizer.Phonemize(s, "it");

    [Fact]
    public void AWordFinalSAfterAVowelStaysVoiceless()
    {
        Assert.Equal("ɡˈas", Word("gas"));
        Assert.Equal("awtˈobus", Word("autobus"));
        Assert.Equal("vˈirus", Word("virus"));
        Assert.Equal("lˈapis", Word("lapis"));
        Assert.Equal("ˈil ɡˈas", Say("il gas"));
        // intervocalic voicing is untouched
        Assert.Equal("kˈaza", Word("casa"));
        Assert.Equal("rˈoza", Word("rosa"));
    }

    [Fact]
    public void AWordFinalGnDoesNotGeminateAndAFinalQuTakesNoGlide()
    {
        Assert.Equal("mˈaɲ", Word("magn"));
        Assert.Equal("mˈaɲɲo", Word("magno"));
        Assert.Equal("kˈu", Word("qu"));
        Assert.Equal("kwˈando", Word("quando"));
    }

    [Fact]
    public void TheEsimoFamilyIsStressedOnTheSuffixE()
    {
        Assert.Equal("ventunˈezimo", Word("ventunesimo"));
        Assert.Equal("kristjanˈezimo", Word("cristianesimo"));
        Assert.Equal("medˈezimo", Word("medesimo"));
    }

    [Fact]
    public void GeneratedOrdinalsTakeTheEsimoStress()
    {
        Assert.Equal("ˈil ventunˈezimo sekˈolo", Say("il XXI secolo"));
        Assert.Equal("pˈapa d͡ʒovˈanni ventitreˈezimo", Say("papa Giovanni XXIII"));
        Assert.Equal("ˈil tremillˈezimo anniversˈarjo", Say("il MMM anniversario"));
        Assert.Equal("ˈil ventunˈezimo ɡˈol", Say("il 21° gol"));
        Assert.Equal("lˈa ventunˈezima vˈolta", Say("la 21ª volta"));
        Assert.Equal("trˈe ventˈezimi", Say("3/20"));
    }
}
