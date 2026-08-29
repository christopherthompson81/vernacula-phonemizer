// The portable half of test/belarusian.test.ts — the g2p branches and the normalization defects
// the 200-row golden cannot reach on its own. Canonical-IPA goldens for Belarusian (be) — East Slavic,
// Cyrillic. Rule g2p mirroring Ukrainian's iotated/palatalisation machinery, plus the Belarusian
// signatures: г→ɣ, retroflex ж/ш/ч→ʐ/ʂ/t͡ʂ, ⟨і⟩ iotated (Іван→jivan), ⟨ў⟩→u̯/w, дз/дж affricates,
// dark л→ɫ, and — unlike Ukrainian — regressive voicing + final devoicing (akanne is spelled → no
// stress dict).
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Belarusian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class BelarusianTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "be").Trim();
    private static string Norm(string s) => Normalize.NormalizeBelarusian(s);

    [Theory]
    // Core segments: г→ɣ, dark л→ɫ, ы→ɨ, retroflex ч→t͡ʂ; akanne spelled → no reduction.
    [InlineData("вада", "vada")]
    [InlineData("галава", "ɣaɫava")]
    [InlineData("чалавек", "t͡ʂaɫavʲek")]
    [InlineData("яблык", "jabɫɨk")]
    public void ReadsTheCoreSegments(string input, string expected) =>
        Assert.Equal(expected, BelarusianPhonemizer.PhonemizeWord(input));

    [Theory]
    // ⟨і⟩ is iotated (word-initial → ji); soft vowels palatalise the consonant.
    [InlineData("Іван", "jivan")]
    [InlineData("ён", "jon")]
    [InlineData("дзень", "d͡zʲenʲ")]
    [InlineData("люблю", "lʲublʲu")]
    public void TheIIsIotatedAndSoftVowelsPalatalise(string input, string expected) =>
        Assert.Equal(expected, BelarusianPhonemizer.PhonemizeWord(input));

    [Theory]
    // ⟨ў⟩→u̯ after a vowel, w otherwise; the apostrophe breaks C+iotated adjacency → [j]V.
    [InlineData("воўк", "vou̯k")]
    [InlineData("ўзяць", "wzʲat͡sʲ")]
    [InlineData("сям'я", "sʲamja")]
    public void TheShortUAndTheApostrophe(string input, string expected) =>
        Assert.Equal(expected, BelarusianPhonemizer.PhonemizeWord(input));

    [Theory]
    // Final devoicing + regressive voicing/palatalisation; в does NOT devoice to [f] (it vocalises).
    [InlineData("горад", "ɣorat")]
    [InlineData("хлеб", "xlʲep")]
    [InlineData("снег", "sʲnʲex")]
    [InlineData("везці", "vʲesʲt͡sʲi")]
    [InlineData("абразлівы", "abrazʲlʲivɨ")]
    [InlineData("нерв", "nʲerv")]
    public void VoicingFinalDevoicingAndRegressivePalatalisation(string input, string expected) =>
        Assert.Equal(expected, BelarusianPhonemizer.PhonemizeWord(input));

    [Fact]
    public void RegistryWiring() => Assert.Equal("mova ʐɨvʲe .", Phonemizer.Phonemize("Мова жыве.", "be"));

    [Theory]
    // The cardinal path through the engine's number branch.
    [InlineData("0", "nulʲ")]
    [InlineData("5", "pʲat͡sʲ")]
    [InlineData("21", "dvat͡sːat͡sʲ ad͡zʲin")]
    [InlineData("100", "sto")]
    [InlineData("1000", "tɨsʲat͡ʂa")]
    [InlineData("2000", "d͡zʲvʲe tɨsʲat͡ʂɨ")]
    [InlineData("5000", "pʲat͡sʲ tɨsʲat͡ʂ")]
    [InlineData("21000", "dvat͡sːat͡sʲ adna tɨsʲat͡ʂa")]
    [InlineData("1000000", "ad͡zʲin mʲilʲjon")]
    [InlineData("2000000", "dva mʲilʲjonɨ")]
    public void ComposesTheCardinalsWithMagnitudeAgreement(string digits, string expected) =>
        Assert.Equal(expected, Say(digits));

    [Theory]
    // Digit de-grouping first — the largest wrong-magnitude defect: `3 000 000` read as *тры нуль нуль*.
    [InlineData("3 000 000", "trɨ mʲilʲjonɨ")]
    [InlineData("31 800", "trɨt͡sːat͡sʲ adna tɨsʲat͡ʂa vosʲemsot")]
    public void DigitDeGroupingSpansTheGroupingSpace(string input, string expected) =>
        Assert.Equal(expected, Say(input));

    [Theory]
    // The degree letter may be Cyrillic or LATIN — both ⟨C⟩ and ⟨С⟩, different characters that render
    // identically, and the Latin one is what made `+28 °C` read as the English letter name.
    [InlineData("+28 °C", "плюс 28 градусаў Цэльсія")]
    [InlineData("+28 °С", "плюс 28 градусаў Цэльсія")]
    [InlineData("−16 °C", "мінус 16 градусаў Цэльсія")]
    public void TheDegreeCarriesBothSpellingsOfTheLetter(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Fact]
    public void TheDegreeThroughTheWholePipeline() =>
        Assert.Equal("plʲus dvat͡sːat͡sʲ vosʲem ɣradusau̯ t͡sɛlʲsʲija", Say("+28 °C"));

    [Theory]
    // The dot decimal folds to the comma form the engine's number token reads; a LETTER after the
    // fraction is the known misfire (a train model) and is declined.
    [InlineData("74.2 %", "74,2 %")]
    [InlineData("81-717.5М", "81 да 717.5М")]
    public void TheDotDecimalFoldsToTheCommaForm(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The ordinal notation: the table, the composed tens, the thousand stem, and the OBLIQUE CARDINAL
    // that shares the same notation. A suffix no paradigm produces leaves the text alone.
    [InlineData("1-ы", "першы")]
    [InlineData("4-га", "чацвёртага")]
    [InlineData("7-е месца", "сёмае месца")]
    [InlineData("30-ай", "трыццатай")]
    [InlineData("2000-я гады", "двухтысячныя гады")]
    [InlineData("2010-х", "дзве тысячы дзясятых")]
    [InlineData("1950-х", "тысяча дзевяцьсот пяцідзясятых")]
    [InlineData("з 28-мі краін", "з дваццаці васьмі краін")]
    [InlineData("28-гадовы", "28-гадовы")]
    public void TheOrdinalNotationAndTheObliqueCardinal(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The digit-anchored year abbreviation; the RATE rule runs first, or `км/г.` loses its hour to the
    // year rule. `г.` and `с.` and `т.` are deliberately NOT dotted abbreviations — each is a different
    // word in this corpus.
    [InlineData("1991 г.", "1991 года")]
    [InlineData("2014-2016 гг.", "2014 да 2016 гадоў")]
    [InlineData("574,8 км/г.", "574,8 кіламетраў на гадзіну.")]
    [InlineData("552 с.", "552 с.")]
    [InlineData("БЭ ў 18 т.", "БЭ ў 18 т.")]
    public void TheYearAbbreviationAndTheThreeLettersThatMeanSomethingElse(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The multi-dot abbreviations, and the sentence-final dot that survives.
    [InlineData("У 438 г. н.э.", "У 438 года нашай эры.")]
    [InlineData("да н.э.", "да нашай эры.")]
    [InlineData("Python, Ruby і г.д.", "Python, Ruby і гэтак далей.")]
    [InlineData("нар. 1920", "нарадзіўся 1920")]
    public void TheMultiDotAbbreviations(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The magnitude abbreviations, with the form the numeral governs (the decimal takes the genitive
    // singular, which is a fourth slot the three-way selector cannot express).
    [InlineData("16 млрд долараў", "16 мільярдаў долараў")]
    [InlineData("2,5 млн", "2,5 мільёна")]
    [InlineData("3 млн", "3 мільёны")]
    public void TheMagnitudeAbbreviationsWithCountAgreement(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The signs — `=` REQUIRES A DIGIT ON ONE SIDE (the bibliographic title separators), `±` is one
    // character no `+` rule can reach inside, and the true MINUS (U+2212) is in the minus class.
    [InlineData("фунт стэрлінгаў = 100 пенсаў", "фунт стэрлінгаў ёсць 100 пенсаў")]
    [InlineData("Запісы = Zapisy", "Запісы = Zapisy")]
    [InlineData("2 < 5", "2 менш за 5")]
    [InlineData("5 > 2", "5 больш за 2")]
    [InlineData("(0,28±0,04)", "(0,28 плюс-мінус 0,04)")]
    public void TheRelationalAndDivisionSigns(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // Ranges read `да`; NOTHING may be required after the second number (`на глыбіні 100—200 м.` is how
    // this corpus ends a sentence), and the digit is required on BOTH sides so `COVID-19` cannot match.
    [InlineData("10—20 мм", "10 да 20 мм")]
    [InlineData("1-3 працоўных дзён", "1 да 3 працоўных дзён")]
    public void RangesReadDaAndSurviveTheClauseFinalFullStop(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Fact]
    public void TheClauseFinalRangeThroughThePipeline() =>
        Assert.Equal("sto da d͡zʲvʲesʲt͡sʲe mʲetrau̯ .", Say("100—200 м."));

    [Theory]
    // Fractions are BOUNDED AT A DENOMINATOR OF TEN — every `\d+/\d+` in the corpus is an ALTERNATIVE
    // DATE, and the bound is the evidence. The denominator AGREES WITH THE NUMERATOR.
    [InlineData("1/3", "адна трэцяя")]
    [InlineData("2/5", "дзве пятыя")]
    [InlineData("673/674", "673/674")]
    [InlineData("285/286", "285/286")]
    [InlineData("64/67", "64/67")]
    public void TheFractionsBoundedAtTenAndTheAlternativeDatesDeclined(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The clock: the hour as a cardinal followed by the minutes; a `:00` minute reads no *нуль*; two-
    // digit minutes are REQUIRED; a third field means a timestamp, and the colons are spent on spaces.
    [InlineData("10:30", "дзесяць трыццаць")]
    [InlineData("23:59", "дваццаць тры пяцьдзесят дзевяць")]
    [InlineData("06:00", "шэсць")]
    [InlineData("11:12:01", "11 12 01")]
    public void TheClockAndTheThreeFieldTimestamp(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // Three-way Slavic agreement through the symbol tier — the decimal governs the GENITIVE SINGULAR,
    // a fourth form.
    [InlineData("70 %", "sʲemd͡zʲesʲat prat͡sɛntau̯")]
    [InlineData("21 %", "dvat͡sːat͡sʲ ad͡zʲin prat͡sɛnt")]
    [InlineData("22 %", "dvat͡sːat͡sʲ dva prat͡sɛntɨ")]
    [InlineData("5,3 %", "pʲat͡sʲ koska trɨ prat͡sɛnta")]
    [InlineData("$ 300", "trɨsta doɫarau̯")]
    [InlineData("100 кг", "sto kʲiɫaɣramau̯")]
    [InlineData("12,5 км", "dvanat͡sːat͡sʲ koska pʲat͡sʲ kʲiɫamʲetra")]
    public void TheSymbolTierThreeWayAgreement(string input, string expected) =>
        Assert.Equal(expected, Say(input));

    [Theory]
    // The exponent adjective goes BEFORE the noun (the East-Slavic shape), and the BARE power is the
    // sourced `у квадраце` (only `squared` is declared, and the asymmetry is the evidence).
    [InlineData("10 км²", "d͡zʲesʲat͡sʲ kvadratnɨx kʲiɫamʲetrau̯")]
    [InlineData("5²", "pʲat͡sʲ u kvadrat͡sʲe")]
    public void TheExponentBeforeTheNounAndTheBarePower(string input, string expected) =>
        Assert.Equal(expected, Say(input));

    [Fact]
    // The multiplication article reads the notation aloud in the SHORT register.
    public void TheMultiplicationSign() =>
        Assert.Equal("d͡zʲvʲesʲt͡sʲe sʲemd͡zʲesʲat na vasʲamnat͡sːat͡sʲ mʲetrau̯", Say("270×18 метраў"));

    [Theory]
    // Initialisms are spelled, not read as consonant clusters.
    [InlineData("ЗША", "zɛ ʂa a")]
    [InlineData("СССР", "ɛs ɛs ɛs ɛr")]
    [InlineData("ВУП", "vɛ u pɛ")]
    public void TheInitialismsAreSpelled(string input, string expected) =>
        Assert.Equal(expected, Say(input));

    [Theory]
    // The century is a NEUTER ordinal (стагоддзе is neuter), and only the LAST element inflects.
    [InlineData(19, "дзевятнаццатае")]
    [InlineData(20, "дваццатае")]
    [InlineData(21, "дваццаць першае")]
    public void TheRomanOrdinalsAreNeuter(int n, string expected) =>
        Assert.Equal(expected, RomanOrdinals.Ordinal(n));

    [Fact]
    // THROUGH `phonemize`, NOT THE RAW ENGINE: the roman pass runs at the registry seam, so it sees the
    // RAW `ст.` and not the `стагоддзя` normalize.ts step 4 later expands it to.
    public void TheRomanPolicyFiresOnTheAbbreviationNotOnlyTheExpandedForm()
    {
        Assert.Equal("d͡zʲevʲatnat͡sːataje staɣodː͡zʲa .", Say("XIX ст."));
        Assert.Equal("d͡zʲevʲatnat͡sːataje staɣodː͡zʲe", Say("XIX стагоддзе"));
        // `век` is excluded from the context on purpose — the table is neuter and `век` is masculine.
        Assert.Equal("dvat͡sːat͡sʲ vʲek", Say("XX век"));
    }
}
