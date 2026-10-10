// The portable half of test/includes-empty.test.ts (#1476). `"…".Contains("")` is TRUE in .NET exactly as
// `"…".includes("")` is in JS, so the port had reproduced every one of these readings faithfully — a word
// edge read as a vowel. Every expectation is RELATIONAL (the edge word against a word the rule already reads
// right), so no hand-typed IPA is pinned.
using System.Linq;
using CzechEngine = Vernacula.Phonemizer.Languages.Czech.CzechPhonemizer;
using DutchEngine = Vernacula.Phonemizer.Languages.Dutch.DutchPhonemizer;
using GermanEngine = Vernacula.Phonemizer.Languages.German.GermanPhonemizer;
using GermanG2p = Vernacula.Phonemizer.Languages.German.G2p;
using NorwegianEngine = Vernacula.Phonemizer.Languages.Norwegian.NorwegianPhonemizer;
using SlovenianEngine = Vernacula.Phonemizer.Languages.Slovenian.SlovenianPhonemizer;
using SwahiliEngine = Vernacula.Phonemizer.Languages.Swahili.SwahiliPhonemizer;
using YorubaEngine = Vernacula.Phonemizer.Languages.Yoruba.YorubaPhonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class IncludesEmptyTests
{
    [Fact]
    public void DutchWordFinalCIsK()
    {
        Assert.Equal(DutchEngine.PhonemizeWord("blok"), DutchEngine.PhonemizeWord("bloc"));
        Assert.Equal(DutchEngine.PhonemizeWord("isaak"), DutchEngine.PhonemizeWord("isaac"));
        Assert.StartsWith("s", DutchEngine.PhonemizeWord("cent")); // control: the soft rule still fires
    }

    [Fact]
    public void GermanWordFinalHAfterAPrefixShapedStemStaysSilent()
    {
        Assert.DoesNotContain("h", GermanEngine.PhonemizeWord("geh"));
        Assert.Contains("h", GermanEngine.PhonemizeWord("behalten")); // control
    }

    [Fact]
    public void GermanBareInitialChIsK() =>
        Assert.Equal(new[] { GermanG2p.ToSegments("chlor")[0].Ph }, GermanG2p.ToSegments("ch").Select(s => s.Ph).ToArray());

    [Fact]
    public void CzechWordInitialEcaronTakesNoGlide()
    {
        Assert.Equal(CzechEngine.PhonemizeWord("ed"), CzechEngine.PhonemizeWord("ěd"));
        Assert.Contains("vj", CzechEngine.PhonemizeWord("věda")); // control
    }

    [Fact]
    public void NorwegianOneLetterDIsNotSilent()
    {
        Assert.NotEqual("", NorwegianEngine.PhonemizeWordRules("d"));
        Assert.False(NorwegianEngine.PhonemizeWordRules("land").EndsWith("d")); // control
    }

    [Fact]
    public void FinalWAfterAConsonantIsNotFoldedIntoLabialization()
    {
        foreach (var ipa in new[] { SwahiliEngine.PhonemizeWord("kabw"), YorubaEngine.PhonemizeWord("bw") })
        {
            Assert.DoesNotContain("ʷ", ipa);
            Assert.EndsWith("w", ipa);
        }
        Assert.Contains("ʷ", SwahiliEngine.PhonemizeWord("mwezi")); // controls
        Assert.Contains("ʷ", YorubaEngine.PhonemizeWord("ẹgwa"));
    }

    // ⚠ CRAFTED COMPOUNDS, NOT DICTIONARY WORDS — see the TS test. A correct prefix-nucleus count puts the stress
    // exactly where the suffix alone has it.
    [Theory]
    [InlineData("rdečabeceda", "abeceda")] // a syllabic ⟨r⟩ at the word's LEFT edge (the TS miscounted this)
    [InlineData("vrbabicami", "babicami")] // a prefix-final ⟨r⟩ before a consonant
    // A prefix-final ⟨r⟩ before a VOWEL is an onset, not a nucleus. This port used to count `w[..cut]` with the
    // slice edge as a non-vowel, which made it syllabic and put the stress one syllable late.
    [InlineData("vrabeceda", "abeceda")]
    public void SlovenianSuffixStressCountsNucleiInWholeWordContext(string word, string suffix) =>
        Assert.EndsWith(SlovenianEngine.PhonemizeWord(suffix), SlovenianEngine.PhonemizeWord(word));
}
