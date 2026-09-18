/**
 * Micro-prefixed units, and the arrow between two numbers.
 * Ported from test/english-normalize.test.ts.
 *
 * ⚠ THE DROP WAS A WRONG UNIT, NOT A MISSING WORD — the class normalize.ts ranks worst. `5 µg` had no
 * key, so the sign fell out and the bare `g` reached the initialism pass and was SPELLED: "five gee".
 * A dose read as grams when the page says micrograms is off by a thousand, and nothing in the stream
 * looks wrong.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishMicroUnitTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    /// <summary>
    /// U+00B5 MICRO SIGN and U+03BC GREEK SMALL LETTER MU. Neither folds to the other, and across the
    /// mined corpora the GREEK one outnumbers the micro sign 490 to 14 — so both are declared.
    /// </summary>
    [Theory]
    [InlineData("a 5 µg dose")]
    [InlineData("a 5 μg dose")]
    public void MicroIsReadFromBothCodePoints(string text)
    {
        Assert.Contains("mˈaᶦkɹoᶷɡɹˌæmz", Say(text));
        Assert.DoesNotContain("ʤˈiː", Say(text));   // not "five gee"
    }

    [Fact]
    public void CountAgreementAndTheSlashedChains()
    {
        Assert.Contains("mˈaᶦkɹoᶷɡɹˌæm", Say("1 µg"));
        Assert.DoesNotContain("ɡɹˌæmz", Say("1 µg"));
        // the denominator must be a key too, or the tail strands and reaches the g2p as letters
        Assert.Contains("pʰɝ mˈɪləlˌiːt̬ɚ", Say("94 μg/mL"));
        Assert.Contains("pʰɝ lˈiːt̬ɚ", Say("25 µmol/L"));
    }

    /// <summary>
    /// ⚠ TWO WORDS ON PURPOSE — "micrometer" is recorded as the CALIPER and "microliter" comes out with
    /// an unstressed `li`. gram, second and mole need no such help. See normalize.ts.
    /// </summary>
    [Theory]
    [InlineData("6 μm wide", "mˈaᶦkɹoᶷ mˈiːt̬ɚz")]
    [InlineData("2 µL sample", "mˈaᶦkɹoᶷ lˈiːt̬ɚz")]
    public void TheTwoUnitsWhoseSingleWordSpellingReadsWrong(string text, string expected)
        => Assert.Contains(expected, Say(text));

    /// <summary>
    /// ⚠ THE CAPITALS ARE DIFFERENT UNITS, and this case was REGRESSED BY THE FIX ITSELF before it was
    /// caught: `25 µM` (micromolar) folded to `µm` and read "micro METERS", turning a merely-dropped
    /// symbol into a wrong unit. ⟨L⟩ is not such a case — µL and µl are the same unit.
    /// </summary>
    [Fact]
    public void TheCapitalsAreDifferentUnits()
    {
        // ⚠ `…lɚ`, not `…ləɹ`: the `molar` row was written M OW1 L AH0 R, which is the AH0-R spelling of ɚ,
        // and the triple-source audit corrected it to M OW1 L ER0 (/ˈmoʊlɚ/ is not in question). The vowel
        // is incidental to what this pins — that ⟨µM⟩ is micromolar and not micro-METERS.
        Assert.Contains("mˈaᶦkɹoᶷmˌoᶷlɚ", Say("a 25 \u00b5M solution"));
        Assert.Contains("mˈaᶦkɹoᶷmˌoᶷlɚ", Say("a 25 \u03bcM solution"));
        Assert.DoesNotContain("mˈiːt̬ɚz", Say("a 25 \u00b5M solution"));
        Assert.Contains("mˈaᶦkɹoᶷsˌiːmənz", Say("5 \u00b5S conductance"));
        Assert.Contains("mˈaᶦkɹoᶷsˌɛkəndz", Say("5 \u00b5s delay"));
        Assert.Contains("mˈaᶦkɹoᶷ lˈiːt̬ɚz", Say("2 \u00b5L sample"));
    }

    /// <summary>A bare mu is still the Greek letter — the gate is the preceding number.</summary>
    [Fact]
    public void ABareMuIsUntouched()
        => Assert.DoesNotContain("mˈaᶦkɹoᶷ", Say("μ is a Greek letter"));

    /// <summary>
    /// An arrow between two numbers is a transition, read the way the dash range is. Digit-gated:
    /// between words the reading is contested, and a missing word beats a wrong one.
    /// </summary>
    [Fact]
    public void AnArrowBetweenNumbersSaysTo()
    {
        Assert.Equal("sɪkstˈiːn tʰuː twˈɛnti ˈeᶦt ˈaᶷɚz", Say("16 → 28 hours"));
        Assert.DoesNotContain("tʰuː", Say("input → output"));
    }
}
