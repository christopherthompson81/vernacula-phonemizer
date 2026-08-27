// The #1068 fix at the loader seam: a lexicon key is aliased to its NATIVISED spelling, because the engine
// folds a word to its own inventory BEFORE looking it up.
//
// ⚠ NOT IN THE 200-ROW GOLDEN — Swedish's 15 affected keys have zero FLEURS instances, and both engines
// folded identically, so the parity gate agreed on the wrong reading for as long as it shipped. The TS side
// guards the whole fleet in test/lexicon-reachability.test.ts; this pins the one language C# has ported.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LexiconFoldTests
{
    [Theory]
    // `münchen` is in accent-stress.tsv with NST accent 1. Text() folded ü→u, looked up `munchen`, missed,
    // and the OOV shape rule assigned accent 2 — the combining grave. Both spellings now read accent 1.
    [InlineData("München", "mˈɵnkhɛn")]
    [InlineData("münchen", "mˈɵnkhɛn")]
    // …and the fold is what carries it, so the folded spelling reads the same. This is the alias, not a
    // coincidence: before the fix BOTH of these emitted the grave.
    [InlineData("munchen", "mˈɵnkhɛn")]
    public void AFoldedHeadwordIsReachableFromText(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "sv"));

    [Fact]
    public void AnUnfoldedKeyAlreadyInTheFileStillWins()
    {
        // ⚠ THE PRECEDENCE RULE IS WHAT KEEPS THE GOLDENS STILL. An alias is written only into a FREE slot,
        // so any word the engine could already reach reads exactly as it did. `hus` is an ordinary native
        // headword with no folded competitor; it must be untouched by the aliasing pass.
        Assert.Equal("hʉːs", Phonemizer.Phonemize("hus", "sv"));
    }

    [Theory]
    // ⚠ THE SECOND, DISJOINT DEFECT. #1068 described five of Swedish's keys as "split", as though widening
    // the word arm were a cheap partial of the fold fix. The sets do not overlap: Nat("o'brien") returns it
    // UNCHANGED — an apostrophe is not a letter the nativiser maps — so these were never a reachability
    // problem, they were a TOKENIZER one, and both fixes are wanted.
    [InlineData("o'brien", "ɔbrˈiːɛn")]        // was `uː brˈìːɛn` — two words, "oo" + "breen"
    [InlineData("rock'n'roll", "rɔkːnrˈɔlː")]  // was `rɔkː n rɔlː`
    [InlineData("mcdonald's", "mkdɔnˈalds")]   // was `mkdɔnˈald s`
    [InlineData("Xi'an", "ksˈìːan")]           // one of the six the mined corpus writes
    public void AnApostropheBearingHeadwordIsOneWord(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "sv"));

    [Theory]
    // ⚠ …AND A CLOSING QUOTE IS NOT PART OF THE WORD. `medialOnly` only bars the apostrophe from LEADING a
    // run, so `'ordet'` tokenized as `ordet'` — missing its lexicon entry and changing the accent to
    // *ˈùːɖɛt'*. Requiring a LETTER after the apostrophe separates a possessive from a quote.
    [InlineData("'ordet'", "ˈuːɖɛt")]
    [InlineData("Han sa 'nej'", "hɑːn sɑː neːj")]
    public void AClosingQuoteIsNotPartOfTheWord(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "sv"));
}
