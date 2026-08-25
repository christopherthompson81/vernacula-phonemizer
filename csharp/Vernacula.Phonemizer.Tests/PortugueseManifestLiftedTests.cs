/**
 * Portuguese's word tables come from portuguese.jsonc. Derived FROM the manifest, so what these catch is
 * DECOUPLING — a literal re-hardcoded in the code — rather than wrong data.
 * Ported from test/portuguese-manifest-lifted.test.ts — see that file for what each table is and is not.
 *
 * ⚠ NO pt-BR HERE. The Brazilian variant is not ported to C# (the parity gate names it on every run), so the
 * `months` assertion the TS makes against it has no counterpart; the `pt` half of that finding is asserted.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Portuguese;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class PortugueseManifestLiftedTests
{
    private static PortugueseManifest DEF => Manifest.MANIFEST;
    private static string Say(string s) => Phonemizer.Phonemize(s, "pt").Replace("ˈ", "").Replace("ˌ", "");

    [Fact]
    public void MonthsIsDeadInEuropeanPortuguese()
    {
        // Portugal says *um de julho*, which the number path says anyway; only the Brazilian branch reads the
        // table. An EXPLICIT 1º is honoured in both, because there the writer marked it.
        Assert.DoesNotContain(Say(DEF.Ordinals.Units[1]), Say("1 de julho"));
        Assert.Contains(Say(DEF.Ordinals.Units[1]), Say("1º de julho"));
        Assert.Contains("janeiro", DEF.Months);
    }

    [Fact]
    public void TheOrdinalTableServesAllThreeCallersWithNoTeensRow()
    {
        // Eleventh is COMPOSED: Tens[1] + Units[1]. There is no teens table to drift from.
        var eleventh = $"{DEF.Ordinals.Tens[1]} {DEF.Ordinals.Units[1]}";
        Assert.Contains(Say(eleventh), Say("O 11º posto"));
        Assert.Contains(Say(DEF.Ordinals.Tens[1]), Say("XII aniversário"));
        Assert.Contains(Say(DEF.Ordinals.Tens[1]), Say("1/12 do total"));
        Assert.Contains(Say(DEF.Ordinals.Thousandth), Say("O 1000º dia"));
    }

    [Fact]
    public void TheFractionNumeratorIsNotApocopated()
    {
        // Unlike Spanish: the plain cardinal serves — um quinto.
        Assert.Contains(Say(DEF.Numbers.Small[1]), Say("1/5 do total"));
        Assert.Contains(Say(DEF.Fractions.Denominators["2"]), Say("1/2 do bolo"));
        Assert.Contains(Say(DEF.Fractions.Denominators["3"]), Say("1/3 do total"));
    }

    [Fact]
    public void TheClockSpeaksItsNounAndFeminisesTheHour()
    {
        Assert.Contains(Say(DEF.Clock.Hours), Say("07h19 começou"));
        Assert.Contains(Say(DEF.Clock.Hour), Say("1h começou"));
        Assert.Contains(Say(DEF.FeminineOne), Say("1h começou"));
        Assert.DoesNotContain(Say(DEF.Clock.Hours), Say("1h começou"));
    }

    [Fact]
    public void TheRealHasItsOwnWordAndTheDollarCodesFold()
    {
        Assert.Contains(Say(DEF.RealWord), Say("R$ 50"));
        // ⚠ A compound `US$` key in the tier would be UNREACHABLE — the initialism pass splits `US` into
        // letters first, leaving the `$` preceded by a letter where the tier's guard refuses it.
        foreach (var code in DEF.DollarCodes) Assert.Contains(Say("$100"), Say($"{code}$ 100"));
    }

    [Fact]
    public void TheDegreeNounIsAlwaysPluralWhichIsAKnownDefect()
    {
        // `1 °C` reads *um graus Celsius*. Pre-existing; the lift moved the words, not the missing agreement.
        // Asserted so the bug is visible in the suite — when it is fixed, this test is what says so.
        Assert.Contains(Say(DEF.Degree.Word), Say("1 °C apenas"));
        Assert.Contains(Say(DEF.Degree.Celsius), Say("20 °C"));
        Assert.Contains(Say(DEF.Degree.Fahrenheit), Say("70 °F"));
    }

    [Fact]
    public void TheSignWordsAreOneSourceSharedWithTheSymbolTier()
    {
        Assert.Contains(Say(DEF.SignWords.Equals), Say("4 = 4"));
        Assert.Contains(Say(DEF.SignWords.PlusMinus), Say("±5"));
        Assert.Contains(Say(DEF.SignWords.DividedBy), Say("20 ÷ 5"));
        Assert.Contains(Say(DEF.SignWords.Times), Say("4 × 4 tração"));
        Assert.Contains(Say(DEF.SignWords.Ampersand), Say("B&B"));
    }

    [Fact]
    public void EveryOtherLiftedTableIsReachedBySomeReading()
    {
        Assert.Contains(Say(DEF.EraMarkers.BeforeChrist), Say("356 a. C."));
        Assert.Contains(Say(DEF.EraMarkers.AfterChrist), Say("44 d. C."));
        Assert.Contains(Say(DEF.NumberSign), Say("n.º 5"));
        Assert.Contains(Say(DEF.DottedAbbrev["sr"]), Say("O Sr. Silva"));
        Assert.Contains(Say(DEF.Symbols.Percent[0]), Say("50 %"));
        Assert.Contains(Say(DEF.Symbols.Units["km"][1]), Say("5 km"));
        // ⚠ LOWERCASE CONTEXT REQUIRED — an all-uppercase probe trips initialisms.cs's all-caps-DOCUMENT
        // guard and skips the pass, the trap Portuguese.cs's own note records.
        Assert.Contains(Say(DEF.LetterNames["c"]), Say("o CD tocou"));
        Assert.Contains("pl", DEF.Phonotactics.Onsets);
        Assert.Contains("st", DEF.Phonotactics.Codas);
    }
}
