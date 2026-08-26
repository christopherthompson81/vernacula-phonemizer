// The portable half of test/chichewa.test.ts — the branches the 200-row golden cannot reach.
//
// ⚠ EACH GUARD IS PINNED FROM BOTH SIDES. A rule that fires is half the evidence; the assertions that
// something must NOT fire (the bible verse, the sports time, the football score, the locative `m'`, the
// ISBN) are the half a corpus diff cannot supply, because those shapes read identically before and after.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Chichewa;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ChichewaTests
{
    [Theory]
    [InlineData(0, "ziro")]
    [InlineData(1, "chimodzi")]
    [InlineData(6, "zisanu ndi chimodzi")]
    [InlineData(9, "zisanu ndi zinayi")]
    [InlineData(10, "khumi")]
    [InlineData(11, "khumi ndi chimodzi")]
    [InlineData(21, "makumi awiri ndi chimodzi")]
    [InlineData(42, "makumi anayi ndi ziwiri")]
    // ⚠ 60–90 must not collide with 51–54: the tens MULTIPLIER takes the class-6 concord of makumi while a
    // trailing unit keeps its class-8/10 citation form. One series for both slots makes them equal strings.
    [InlineData(50, "makumi asanu")]
    [InlineData(51, "makumi asanu ndi chimodzi")]
    [InlineData(52, "makumi asanu ndi ziwiri")]
    [InlineData(60, "makumi asanu ndi limodzi")]
    [InlineData(61, "makumi asanu ndi limodzi ndi chimodzi")]
    [InlineData(70, "makumi asanu ndi awiri")]
    [InlineData(80, "makumi asanu ndi atatu")]
    [InlineData(90, "makumi asanu ndi anayi")]
    [InlineData(100, "zana")]
    [InlineData(200, "mazana awiri")]
    [InlineData(555, "mazana asanu ndi makumi asanu ndi zisanu")]
    [InlineData(1000, "chikwi")]
    [InlineData(2000, "zikwi ziwiri")]
    [InlineData(12345, "zikwi khumi ndi ziwiri ndi mazana atatu ndi makumi anayi ndi zisanu")]
    [InlineData(1000000, "miliyoni imodzi")]
    [InlineData(2000000, "mamiliyoni awiri")]
    [InlineData(9000000, "mamiliyoni asanu ndi anayi")]
    [InlineData(12000000, "mamiliyoni khumi ndi awiri")]
    [InlineData(1000000000, "biliyoni imodzi")]
    [InlineData(4700000000, "mabiliyoni anayi ndi mamiliyoni mazana asanu ndi awiri")]
    [InlineData(1600000, "miliyoni imodzi ndi zikwi mazana asanu ndi limodzi")]
    // The ceiling is a SOURCING boundary: no trillion word is attested, so 10¹² keeps digit-by-digit.
    [InlineData(1e12, "chimodzi ziro ziro ziro ziro ziro ziro ziro ziro ziro ziro ziro ziro")]
    public void NumberToWords(double n, string expected) => Assert.Equal(expected, Numbers.NumberToWords(n));

    [Theory]
    // thousands de-grouping — comma, period AND space, all three attested
    [InlineData("1,600,000", "1600000")]
    [InlineData("14,591", "14591")]
    [InlineData("2.289.780", "2289780")]
    [InlineData("30 890 000", "30890000")]
    [InlineData("1.234", "1234")]
    [InlineData("ISBN 0 620 17697 0", "ISBN 0 620 17697 0")] // the head must start 1–9
    // decimals — both separators; a 4-digit tail is a DATE
    [InlineData("66.7", "66 7")]
    [InlineData("104.0", "104 0")]
    [InlineData("12,5", "12 5")]
    [InlineData("Novembala 26,2008", "Novembala 26,2008")]
    // the clock is identified by its MARKER, not by its shape
    [InlineData("1:30 mmawa", "1 koloko ndi mphindi 30 mmawa")]
    [InlineData("6:23 p.m.", "6 koloko ndi mphindi 23 masana")]
    [InlineData("11:30 AM.", "11 koloko ndi mphindi 30 m'mawa")]
    [InlineData("18:30 BST", "18 koloko ndi mphindi 30 BST")]
    [InlineData("21:00 UTC", "21 koloko UTC")]
    [InlineData("Machitidwe 5:37", "Machitidwe 5:37")]
    [InlineData("Marko 14:2", "Marko 14:2")]
    [InlineData("mphindi 64:51", "mphindi 64:51")]
    [InlineData("2:07:06", "2:07:06")]
    // degrees — the scale letter is CLAIMED but no scale name is invented
    [InlineData("40 °C", "madigiri 40")]
    [InlineData("30°F", "madigiri 30")]
    [InlineData("25 ° S", "madigiri 25 kumwera")]
    [InlineData("35°W", "madigiri 35 kumadzulo")]
    [InlineData("30 °", "madigiri 30")]
    [InlineData("10 ° C 20 ° C madigiri", "10 20 madigiri")]
    // the bare `m` key — the word is sourced, the KEY needs an apostrophe guard
    [InlineData("107 m", "mamita 107")]
    [InlineData("10,000 m", "mamita 10000")]
    [InlineData("105 m'ma", "105 m'ma")]
    // ranges are ASCENDING ONLY, and a hyphen CHAIN is never a range
    [InlineData("2004-2009", "2004 mpaka 2009")]
    [InlineData("3-1", "3-1")]
    [InlineData("2014-15", "2014-15")]
    [InlineData("1642 - 20 March", "1642 - 20 March")]
    [InlineData("2-3-5", "2-3-5")]
    [InlineData("19-23.", "19 mpaka 23.")]
    [InlineData("2003-2004.", "2003 mpaka 2004.")]
    [InlineData("my 1994-1996,", "my 1994 mpaka 1996,")]
    [InlineData("2018-19,", "2018-19,")]
    // ampersand, HTML entities and dotted capital runs
    [InlineData("Europu & Asia", "Europu ndi Asia")]
    [InlineData("T&T Clark", "T ndi T Clark")]
    [InlineData("a &nbsp; b", "a b")]
    [InlineData("&amp;", "ndi")]
    [InlineData("U.S. Census", "US Census")]
    [InlineData("B.C.E", "BCE.")]
    [InlineData("U.S.", "US.")]
    // the English ordinal suffix is stripped
    [InlineData("20th", "20")]
    [InlineData("3RD", "3")]
    public void Normalization(string input, string expected) =>
        Assert.Equal(expected, Normalize.NormalizeChichewa(input));

    [Theory]
    [InlineData("a & b")]
    [InlineData("40 °C ndi 25 ° S")]
    [InlineData(" 1,000 ")]
    [InlineData("U.S. Census")]
    public void NeverEmitsADoubledOrEdgeSpace(string input)
    {
        var s = Normalize.NormalizeChichewa(input);
        Assert.DoesNotContain("  ", s, StringComparison.Ordinal);
        Assert.Equal(s.Trim(), s);
    }

    [Theory]
    // percent is POSTPOSED and currency is PREFIXED — the corpus decides each separately
    [InlineData("25 %", "makumi awiɽi ⁿdi zisanu peɽeseⁿti")]
    [InlineData("$5", "maɗoɽa zisanu")]
    // ⚠ THE MAGNITUDE STAYS WITH THE NUMBER because `magnitudes` is deliberately NOT declared.
    [InlineData("$ 350 miliyoni", "maɗoɽa mazana atatu ⁿdi makumi asanu miɽijoni")]
    // ⚠ THE EURO IS DELIBERATELY UNREAD — one hit in one machine-translated article.
    [InlineData("€ 100 miliyoni", "zana miɽijoni")]
    // units are PREFIXED, and the exponent word precedes its noun
    [InlineData("253 km", "makiɽomita mazana awiɽi ⁿdi makumi asanu ⁿdi zitatu")]
    [InlineData("150cm", "seⁿtimita zana ⁿdi makumi asanu")]
    [InlineData("1200 mm", "miɽimita t͡ʃikwi ⁿdi mazana awiɽi")]
    [InlineData("50 mi", "maiɽosi makumi asanu")]
    [InlineData("5 km²", "sikweja makiɽomita zisanu")]
    [InlineData("480 km/h", "makiɽomita mazana anaji ⁿdi makumi asanu ⁿdi atatu pa oɽa")]
    // ⚠ the mass/volume/area half of the ⟨cm⟩ defect: pronounceable letter runs, nothing vanishing
    [InlineData("10 kg", "makiɽoɡaɽamu kʰumi")]
    [InlineData("10 ha", "mahekitaɽa kʰumi")]
    [InlineData("10 l", "maɽita kʰumi")]
    [InlineData("10 L", "maɽita kʰumi")]
    [InlineData("10 g", "maɡaɽamu kʰumi")]
    [InlineData("240 ha", "mahekitaɽa mazana awiɽi ⁿdi makumi anaji")]
    public void SymbolTier(string input, string expected) =>
        Assert.Equal(expected, Phonemizer.Phonemize(input, "nya"));

    [Theory]
    [InlineData("1", "t͡ʃimod͡zi")]
    [InlineData("6", "zisanu ⁿdi t͡ʃimod͡zi")]
    [InlineData("42", "makumi anaji ⁿdi ziwiɽi")]
    [InlineData("200", "mazana awiɽi")]
    [InlineData("1000", "t͡ʃikwi")]
    // ⟨ng'⟩ is one grapheme, and the typographic apostrophe folds onto the ASCII one before the scan.
    [InlineData("ng'oma", "ŋoma")]
    [InlineData("ng’oma", "ŋoma")]
    public void Phonemize(string input, string expected) =>
        Assert.Equal(expected, Phonemizer.Phonemize(input, "nya"));
}
