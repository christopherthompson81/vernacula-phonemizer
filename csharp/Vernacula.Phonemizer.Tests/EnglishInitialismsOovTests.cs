/**
 * The two #1382 defects, in the C# twin. Ported from test/en-initialisms-oov.test.ts.
 *
 * ⚠ THE PARITY GATE CANNOT SEE THESE. It compares the two engines over `csharp/goldens/`, and that
 * corpus contains none of `abs`/`absent`/`blt`/`hdd`/`mphs` as an OOV word — so a divergence in
 * `IsLetterNameRow`, `IsElongation`, `SpellOutPhones` or the plural strip would sit green. These
 * assertions are the only thing holding the C# side to the TS side for this behaviour.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishInitialismsOovTests
{
    private static string Say(string w) => Phonemizer.Phonemize(w, "en");

    [Fact]
    public void AnInitialismRowIsNotACompoundPiece()
    {
        // 210 dictionary rows are an initialism spelled out (`abs` = EY1 B IY1 EH1 S). `absent` came
        // out "A-B-S-ent"; 287 dictionary words and 131 referee headwords decoded that way.
        Assert.DoesNotContain("eᶦt͡ʃ", Say("treacher"));
        Assert.Equal("flˈɪmf", Say("flymph"));
        // ⚠ The row itself is still right: the predicate rejects a PIECE, never a word.
        Assert.Equal("ˈeᶦbiːsˌiː", Say("abc"));
        Assert.Equal("ˌɛmpˌiːʲˈeᶦt͡ʃ", Say("mph"));
    }

    [Fact]
    public void AnInitialismsPluralStillDecodesThroughItsStem()
    {
        // ⚠ THE GUARD BELONGS TO THE PIECE SITE. Rejecting a letter-name STEM in MorphDecode also blocks
        // the one morphological thing initialisms do, and mis-fires on `ok` (= `OW1 K EY1`, ⟨o⟩+⟨k⟩).
        Assert.Equal("ˌɛmpˌiːʲˈeᶦt͡ʃɪz", Say("mphs"));
        Assert.Equal("ˌoᶷkʰˈeᶦz", Say("oks"));   // "okays", not "oaks"
    }

    [Fact]
    public void AReadingWithNoVowelNucleusIsSpelledOut()
    {
        Assert.Equal("bˌiːʲˌɛɫtˈiː", Say("blt"));
        Assert.Equal("ˌeᶦt͡ʃdˌiːdˈiː", Say("hdd"));
        Assert.Equal("sˌiːʲˌɛnˈɛn", Say("cnn"));
        // A trailing `s` is the PLURAL, not the letter ESS — and must agree with the clitic form.
        Assert.Equal("bˌiːʲˌɛɫtˈiːz", Say("blts"));
        Assert.Equal(Say("blt's"), Say("blts"));
    }

    [Fact]
    public void ConsonantInterjectionsAreNotSpelledOut()
    {
        // ⚠ THESE ARE DICTIONARY ROWS, which is what makes the net's premise ("every correct vowelless
        // word is recorded") true rather than nearly true. Without them `tsk` was "tee-ess-kay".
        Assert.Equal("tsk", Say("tsk"));
        Assert.Equal("bɹ", Say("brr"));
        Assert.Equal("hmf", Say("hmph"));
        // Elongation is exempt by rule; a DOUBLED final letter is not (`hdd`, `cnn` above).
        Assert.Equal("hm", Say("hmmmm"));
    }

    [Fact]
    public void AnInitialismGlossedAsItsExpansionReadsAsLetters()
        => Assert.Equal("ˌɛfwˌaᶦˈaᶦ", Say("fyi"));
}
