/**
 * Micro-prefixed units, and the arrow between two numbers.
 * Ported from test/english-normalize.test.ts.
 *
 * ⚠ THE DROP WAS A WRONG UNIT, NOT A MISSING WORD — the class normalize.ts ranks worst. `5 µg` had no
 * key, so the sign fell out and the bare `g` reached the initialism pass and was SPELLED: "five gee".
 * A dose read as grams when the page says micrograms is off by a thousand, and nothing in the stream
 * looks wrong.
 */
using Vernacula.Phonemizer.Languages.English;
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

    /// <summary>
    /// ⚠ ⟨µin⟩ IS A WHOLE KEY BECAUSE ⟨in⟩ CANNOT BE ONE — the bare inch is the English PREPOSITION.
    /// Reported as `µin` → "in", the sign DROPPED and the preposition read. The preposition assertions
    /// are the half that keeps the fix honest.
    /// </summary>
    [Theory]
    [InlineData("5 \u00b5in", "5 microinches")]
    [InlineData("1 \u00b5in", "1 microinch")]
    [InlineData("5 \u03bcin", "5 microinches")]
    [InlineData("5 in the morning", "5 in the morning")]
    [InlineData("6 in x 4 in", "6 in x 4 in")]
    public void AMicroInchReadsAndThePrepositionIsUntouched(string text, string expected)
        => Assert.Equal(expected, Normalize.NormalizeEnglish(text));

    /// <summary>
    /// ⚠ THE REPORT ARRIVED BARE — a surface-finish spec column, the same shape that made the slashed
    /// rates need their own arm. A micro sign glued to letters can never be a word.
    /// </summary>
    [Theory]
    [InlineData("\u00b5in", "microinch")]
    [InlineData("Finish: \u00b5in", "Finish: microinch")]
    [InlineData("\u00b5g", "microgram")]
    [InlineData("\u00b5M", "micromolar")]
    [InlineData("\u00b5m", "micro meter")]
    public void AMicroPrefixedUnitStandingAloneReads(string text, string expected)
        => Assert.Equal(expected, Normalize.NormalizeEnglish(text));

    /// <summary>
    /// ⚠ A LONE MU IS STILL THE GREEK LETTER. The bare arm consults the KEY SET rather than matching
    /// `µ\w+`, so the letter standing on its own is not claimed.
    /// </summary>
    [Fact]
    public void ALoneMuIsNotAUnit()
    {
        Assert.Equal("\u00b5 is a Greek letter", Normalize.NormalizeEnglish("\u00b5 is a Greek letter"));
        Assert.Equal("micrometer", Normalize.NormalizeEnglish("micrometer"));
    }

    /// <summary>
    /// ⚠ ⟨µL⟩ IS THE DOMINANT PRINTED SPELLING of the microlitre and is declared only as ⟨µl⟩, so a
    /// case-SENSITIVE bare arm never matched it and put a raw µ into the g2p. Case is
    /// `ResolveUnitSymbol`'s job, not the pattern's — it reads the EXACT written form before folding,
    /// which is why ⟨µM⟩ and ⟨µm⟩ still part company with the flag on.
    /// </summary>
    [Theory]
    [InlineData("\u00b5L", "micro liter")]
    [InlineData("Volume: \u00b5L", "Volume: micro liter")]
    [InlineData("\u00b5M", "micromolar")]
    [InlineData("\u00b5m", "micro meter")]
    public void ABareMicroUnitFoldsCaseButTheCapitalKeysKeepTheirOwnReading(string text, string expected)
        => Assert.Equal(expected, Normalize.NormalizeEnglish(text));

    /// <summary>
    /// ⚠ THE BARE ARM MUST NOT EAT A RATE'S NUMERATOR. It runs before the slash rule, so without a
    /// slash in its lookarounds it claimed the numerator of every micro rate the table does not
    /// enumerate and STRIPPED THE PLURAL that rule documents as load-bearing.
    /// </summary>
    [Theory]
    [InlineData("\u00b5g/kg", "micrograms per kilogram")]
    [InlineData("\u00b5m/s", "micro meters per second")]
    [InlineData("\u00b5g/day", "micrograms per day")]
    [InlineData("5 \u00b5g/kg", "5 micrograms per kilogram")]
    public void AMicroRateKeepsItsNumeratorPlural(string text, string expected)
        => Assert.Equal(expected, Normalize.NormalizeEnglish(text));

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
