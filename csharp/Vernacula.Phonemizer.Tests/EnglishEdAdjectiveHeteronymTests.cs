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

    // ⚠ A following noun is not enough. NN + VBN + NN is a past-tense transitive verb with a bare-noun
    // object, not an attributive, and the first version of this rule read all three as the adjective.
    // The separating signal is the LEFT tag; sentence-initial counts as a noun-phrase head.
    [Fact]
    public void ABareNounObjectIsNotAnAttributive()
    {
        Assert.Equal("ðə pɹˈiːst blˈɛst bɹˈɛd ənd wˈaᶦn .", Say("The priest blessed bread and wine ."));
        Assert.Equal("ðə kʰˈæptn̩ kʰˈɝst stˈɔːɹmz æt sˈiː .", Say("The captain cursed storms at sea ."));
        Assert.Equal("blˈɛsɪd ɹᵻlˈiːf kʰˈeᶦm .", Say("Blessed relief came ."));
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
        Assert.Equal("hiː ɹˈoᶷd ə mˈoᶷpɛd .", Say("He rode a moped ."));
        Assert.Equal("hiː mˈoᶷpt ɚˈaᶷnd .", Say("He moped around ."));
        // ⚠ The promotion must clear Verb, or an entry with a Verb slot never reaches its Adj.
        Assert.Equal("ðə mˈoᶷpɛd ɹˈaᶦd̬ɚ", Say("the moped rider"));
        // ⚠ `beloved` also needs a Noun slot: the plural path never consults Adj.
        Assert.Equal("maᶦ bᵻlˈʌvɪdz ˈɑːɹ hˈɪɹ .", Say("My beloveds are here ."));
    }

    [Fact]
    public void LearnedAndAgedAreLeftOnTheParticiple()
    {
        // ⚠ Deliberate: attributive position does not imply the adjective for these two.
        Assert.Equal("ə lˈɝnd pɹəfˈɛsɚ", Say("a learned professor"));
        Assert.Equal("æn ˈeᶦd͡ʒd mˈæn", Say("an aged man"));
    }
}

public class EnglishUsedToTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    /**
     * ⚠ `used to` IS THE ONLY HETERONYM WITH A FOLLOWING-WORD CONDITION, and both ports read the SAME
     * manifest field, so this is the C# half of a contract the parity golden cannot see — `used to` is
     * in no golden row. Measured over the 101 `used to` tokens in the UD English treebanks with this
     * tagger: 41% today, 59% for a flat bigram, 81% for VBD alone, 86% for what shipped. The 14-token
     * residue is named in the TypeScript test and pinned there AS WRONG. #1395.
     */
    [Fact]
    public void ReadsTheHabitualAsJuust()
    {
        Assert.Contains("j\u02c8u\u02d0st", Say("I used to walk there"));
        Assert.Contains("j\u02c8u\u02d0st", Say("a website I used to run"));
    }

    [Fact]
    public void ReadsBeUsedToGerundAsJuustViaTheNextTag()
    {
        // Here `used` is VBN and `to` is a PREPOSITION, not the infinitive marker — 10 of the 101.
        Assert.Contains("j\u02c8u\u02d0st", Say("He was used to walking briskly"));
        Assert.Contains("j\u02c8u\u02d0st", Say("Get used to using it yourself"));
    }

    [Fact]
    public void LeavesThePassiveAsJuuzd()
    {
        Assert.Contains("j\u02c8u\u02d0zd", Say("This date will be used to determine it"));
    }

    [Fact]
    public void DoesNotReadAcrossAClauseBoundary()
    {
        // ⚠ The word stream carries NO punctuation, so the next WORD may be a clause away. Unguarded,
        // both of these read /ju\u02d0st/ — the tagger cannot see the comma either, so it tags the bare
        // stream VBD IN and both halves of the condition pass. See the TypeScript.
        Assert.Contains("j\u02c8u\u02d0zd", Say("He used, to my surprise, a hammer."));
        Assert.Contains("j\u02c8u\u02d0zd", Say("I do not know which tool he used. To be fair, it worked."));
    }

    [Fact]
    public void LeavesAPlainPastAlone()
    {
        // ⚠ THE SLOT MUST BE CLEARED, NOT MERELY SET: `used` is VBD here too and the `past` slot exists
        // only for this condition, so an unconditional VBD would reach it.
        Assert.Contains("j\u02c8u\u02d0zd", Say("She used a hammer"));
        Assert.Contains("j\u02c8u\u02d0zd", Say("They used it yesterday"));
    }
}
