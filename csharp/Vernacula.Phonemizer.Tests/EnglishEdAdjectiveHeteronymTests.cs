/**
 * The `-ed` adjective heteronyms in the C# twin. Ported from test/en-ed-adjective-heteronyms.test.ts.
 *
 * ⚠ THE PARITY GATE CANNOT SEE THESE. It compares the two engines over `csharp/goldens/`, whose 200
 * English rows contain none of `blessed`, `cursed`, `dogged`, `beloved`, `moped` or `accursed` in an
 * attributive frame — so a divergence in the VBN→adj promotion in `PosExpectations` would sit green.
 * These assertions are the only thing holding the C# side to the TS side for this behaviour.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishEdAdjectiveHeteronymTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    [Fact]
    public void AttributiveGivesTheSyllabicAdjective()
    {
        // ⚠ The tagger calls all of these VBN here, not JJ — the promotion rule is what makes the
        // `adj` slot reachable at all. Without it each of these returns the participle.
        Assert.Equal("ðə blˈɛsɪd ɹᵻlˈiːf", Say("the blessed relief"));
        Assert.Equal("ðə kʰˈɝsɪd θˈɪŋ", Say("the cursed thing"));
        Assert.Equal("hɪz dˈɔːɡɪd pɚsˈɪstəns", Say("his dogged persistence"));
        Assert.Equal("maᶦ bᵻlˈʌvɪd wˈaᶦf", Say("my beloved wife"));
    }

    [Fact]
    public void ElsewhereGivesTheParticiple()
    {
        Assert.Equal("hiː blˈɛst ðə kɹˈaᶷd .", Say("He blessed the crowd ."));
        Assert.Equal("hiː kʰˈɝst lˈaᶷdli .", Say("He cursed loudly ."));
        Assert.Equal("ðə ɹᵻpʰˈɔːɹt̬ɚ dˈɔːɡd hˈɪm .", Say("The reporter dogged him ."));
    }

    [Fact]
    public void AnOrdinaryParticipleBeforeANounIsUntouched()
    {
        // The promotion sets Adj on any VBN before a noun; only a word WITH an Adj slot can read it.
        Assert.Equal("ðə pʰˈeᶦntᵻd wˈɔːɫ", Say("the painted wall"));
        Assert.Equal("ə bɹˈoᶷkən pɹˈɑːməs", Say("a broken promise"));
    }

    [Fact]
    public void AccursedHasOneReadingAndMopedIsTheVehicle()
    {
        // `accursed` is not a heteronym — no live verb "to accurse" — so it is a dictionary fix.
        Assert.Equal("æn əkʰˈɝsɪd fˈeᶦt", Say("an accursed fate"));
        // `moped` is a NOUN CMUdict could not reach, not an -ed adjective.
        Assert.Equal("hiː ɹˈoᶷd ə mˈoᶷpʰˌɛd .", Say("He rode a moped ."));
        Assert.Equal("hiː mˈoᶷpt ɚˈaᶷnd .", Say("He moped around ."));
    }

    [Fact]
    public void LearnedAndAgedAreLeftOnTheParticiple()
    {
        // ⚠ Deliberate: attributive position does not imply the adjective for these two.
        Assert.Equal("ə lˈɝnd pɹəfˈɛsɚ", Say("a learned professor"));
        Assert.Equal("æn ˈeᶦd͡ʒd mˈæn", Say("an aged man"));
    }
}
