// The portable half of test/albanian.test.ts — the g2p + stress branches and the normalization defects
// the 200-row golden cannot reach on its own. Canonical-IPA goldens for Standard Albanian (sq) — Shqip
// (Tosk-based), Latin script, its own Indo-European branch. Signature: a rich DIGRAPH system —
// ⟨dh th sh zh xh⟩→[ð θ ʃ ʒ d͡ʒ], the PALATALS ⟨gj⟩→[ɟ] / ⟨q⟩→[c], ⟨nj⟩→[ɲ], ⟨ll⟩→[ɫ] (dark l),
// ⟨rr⟩→[r] (trill) vs ⟨r⟩→[ɾ] (tap); ⟨c⟩→[t͡s], ⟨ç⟩→[t͡ʃ], ⟨x⟩→[d͡z]; the 7-vowel system
// ⟨e⟩→[ɛ], ⟨y⟩→[y], ⟨ë⟩→[ə]. Penultimate stress.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Albanian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class AlbanianTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "sq").Trim();
    private static string Norm(string s) => Normalize.NormalizeAlbanian(s);

    [Theory]
    // The digraph fricatives ⟨dh th sh zh xh⟩ and the palatals ⟨gj⟩→ɟ, ⟨q⟩→c, ⟨nj⟩→ɲ; ⟨ll⟩→ɫ, ⟨rr⟩→r.
    [InlineData("dhe", "ˈðɛ")]
    [InlineData("thikë", "ˈθikə")]
    [InlineData("xhaxha", "ˈd͡ʒad͡ʒa")]
    [InlineData("gjuha", "ˈɟuha")]
    [InlineData("shqip", "ˈʃcip")]
    [InlineData("rrugë", "ˈruɡə")]
    [InlineData("llullë", "ˈɫuɫə")]
    public void ReadsTheAlbanianG2p(string input, string expected) => Assert.Equal(expected, AlbanianPhonemizer.PhonemizeWord(input));

    [Theory]
    // The affricates ⟨c ç x⟩ and the 7-vowel system.
    [InlineData("çaj", "ˈt͡ʃaj")]
    [InlineData("xixë", "ˈd͡zid͡zə")]
    [InlineData("gjysh", "ˈɟyʃ")]
    [InlineData("ëmbël", "ˈəmbəl")]
    public void ReadsTheAffricatesAndTheSevenVowels(string input, string expected) => Assert.Equal(expected, AlbanianPhonemizer.PhonemizeWord(input));

    [Theory]
    // Penultimate stress + maximal-onset syllabification.
    [InlineData("Shqipëri", "ʃciˈpəɾi")]
    [InlineData("qumësht", "ˈcuməʃt")]
    [InlineData("flamur", "ˈflamuɾ")]
    [InlineData("vendlindja", "vɛndˈlindja")]
    public void PlacesThePenultimateStressOnTheMaximalOnset(string input, string expected) => Assert.Equal(expected, AlbanianPhonemizer.PhonemizeWord(input));

    [Theory]
    // Cardinal numbers (albanian.jsonc `numbers` + Numbers.cs). Decimal and regular; the one thing that
    // keeps it off the shared Western composer is the obligatory ⟨e⟩ "and" connector between groups
    // (njëzet e një). ⟨njëzet⟩/⟨dyzet⟩ are vigesimal fossils but round-ten words here.
    [InlineData(0, "zero")]
    [InlineData(1, "një")]
    [InlineData(3, "tre")]
    [InlineData(4, "katër")]
    [InlineData(10, "dhjetë")]
    [InlineData(11, "njëmbëdhjetë")]
    [InlineData(13, "trembëdhjetë")]
    [InlineData(20, "njëzet")]
    [InlineData(21, "njëzet e një")]
    [InlineData(30, "tridhjetë")]
    [InlineData(40, "dyzet")]
    [InlineData(42, "dyzet e dy")]
    [InlineData(99, "nëntëdhjetë e nëntë")]
    [InlineData(100, "njëqind")]
    [InlineData(101, "njëqind e një")]
    [InlineData(300, "treqind")]
    [InlineData(555, "pesëqind e pesëdhjetë e pesë")]
    [InlineData(1000, "një mijë")]
    [InlineData(1001, "një mijë e një")]
    [InlineData(2000, "dy mijë")]
    [InlineData(12345, "dymbëdhjetë mijë e treqind e dyzet e pesë")]
    [InlineData(1000000, "një milion")]
    [InlineData(2000000, "dy milionë")]
    [InlineData(1000000000, "një miliard")]
    public void ComposesTheCardinals(double n, string expected) => Assert.Equal(expected, Numbers.NumberToWords(n));

    [Fact]
    public void NoDigitLeakSentinelOrGapAcrossTwentyThousand()
    {
        for (var n = 0; n <= 20000; n++)
            Assert.Matches("^[^0-9]*$", Numbers.NumberToWords(n));
        Assert.DoesNotContain("undefined", Numbers.NumberToWords(20000));
        Assert.DoesNotContain("NaN", Numbers.NumberToWords(20000));
    }

    [Fact]
    public void TheNumeralIsPhonemizedNotSpelledOutDigitWise()
    {
        // njëzet e një — ⟨e⟩ is its own word [ˈɛ]
        Assert.Equal("ˈɲəzɛt ˈɛ ˈɲə", Say("21"));
        Assert.Equal("ˈɲə miˈlion", Say("1000000"));
    }

    [Fact]
    public void ThreeDigitsAfterTheSeparatorIsAGroupOneOrTwoIsADecimal()
    {
        // comma grouping — the value was being read as TWO numbers with a pause between them
        Assert.Equal("ˈɲəcind ˈɛ ˈðjɛtə ˈmijə ˈɛ nəˈntəcind ˈɛ nəntəˈðjɛtə ˈɛ ˈkatəɾ kiloˈmɛtɾa",
            Say("110,994 kilometra"));
        // period grouping, and `000` was reading as a single *zero*
        Assert.Equal("ˈtɾɛcind ˈmijə ˈvjɛt", Say("300.000 vjet"));
        // space grouping
        Assert.Equal("ˈɲəzɛt ˈmijə", Say("20 000"));
        // ...and one or two digits is a decimal, through either mark
        Assert.Contains("ˈpɾɛsja", Say("41.33"));
        Assert.Contains("ˈpɾɛsja", Say("38,3"));
    }

    [Fact]
    public void AGroupSurvivesAClauseMarkAndItsOwnDecimalTail()
    {
        Assert.Equal("pɛsəˈðjɛtə ˈmijə .", Say("50 000."));
        Assert.Contains("ˈpɾɛsja", Say("1,110.03 km²"));
        // ⚠ A DOTTED DATE needs no special case: de-grouping wants three-digit groups and the decimal rule's
        // trailing guard refuses `30.04` because a period follows. It survives untouched.
        Assert.DoesNotContain("ˈpɾɛsja", Say("30.04.1993"));
    }

    [Fact]
    public void TheSignTheSeparatorTheDegreeAndItsScaleAllSurviveOneFigure()
    {
        // ⚠ `-38,3 °C` CARRIED FOUR DEFECTS AT ONCE — the minus dropped so a record LOW read as a high,
        // the comma taken for a clause pause, the degree sign dropped, and ⟨C⟩ read as Albanian /t͡s/.
        Assert.Equal("ˈminus tɾiˈðjɛtə ˈɛ ˈtɛtə ˈpɾɛsja ˈtɾɛ ˈɡɾadə t͡sɛlˈsius", Say("-38,3 °C"));
        // ⚠ DO NOT SAY IT TWICE (trap 12): the corpus writes the scale name as a word beside the sign, and
        // the scale letter needs a LETTER BOUNDARY or it eats the ⟨C⟩ of *Celsius* and adds a second one.
        Assert.Equal("ˈplus ˈʃtatə ˈɡɾadə t͡sɛlˈsius", Say("+7° Celsius"));
    }

    [Fact]
    public void SignsAndUnitsPercentIsPostposedAndTheUnitIsNotAFakeWord()
    {
        Assert.Equal("ʃtatəˈðjɛtə ˈɛ ˈpɛsə ˈpəɾ ˈcind", Say("75 %"));
        Assert.Equal("ˈɲəzɛt ˈɛ ˈpɛsə t͡sɛntiˈmɛtɾa", Say("25 cm"));
        Assert.Equal("ˈdy ɛˈuɾo", Say("€2"));
        Assert.Contains("ˈdɛɾi", Say("45-55°"));
        // ⟨km2⟩ is ⟨km²⟩ with the superscript lost — unfolded, the unit fails and `km` reaches the IPA raw
        Assert.Contains("kiloˈmɛtɾa kaˈtɾoɾə", Say("349,223 km2"));
        Assert.Contains("ˈpəɾ ˈmijə", Say("999 ‰ ar"));
    }

    [Fact]
    public void ALeadingZeroInTheFractionIsNotSwallowed()
    {
        Assert.NotEqual(Say("5.09"), Say("5.9"));
    }

    [Fact]
    public void AZeroHeadedFigureIsADecimalNeverAThousandsGroup()
    {
        // `\d{1,3}` as the group head made `0,375` de-group to `0375`, which the number path reads as 375 —
        // a probability or precision figure spoken a THOUSAND times too large, with nothing leaked.
        Assert.Contains("ˈpɾɛsja", Say("0,375"));
        Assert.Contains("ˈpɾɛsja", Say("p = 0,001"));
        Assert.Contains("ˈpɾɛsja", Say("0.500 g"));
    }

    [Fact]
    public void AnySeparatorSurvivingDeGroupingIsADecimalWhateverTheFractionsLength()
    {
        // a 1–2 digit guard dropped π, which then read as two numbers with a sentence break between them
        Assert.DoesNotContain(".", Say("3.14159").Split(' '));
        Assert.Contains("ˈpɾɛsja", Say("3.14159"));
    }

    [Fact]
    public void TheLoanUnitsTakeTheirAttestedSingularNotAnInventedPlural()
    {
        // ⚠ NO FORM TO TAKE, ONLY ONE TO INVENT — `megabajtë` is `absent` in the attestation artifact
        // (0 tok / 0 arts) and the corpus writes the SINGULAR after every count, so both count forms are
        // the singular.
        Assert.Equal("tɾiˈðjɛtə ˈɛ ˈdy mɛˈɡabajt", Say("32MB"));
        Assert.Contains("mɛˈɡahɛɾt͡s", Say("714 MHz"));
    }

    [Fact]
    public void ASpacedPlusLeavesNoGap()
    {
        // ⚠ The plus rule must CONSUME the space it looks over, or it emits the SLOT-GAP double space.
        Assert.Equal("ˈplus ˈɲəzɛt ˈɛ ˈkatəɾ ˈɡɾadə t͡sɛlˈsius", Say("+ 24° Celsius"));
    }

    [Fact]
    public void TheDecimalFractionReadsLeadingZerosDigitByDigit()
    {
        // ⚠ A LEADING ZERO IN THE FRACTION IS SPOKEN: reading the fraction as a NUMBER would make `5.09`
        // and `5.9` identical, because `Number("09")` is 9.
        Assert.Equal("5 presja zero 9", Norm("5.09"));
        Assert.Equal("0 presja zero zero 1", Norm("0,001"));
    }
}
