/**
 * Russian defects the Rust port found (#1513), fixed TS-first. Ported from test/russian-port-findings.test.ts;
 * probe text is synthetic, and the expectations are the normalizer's words or relations between two outputs.
 */
using Vernacula.Phonemizer.Core;
using Manifest = Vernacula.Phonemizer.Languages.Russian.Manifest;
using Normalize = Vernacula.Phonemizer.Languages.Russian.Normalize;
using Numbers = Vernacula.Phonemizer.Languages.Russian.Numbers;
using RussianPhonemizer = Vernacula.Phonemizer.Languages.Russian.RussianPhonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class RussianPortFindingsTests
{
    [Fact]
    public void AnAbbreviationDotThatEndsTheSentenceIsKept()
    {
        Assert.Equal("К 1990 года. Затем пришли.", Normalize.NormalizeRussian("К 1990 г. Затем пришли."));
        Assert.Equal("в 2007 году. Затем", Normalize.NormalizeRussian("в 2007 г. Затем"));
        Assert.Equal("5 тысяч. Затем", Normalize.NormalizeRussian("5 тыс. Затем"));
        Assert.Equal("в XV века. Затем", Normalize.NormalizeRussian("в XV в. Затем"));
        Assert.Equal("в 2007 году мы", Normalize.NormalizeRussian("в 2007 г. мы"));
        Assert.Equal("в 2007 году, мы", Normalize.NormalizeRussian("в 2007 г., мы"));
        Assert.Equal("в 1990 году в 2000 году мы", Normalize.NormalizeRussian("в 1990 г. в 2000 г. мы"));
        Assert.Equal("улица Ленина", Normalize.NormalizeRussian("ул. Ленина"));
        Assert.Equal("профессор Иванов", Normalize.NormalizeRussian("проф. Иванов"));
    }

    [Fact]
    public void TheInitialsVAndGAreLetters()
    {
        var v = Manifest.MANIFEST.LetterNames["в"];
        var g = Manifest.MANIFEST.LetterNames["г"];
        Assert.Equal($"{v} Петров и {g} Иванов", Normalize.NormalizeRussian("В. Петров и Г. Иванов"));
        Assert.Equal($"{v} {v} Набоков", Normalize.NormalizeRussian("В. В. Набоков"));
    }

    [Fact]
    public void TheFractionDenominatorTakesTheNumeratorsCount()
    {
        Assert.Equal("две третьих", Normalize.NormalizeRussian("2/3"));
        Assert.Equal("пять восьмых", Normalize.NormalizeRussian("5/8"));
        Assert.Equal("три вторых", Normalize.NormalizeRussian("3/2"));
        Assert.Equal("одиннадцать пятых", Normalize.NormalizeRussian("11/5"));
        Assert.Equal("одна пятая", Normalize.NormalizeRussian("1/5"));
        Assert.Equal("двадцать одна сотая", Normalize.NormalizeRussian("21/100"));
    }

    [Fact]
    public void ClockMinutesAgreeWithTheFeminineMinuta()
    {
        Assert.Equal("девять часов двадцать одна минута", Normalize.NormalizeRussian("9:21"));
        Assert.Equal("один час одна минута", Normalize.NormalizeRussian("1:01"));
        Assert.Equal("три часа две минуты", Normalize.NormalizeRussian("3:02"));
        Assert.Equal("двенадцать часов одиннадцать минут", Normalize.NormalizeRussian("12:11"));
    }

    [Fact]
    public void ACaseSuffixReadsTheObliqueCardinalWhereItEndsOne()
    {
        Assert.Equal("в четырёх томах", Normalize.NormalizeRussian("в 4-х томах"));
        Assert.Equal("тридцати лет", Normalize.NormalizeRussian("30-ти лет"));
        Assert.Equal("тридцати пяти", Normalize.NormalizeRussian("35-ти"));
        Assert.Equal("тридцатью четырьмя годами", Normalize.NormalizeRussian("34-мя годами"));
        Assert.Equal("пятых классов", Normalize.NormalizeRussian("5-х классов"));
        Assert.Equal("двенадцатых", Normalize.NormalizeRussian("12-х"));
        Assert.Equal("тысяча девятьсот семидесятых", Normalize.NormalizeRussian("1970-х"));
    }

    [Fact]
    public void VsyaIsNotAReflexive()
    {
        var s = Manifest.MANIFEST.Consonants["с"];
        Assert.Contains(s[1], RussianPhonemizer.PhonemizeWord("вся"));
        Assert.EndsWith($"{s[0]}ə", RussianPhonemizer.PhonemizeWord("вернулся"));
    }

    [Fact]
    public void LettersOutsideTheModernAlphabetFoldToTheirRussianSpelling()
    {
        Assert.Equal(Phonemizer.Phonemize("хлебъ", "ru"), Phonemizer.Phonemize("хлѣбъ", "ru"));
        Assert.Equal(Phonemizer.Phonemize("Кийив", "ru"), Phonemizer.Phonemize("Київ", "ru"));
        Assert.Equal(Phonemizer.Phonemize("ганок", "ru"), Phonemizer.Phonemize("ґанок", "ru"));
        Assert.Equal(Phonemizer.Phonemize("Феатръ", "ru"), Phonemizer.Phonemize("Ѳеатръ", "ru"));
        Assert.DoesNotContain(" ", Phonemizer.Phonemize("хлѣбъ", "ru"));
    }

    [Fact]
    public void TheSoftenTriggerTiersAreLoaded()
    {
        // The g2p reads both tiers from the manifest (the TS proves it live with a mocked manifest).
        Assert.Equal("тд", Manifest.MANIFEST.SoftenTriggers);
        Assert.Equal("тднч", Manifest.MANIFEST.SoftenTriggersTdn);
    }

    [Fact]
    public void ALoneThousandIsTysyacha()
    {
        Assert.Equal("тысяча девятьсот", Numbers.NumberToWords(1900));
        Assert.Equal("тысяча", Numbers.NumberToWords(1000));
        Assert.Equal("двадцать одна тысяча", Numbers.NumberToWords(21000));
        Assert.Equal("две тысячи", Numbers.NumberToWords(2000));
    }
}
