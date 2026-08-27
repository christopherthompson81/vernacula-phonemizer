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

    [Fact]
    public void SloveneLoadsTheFoldedLexiconAndItIsTheFleetsWorstCase()
    {
        // ⚠ THE `fold` IS NOT OPTIONAL WIRING — 1,252 of stress.tsv's 37,340 keys are ə/ł respellings no
        // Slovene input can spell, and 684 of them alias onto a word the file does not otherwise contain
        // (680 distinct new slots, four pairs colliding). A port that omitted `fold` would load a smaller
        // lexicon than the TypeScript and diverge on every row touching one of them.
        var lex = Languages.Slovenian.SlovenianPhonemizer.StressDict();
        Assert.Equal(38020, lex.Count);
        // `umrł` is the file's spelling; `umrl` is the word Slovene actually writes, and it exists ONLY as
        // an alias. Without the fold it takes the penultimate fallback and reads *ˈumərl* — which is what
        // eight rows of the sl golden said until this port regenerated it.
        Assert.Equal(1d, lex["umrł"]);
        Assert.Equal(1d, lex["umrl"]);
        Assert.Equal("umˈərl", Phonemizer.Phonemize("umrl", "sl"));
        // ⚠ AND THE UNFOLDED KEY WINS AMONG THE 102 SHADOWED PAIRS. `blesteł`=1 is a file key; `bləsteł`=0
        // folds onto the same slot `blestel` and must LOSE it, and the iteration order that decides this is
        // the FILE'S, not the dictionary's.
        Assert.Equal(1d, lex["blestel"]);
        Assert.Equal(0d, lex["bləsteł"]);
    }

    [Theory]
    // ⚠ …AND A CLOSING QUOTE IS NOT PART OF THE WORD. `medialOnly` only bars the apostrophe from LEADING a
    // run, so `'ordet'` tokenized as `ordet'` — missing its lexicon entry and changing the accent to
    // *ˈùːɖɛt'*. Requiring a LETTER after the apostrophe separates a possessive from a quote.
    [InlineData("'ordet'", "ˈuːɖɛt")]
    [InlineData("Han sa 'nej'", "hɑːn sɑː neːj")]
    public void AClosingQuoteIsNotPartOfTheWord(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "sv"));
}
