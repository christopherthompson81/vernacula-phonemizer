/**
 * Ukrainian's word tables come from ukrainian.jsonc. Derived FROM the manifest, so what these catch is
 * DECOUPLING — a literal re-hardcoded in the code — rather than wrong data.
 * Ported from test/ukrainian-manifest-lifted.test.ts — see that file for what each table is and is not.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Ukrainian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class UkrainianManifestLiftedTests
{
    private static UkrainianDef DEF => Manifest.DEF;
    private static string Say(string s) => Phonemizer.Phonemize(s, "uk").Replace("ˈ", "").Replace("ˌ", "");

    [Fact]
    public void MetreAndSquaredHaveOneSourceSharedWithTheSymbolTier()
    {
        Assert.Equal(new[] { "метр", "метри", "метрів", "метра" }, DEF.SymbolTier.Units["м"]);
        Assert.Contains(Say(DEF.SymbolTier.Units["м"][2]), Say("6 м завширшки"));
        Assert.Contains(Say(DEF.SymbolTier.Units["м"][0]), Say("1 м завширшки"));
        Assert.Contains(Say(DEF.SymbolTier.ExponentWords.Squared![2]), Say("9 кв. миль"));
        Assert.Contains(Say(DEF.SymbolTier.ExponentWords.Squared![2]), Say("9 км²"));
    }

    [Fact]
    public void TheMasculineAndNeuterOrdinalTablesAreBothLiveAndDifferent()
    {
        Assert.NotEqual(DEF.Ordinals.OneToNineteen[19], DEF.RomanOrdinals.OneToNineteen[19]);
        Assert.Contains(Say(DEF.Ordinals.OneToNineteen[19]), Say("19-й день"));
        Assert.Contains(Say(DEF.RomanOrdinals.OneToNineteen[19]), Say("XIX століття"));
    }

    [Fact]
    public void VikIsAbsentFromTheRomanContextSoAMasculineNounKeepsTheCardinal()
    {
        Assert.DoesNotContain("вік", DEF.RomanOrdinals.Context);
        Assert.DoesNotContain(Say(DEF.RomanOrdinals.Tens[2]), Say("XX вік"));
    }

    [Fact]
    public void TheObliqueCardinalAndTheOrdinalAnswerTheSameShapeDifferently()
    {
        Assert.Contains(Say(DEF.GenitiveCardinals.OneToNineteen[3]), Say("3-х осіб"));
        Assert.Contains("sʲimdɛsʲatɪx", Say("1970-х років")); // сімдесятих — the decade ORDINAL
    }

    [Fact]
    public void TheClockSelectsAnEndingByCaseNameNotByAMagicIndex()
    {
        var cases = DEF.Ordinals.Endings.Select(e => e.Case).ToList();
        foreach (var c in DEF.Clock.PrepositionCase.Values) Assert.Contains(c, cases);
        Assert.Contains(DEF.Clock.DefaultCase, cases);
        // ⚠ THE PREPOSITION MUST BE DROPPED BEFORE COMPARING — it is spoken too, so a whole-string
        // comparison passes with every preposition wired to one hardcoded ending.
        string Hour(string prep) => string.Join(" ", Say($"{prep} 20:30").Split(' ').Skip(1));
        var forms = new HashSet<string>(new[] { Hour("о"), Hour("з"), Hour("між") });
        Assert.Equal(3, forms.Count);
        foreach (var f in forms) Assert.NotEqual(Say("20:30"), f);
    }

    [Fact]
    public void TheSignWordsAreOneSourceSharedWithTheSymbolTier()
    {
        Assert.Contains(Say(DEF.SignWords.Equals), Say("4 = 4"));
        Assert.Contains(Say(DEF.SignWords.PlusMinus), Say("±5"));
        Assert.Contains(Say(DEF.SignWords.Times), Say("4 × 4"));
        Assert.Contains(Say(DEF.SignWords.Ampersand), Say("B&B"));
    }

    [Fact]
    public void TheMultiDotAbbreviationsAreOrderedLongestFirst()
    {
        var written = DEF.MultiDotAbbrev.Select(a => a.Written).ToList();
        Assert.True(written.IndexOf("до н. е.") < written.IndexOf("н. е."));
        Assert.Contains(Say("до нашої ери"), Say("1100 року до н. е."));
        Assert.Equal(Say("1100 року н. е."), Say("1100 року н.е."));
    }

    [Fact]
    public void TheFractionNumeratorFeminisesThroughNumbersFeminine()
    {
        Assert.Contains(Say(DEF.Numbers.Feminine.One), Say("1/2 склянки"));
        Assert.DoesNotContain(Say(DEF.Numbers.Units[1]), Say("1/2 склянки"));
        Assert.Contains(Say(DEF.Numbers.Feminine.Two), Say("2/3 населення"));
    }

    [Fact]
    public void EveryOtherLiftedTableIsReachedBySomeReading()
    {
        Assert.Contains(Say(DEF.NumberSign), Say("№11"));
        Assert.Contains(Say(DEF.RangeWord), Say("1418-1450"));
        Assert.Contains(Say(DEF.TemperatureScales["C"]), Say("1 °C"));
        Assert.Contains(Say(DEF.TemperatureScales["F"]), Say("32 °F"));
        Assert.Contains(Say(DEF.Degree[2]), Say("45°"));
        Assert.Contains(Say(DEF.DottedAbbrev["стор"]), Say("стор. 45"));
        Assert.Contains(Say(DEF.SymbolTier.RateDenominators["с"]), Say("10 м/с"));
        Assert.Contains(Say(DEF.LetterNames["а"]), Say("АОЛ"));
        Assert.Contains("ст", DEF.Phonotactics.Onsets);
        Assert.Contains("рк", DEF.Phonotactics.Codas);
    }
}
