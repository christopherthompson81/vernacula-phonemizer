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
    public void TheEsimoFamilyAndSettimoDecimoTakeAnOpenAntepenultE()
    {
        Assert.Equal("ventunˈɛzimo", Word("ventunesimo"));
        Assert.Equal("kristjanˈɛzimo", Word("cristianesimo"));
        Assert.Equal("medˈɛzimo", Word("medesimo"));
        Assert.Equal("sˈɛttimo", Word("settimo"));
        Assert.Equal("dˈɛt͡ʃima", Word("decima"));
        Assert.Equal("dˈɛt͡ʃimi", Word("decimi"));
        // not the family: the bare verb form, and words that only begin like settim-/decim-
        Assert.Equal("ezˈimi", Word("esimi"));
        Assert.Equal("settimˈana", Word("settimana"));
        Assert.Equal("det͡ʃimˈetro", Word("decimetro"));
        Assert.Equal("prˈimo", Word("primo"));
    }

    [Fact]
    public void GeneratedOrdinalsTakeTheEsimoStress()
    {
        Assert.Equal("ˈil ventunˈɛzimo sekˈolo", Say("il XXI secolo"));
        Assert.Equal("pˈapa d͡ʒovˈanni ventitreˈɛzimo", Say("papa Giovanni XXIII"));
        Assert.Equal("ˈil tremillˈɛzimo anniversˈarjo", Say("il MMM anniversario"));
        Assert.Equal("ˈil ventunˈɛzimo ɡˈol", Say("il 21° gol"));
        Assert.Equal("lˈa ventunˈɛzima vˈolta", Say("la 21ª volta"));
        Assert.Equal("trˈe ventˈɛzimi", Say("3/20"));
        Assert.Equal("ˈil sˈɛttimo sekˈolo", Say("il VII secolo"));
        Assert.Equal("lˈa dˈɛt͡ʃima armˈata", Say("la 10ª Armata"));
        Assert.Equal("trˈe dˈɛt͡ʃimi", Say("3/10"));
    }
}
