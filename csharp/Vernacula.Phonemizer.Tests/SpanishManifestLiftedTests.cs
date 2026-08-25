/**
 * Spanish's word tables come from spanish.jsonc. Derived FROM the manifest, so what these catch is
 * DECOUPLING — a literal re-hardcoded in the code — rather than wrong data.
 * Ported from test/spanish-manifest-lifted.test.ts — see that file for what each table is and is not.
 *
 * ⚠ NO es-419 HERE. The Americas variant is not ported to C#, so the `months` assertion the TS makes
 * against it has no counterpart; the `es` half of that finding is asserted instead.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Spanish;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SpanishManifestLiftedTests
{
    private static SpanishManifest DEF => Manifest.MANIFEST;

    /**
     * ⚠ SPIRANTIZATION IS FOLDED OUT HERE, AND ONLY HERE. Spanish b/d/ɡ → β/ð/ɣ is POST-LEXICAL, so a word
     * phonemized standing alone begins with the STOP while the same word inside a phrase begins with the
     * FRICATIVE. That difference has nothing to do with which WORD the rule chose, which is the only axis
     * these tests are about; the spirantization axis has its own coverage.
     */
    private static string Fold(string ipa) => ipa.Replace("β", "b").Replace("ð", "d").Replace("ɣ", "ɡ");
    private static string Say(string s) =>
        Fold(Phonemizer.Phonemize(s, "es").Replace("ˈ", "").Replace("ˌ", ""));

    [Fact]
    public void AmPmAreComposedFromTheLetterNames()
    {
        // ⚠ CANNOT CATCH ITS OWN DECOUPLING — re-hardcoding "a eme" gives identical output while the data
        // agrees. The guard is the manifest-sabotage sweep; this pins the RELATION.
        string a = DEF.LetterNames["a"], p = DEF.LetterNames["p"], m = DEF.LetterNames["m"];
        Assert.Contains(Say($"{a} {m}"), Say("a las 7:30 a. m."));
        Assert.Contains(Say($"{p} {m}"), Say("a las 10:08 p. m."));
    }

    [Fact]
    public void TheOrdinalTableServesAllThreeCallers()
    {
        var twelfth = DEF.Ordinals.Teens[2]; // duodécimo
        Assert.Contains(Say(twelfth), Say("El 12º puesto"));
        // ⚠ `siglo XII` would NOT do: Spanish reads a century as a CARDINAL (siglo doce).
        Assert.Contains(Say(twelfth), Say("XII aniversario"));
        Assert.Contains(Say(twelfth), Say("1/12 del total"));
        Assert.Contains(Say(DEF.Ordinals.Thousandth), Say("El 1000º día"));
    }

    [Fact]
    public void TheFractionNumeratorIsTheApocopatedUn()
    {
        Assert.NotEqual(DEF.Numbers.Ones[1], DEF.Fractions.NumeratorOne);
        Assert.Contains(Say(DEF.Fractions.NumeratorOne), Say("1/5 del total"));
        Assert.DoesNotContain(Say($"{DEF.Numbers.Ones[1]} "), Say("1/5 del total"));
    }

    [Fact]
    public void TheSuppletiveFractionDenominatorsBeatTheOrdinal()
    {
        Assert.Contains(Say(DEF.Fractions.Denominators["2"]), Say("1/2 de la torta"));
        Assert.Contains(Say(DEF.Fractions.Denominators["3"]), Say("1/3 del total"));
        Assert.Contains(Say(DEF.Ordinals.Units[4]), Say("3/4 de hora"));
    }

    [Fact]
    public void TheClockFeminisesThroughFeminineOne()
    {
        Assert.Contains(Say(DEF.FeminineOne), Say("a la 1:15 de la tarde"));
        Assert.DoesNotContain(Say($" {DEF.Numbers.Ones[1]} "), Say("a la 1:15 de la tarde"));
    }

    [Fact]
    public void MonthsIsDeadInPeninsularSpanish()
    {
        // In Spain the date rule rewrites `1 de enero` to *uno de enero* — what the number path says anyway
        // — and `1º de enero` was already claimed upstream by the ordinal indicator. Only es-419 depends on
        // the table, so a sweep run against `es` alone scores it 0 and would be wrong to call it dead.
        Assert.Contains(Say(DEF.Numbers.Ones[1]), Say("El 1 de enero"));
        Assert.DoesNotContain(Say(DEF.Ordinals.Units[1]), Say("El 1 de enero"));
        Assert.Contains("enero", DEF.Months);
        Assert.Contains("setiembre", DEF.Months); // both spellings of September are matched
    }

    [Fact]
    public void TheSignWordsAreOneSourceSharedWithTheSymbolTier()
    {
        Assert.Contains(Say(DEF.SignWords.Equals), Say("4 = 4"));
        Assert.Contains(Say(DEF.SignWords.PlusMinus), Say("±5"));
        Assert.Contains(Say(DEF.SignWords.DividedBy), Say("20 ÷ 5"));
        Assert.Contains(Say(DEF.SignWords.Times), Say("4 × 4 tracción"));
        Assert.Contains(Say(DEF.SignWords.Ampersand), Say("B&B"));
    }

    [Fact]
    public void TheBareExponentIsThePredicateNotTheUnitModifier()
    {
        Assert.NotEqual(DEF.Symbols.ExponentWords.Squared![0], DEF.Symbols.BareExponent.Squared);
        Assert.Contains(Say("al cuadrado"), Say("20² es el resultado"));
        Assert.Contains(Say(DEF.Symbols.ExponentWords.Squared![1]), Say("25 km² de área"));
    }

    [Fact]
    public void EveryOtherLiftedTableIsReachedBySomeReading()
    {
        Assert.Contains(Say(DEF.EraMarkers.BeforeChrist), Say("356 a. C."));
        Assert.Contains(Say(DEF.EraMarkers.AfterChrist), Say("44 d. C."));
        Assert.Contains(Say(DEF.UnitedStates), Say("EE. UU."));
        Assert.Contains(Say(DEF.NumberSign), Say("n.º 5"));
        Assert.Contains(Say(DEF.DottedAbbrev["sr"]), Say("El Sr. García"));
        Assert.Contains(Say(DEF.Symbols.Percent[0]), Say("50 %"));
        Assert.Contains(Say(DEF.Symbols.Units["km"][1]), Say("5 km"));
        Assert.Contains("pl", DEF.Phonotactics.Onsets);
        Assert.Contains("st", DEF.Phonotactics.Codas);
    }
}
