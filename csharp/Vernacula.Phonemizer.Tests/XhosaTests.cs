// The portable half of test/xhosa.test.ts — the branches the 200-row golden cannot reach, plus the four
// defects the port sent back to the TypeScript, NONE of which moves a golden row in either engine:
// the a.m./p.m. marker with no right edge (it ate `ama-`, a noun-class prefix), `\p{Lu}` being inert under
// /i in the honorific's capital guard, the >2^53 numeral that composed past its own rounding, and the
// numeric colon a declined clock left behind as CLAUSE PUNCTUATION.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Xhosa;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class XhosaTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "xh").Trim();
    private static string Norm(string s) => Normalize.NormalizeXhosa(s);

    [Theory]
    // The Xhosa g2p: the click series, the ⟨rh⟩→[x] Zulu lacks, and Nguni penultimate stress with length.
    [InlineData("xhosa", "kǁʰˈɔːsa")]
    [InlineData("iqanda", "ikǃˈaːnd̤a")]
    [InlineData("ucwangciso", "ukǀwaŋ̤ǀˈiːsɔ")]
    [InlineData("irhamncwa", "ixˈaːmŋǀwa")]
    [InlineData("indlu", "ˈiːnɮ̤u")]
    public void ReadsTheXhosaG2p(string input, string expected) =>
        Assert.Equal(expected, XhosaPhonemizer.PhonemizeWord(input));

    [Theory]
    // ⚠ THE MARKER NEEDS A RIGHT EDGE. `[ ]*([AaPp])\.?[Mm]\.?` ended wherever it liked, so ` Am` of
    // `amaXhosa` matched it: the word was destroyed and a spurious *kusasa* emitted.
    [InlineData("ye 9:30 amaXhosa", "ye ithoba namashumi amathathu amaXhosa")]
    [InlineData("14:00 Amabini", "ishumi nane Amabini")]
    // …and every real marker still reads, dotted or not, spaced or glued.
    [InlineData("9:30 AM", "ithoba namashumi amathathu kusasa")]
    [InlineData("10:30p.m.", "ishumi namashumi amathathu emva kwemini")]
    [InlineData("07:19 a.m. ixesha", "isixhenxe neshumi nethoba kusasa ixesha")]
    public void TheMeridiemMarkerIsAWord(string input, string expected) => Assert.Equal(expected, Norm(input));

    [Theory]
    // ⚠ `\p{Lu}` UNDER /i MATCHES A LOWERCASE LETTER, so the honorific's "only before a capitalised name"
    // guard required nothing. The concord's own case is spelled into the class instead — `UMnu.` still reads.
    [InlineData("Mnu. Mandela uthe", "Mnumzana Mandela uthe")]
    [InlineData("UMnu. Costello uthe", "UMnumzana Costello uthe")]
    [InlineData("watsho uMnu Costello.", "watsho uMnumzana Costello.")]
    [InlineData("Mnu. rudd sokutyikitya", "Mnu. rudd sokutyikitya")]
    [InlineData("umnu reid ubaleka", "umnu reid ubaleka")]
    public void TheHonorificGuardIsRealAndNotAnIFlagIllusion(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // ⚠ `:` IS DECLARED CLAUSE PUNCTUATION, so a numeric colon the clock rules decline became a PAUSE inside
    // a quantity. A colon that is real punctuation needs a digit on both sides to be touched, and is not.
    [InlineData("le-4: 41.30, 2: 11.60 imizuzu", "le-4 41 3 0, 2 11 6 0 imizuzu")]
    [InlineData("efumana 2:2 isidanga", "efumana 2 2 isidanga")]
    [InlineData("24:45", "24 45")]
    [InlineData("Umzekelo: 5 abantu", "Umzekelo: 5 abantu")]
    [InlineData("ngo-11:00", "ngo-ishumi nanye")]
    public void ADeclinedClockLeavesNoPause(string input, string expected) => Assert.Equal(expected, Norm(input));

    [Fact]
    // ⚠ THE COMPOSITOR HAS NO CEILING — it recurses through `izigidi` multipliers — so above 2^53 it composed
    // right past the rounding and both of these read *izigidi izigidi izigidi iwaka* (#1059).
    public void ALongDigitRunKeepsItsLastDigit()
    {
        var a = Say("1000000000000000000001");
        var b = Say("1000000000000000000009");
        Assert.NotEqual(a, b);
        Assert.EndsWith("kʼˈuːɲɛ", a, StringComparison.Ordinal);  // …kunye  (1)
        Assert.EndsWith("itʰˈɔːɓa", b, StringComparison.Ordinal); // …ithoba (9)
        // The fallback reading is the one `spell()` already gives a fractional part: the standalone ku- stems,
        // and the manifest's own zero word — `Ku[0]` is the EMPTY STRING and must not be used for it.
        Assert.Equal("kunye iqanda iqanda",
            string.Join(" ", Numbers.NumberToWords(1e21, "1000000000000000000000").Split(' ')[..3]));
        Assert.Equal(Numbers.NumberToWords(1957), Numbers.NumberToWords(1957, "1957"));
    }

    [Theory]
    // The three foreign signals, all required. A click letter alone, or a dictionary hit alone, wrecks real
    // Nguni words — `xhosa`, `cha`, `cima` are all in CMUdict.
    [InlineData("xhosa")]
    [InlineData("cha")]
    [InlineData("cima")]
    [InlineData("coca")]
    public void NguniWordsThatCollideWithTheEnglishDictionaryStayNative(string w) =>
        Assert.Matches("[ǀǁǃ]", Say(w));
}
