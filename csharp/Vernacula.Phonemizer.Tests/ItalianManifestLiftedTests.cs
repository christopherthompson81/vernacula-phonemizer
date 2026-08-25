/**
 * Italian's word tables come from italian.jsonc. Derived FROM the manifest, so what these catch is
 * DECOUPLING — a literal re-hardcoded in the code — rather than wrong data.
 * Ported from test/italian-manifest-lifted.test.ts — see that file for what each table is and is not.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Italian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ItalianManifestLiftedTests
{
    private static ItalianDef DEF => ItalianPhonemizer.DEF;
    private static string Say(string s) => Phonemizer.Phonemize(s, "it").Replace("ˈ", "").Replace("ˌ", "");

    [Fact]
    public void TheThreeInitialismTablesAreOneSource()
    {
        // ⚠ Italian was the only ported language whose acronym list was a bare set literal in code. All
        // three tables feed the SAME call site, so they are lifted and tested together.
        Assert.Contains(Say(DEF.LetterNames["u"]), Say("la porta USB rotta"));
        Assert.Contains(Say(DEF.LetterNames["b"]), Say("la porta USB rotta"));
        Assert.Contains("hiv", DEF.AcronymLetters);
        Assert.Contains(Say(DEF.LetterNames["h"]), Say("l' HIV oggi"));
        // A readable run NOT on the list is read as a word, not spelled.
        Assert.DoesNotContain(Say(DEF.LetterNames["n"]), Say("la NASA e l' OPEC"));
    }

    [Fact]
    public void TheCodasSeparateASpelledRunFromAReadOne()
    {
        // Italian native words end in a VOWEL, so a two-consonant tail is the signal — but the codas Italian
        // tolerates in established loanwords (film, sport, test, rock) must NOT be spelled out.
        foreach (var w in new[] { "SPORT", "TEST", "FILM", "ROCK" })
            Assert.DoesNotContain(Say(DEF.LetterNames["t"]), Say($"il {w} oggi"));
        Assert.Contains("rt", DEF.Phonotactics.Codas);
        Assert.Contains("sp", DEF.Phonotactics.Onsets);
    }

    [Fact]
    public void TheOrdinalTableIsTheIrregularHeadOnly()
    {
        // 1–10 only: Italian COMPOSES everything above ten from the cardinal (venti → ventesimo), so a tens
        // or hundreds row would be a second way to say the same thing.
        Assert.Equal(10, DEF.Ordinals.Count);
        Assert.Contains(Say(DEF.Ordinals["3"]), Say("il 3º posto"));
        Assert.Contains(Say("undicesimo"), Say("XI secolo"));
        Assert.Contains(Say("millesimo"), Say("il 1000º giorno"));
    }

    [Fact]
    public void TheApocopatedOneIsOneFactServingTwoCallers()
    {
        Assert.Contains(Say(DEF.Fractions.Denominators["2"]), Say("1/2 della torta"));
        Assert.Contains(Say(DEF.ApocopatedOne), Say("1/5 del totale"));
        // ⚠ THE SAME WORD, THE OTHER CALLER: *uno* apocopates before a masculine noun, and the degree noun
        // is one. It was `fractions.numeratorOne` until the degree fix needed it too.
        Assert.Contains(Say(DEF.ApocopatedOne), Say("1 °C soltanto"));
        Assert.Contains(Say("quarti"), Say("3/4 di ora"));
    }

    [Fact]
    public void TheRelationalReadingsCarryTheCopula()
    {
        Assert.StartsWith("è ", DEF.SignWords.Equals);
        Assert.Contains(Say(DEF.SignWords.Equals), Say("4 = 4"));
        Assert.Contains(Say(DEF.SignWords.LessThan), Say("3 < 5"));
        Assert.Contains(Say(DEF.SignWords.DividedBy), Say("20 ÷ 5"));
        Assert.Contains(Say(DEF.SignWords.Times), Say("4 × 4 trazione"));
        Assert.Contains(Say(DEF.SignWords.Ampersand), Say("B&B"));
    }

    [Fact]
    public void TheThreeSensesOfTheDegreeSignStaySeparate()
    {
        Assert.Contains(Say(DEF.Compass["n"]), Say("45° N di latitudine"));
        Assert.Contains(Say(DEF.Degree.Celsius), Say("20 °C"));
        Assert.Contains(Say(DEF.Ordinals["1"]), Say("il 1º della lista"));
    }

    [Fact]
    public void TheDegreeNounAgreesAndTakesTheApocopatedNumeralAtOne()
    {
        // ⚠ THIS TEST USED TO PIN THE OPPOSITE — `1 °C` read *uno gradi Celsius* and this recorded it as a
        // known defect. Its flipping is what says the defect is gone. Compared as whole TOKENS.
        string[] Words(string t) => Say(t).Split(' ');
        string sg = Say(DEF.Degree.Singular), pl = Say(DEF.Degree.Plural);
        Assert.NotEqual(sg, pl);
        Assert.Contains(sg, Words("1 °C soltanto"));
        Assert.DoesNotContain(pl, Words("1 °C soltanto"));
        Assert.Contains(pl, Words("20 °C"));
        // ⚠ THE COUNT IS THE WHOLE NUMBER, NOT ITS LAST DIGIT — the rule captured `(\d)` before the fix.
        Assert.Contains(pl, Words("21 °C"));
        Assert.DoesNotContain(sg, Words("21 °C"));
        Assert.Contains(pl, Words("0 °C"));
        Assert.Contains(pl, Words("1,5 °C"));
        // The Fahrenheit and COMPASS rules take the same helper, not their own copy of the noun.
        Assert.Contains(sg, Words("1 °F soltanto"));
        Assert.Contains(sg, Words("1° N di latitudine"));
        Assert.Contains(pl, Words("45° N di latitudine"));
        // ⚠ A COMPOUND ENDING IN -uno IS LEFT ALONE ON PURPOSE: *ventuno gradi*, not *ventun gradi*.
        Assert.Contains(Say("ventuno"), Say("21 °C"));
    }

    [Fact]
    public void EveryOtherLiftedTableIsReachedBySomeReading()
    {
        Assert.Contains(Say(DEF.EraMarkers.BeforeChrist), Say("356 a. C."));
        Assert.Contains(Say(DEF.EraMarkers.AfterChrist), Say("44 d. C."));
        Assert.Contains(Say(DEF.NumberSign), Say("n. 1 della lista"));
        Assert.Contains(Say(DEF.DottedAbbrev["sig"]), Say("il Sig. Rossi"));
        Assert.Contains(Say(DEF.DecimalWord), Say("14,7 miliardi"));
        Assert.Contains(Say(DEF.Symbols.Percent[0]), Say("50 %"));
        Assert.Contains(Say(DEF.Symbols.Units["km"][1]), Say("5 km"));
        Assert.Contains(Say(DEF.Symbols.Currency["$"][1]), Say("banconote da 5 $"));
    }
}
