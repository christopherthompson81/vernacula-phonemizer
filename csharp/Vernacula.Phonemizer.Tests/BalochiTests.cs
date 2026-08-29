// Canonical-IPA goldens for Balochi / بلوچی (bal) — Southern Balochi, CROSS-SCRIPT (Arabic + Roman).
// Mirrors test/balochi.test.ts; see that file for the sourcing (Jahani & Korn 2009 + Korn 2005a) and the
// normalization branches.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Balochi;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class BalochiTests
{
    [Fact]
    public void TheCrossScriptLexiconRecoversTheVowelsTheAbjadLoses()
    {
        // "quiet" — abjad skeleton was xaːmuːʃ (و→uː); lexicon restores oː
        Assert.Equal("xaːmoːʃ", BalochiPhonemizer.PhonemizeWord("خاموش"));
        // "poor" — skeleton ɡriːb; lexicon restores the short a
        Assert.Equal("ɡariːb", BalochiPhonemizer.PhonemizeWord("گریب"));
        // "day" — skeleton ruːt͡ʃ; lexicon restores oː
        Assert.Equal("roːt͡ʃ", BalochiPhonemizer.PhonemizeWord("روچ"));
        // "doctor" — retroflex ɖ ʈ; short a restored
        Assert.Equal("ɖaːkʈar", BalochiPhonemizer.PhonemizeWord("ڈاکٹر"));
    }

    [Fact]
    public void TheRomanOrthographyIsPhonemic()
    {
        Assert.Equal("baloːt͡ʃ", BalochiPhonemizer.PhonemizeWord("balōč")); // ō→oː, č→t͡ʃ (Korn)
        Assert.Equal("ɡwaːt̪", BalochiPhonemizer.PhonemizeWord("gwāt")); // "wind" — dental t̪
        Assert.Equal("d̪ast̪", BalochiPhonemizer.PhonemizeWord("dast")); // "hand" — dental d̪ t̪ (ASJP-corroborated)
        Assert.Equal("ɖaːkʈar", BalochiPhonemizer.PhonemizeRoman("ḍākṭar")); // retroflex ḍ→ɖ, ṭ→ʈ
    }

    [Fact]
    public void TheSignatureRetroflexContrastsTheDental()
    {
        Assert.Equal("t͡ʃaːr", BalochiPhonemizer.PhonemizeWord("چار")); // "four" — چ→t͡ʃ (lexicon)
        Assert.Equal("t͡ʃaːr", BalochiPhonemizer.PhonemizeRoman("čār"));
        Assert.Equal("kt̪aːb", BalochiPhonemizer.PhonemizeArabic("کتاب")); // the raw Arabic SKELETON (OOV path)
    }

    [Fact]
    public void TheArabicOovFallsBackToTheDefectiveSkeleton()
    {
        Assert.Equal("bluːt͡ʃst̪aːn", BalochiPhonemizer.PhonemizeArabic("بلوچستان"));
    }

    [Fact]
    public void DotBelowLettersSurviveTheNfcCompose()
    {
        // The normalizer's NFC composes s+̣→ṣ, n+̣→ṇ, l+̣→ḷ, and the precomposed forms must route to the
        // Roman g2p — the Arabic one has no rule for them and deleted the letter.
        Assert.Equal("ʂ", BalochiPhonemizer.PhonemizeWord("ṣ"));
        Assert.Equal("ɳ", BalochiPhonemizer.PhonemizeWord("ṇ"));
        Assert.Equal("ɭ", BalochiPhonemizer.PhonemizeWord("ḷ"));
        Assert.Equal("ɳ", Phonemizer.Phonemize("ṇ", "bal")); // combining form; composed before tokenization
    }

    [Theory]
    // ݔ U+0754 is the Balochi Standard ē — the letter that used to vanish AND split its word.
    [InlineData("وڈݔن", "wɖeːn")]
    [InlineData("بازݔن", "baːzeːn")]
    // The LEXICON branch: نݔمگ respelled نیمگ is a headword, so the reading gains the short vowel the
    // abjad cannot write (neːmaɡ, not the skeleton neːmɡ).
    [InlineData("نݔمگ", "neːmaɡ")]
    public void CappiYaReadsAsLongE(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "bal"));

    [Theory]
    // ۏ U+06CF is ō, and the lexicon-first fold recovers the vowels around it.
    [InlineData("بلۏچ", "baloːt͡ʃ")]
    [InlineData("رۏچ", "roːt͡ʃ")]
    [InlineData("کۏہ", "koːh")]
    // THE FOURTH BRANCH, on the corpus's own جۏڈݔنگ — a word no lexicon entry can reach, in EITHER
    // spelling, and which carries both new letters at once. They still read as oː and eː.
    [InlineData("جۏڈݔنگ", "d͡ʒoːɖeːnɡ")]
    [InlineData("تۏک", "t̪oːk")]
    public void CappiWaReadsAsLongO(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "bal"));

    [Theory]
    // The exact-value folds: ګ ك ي ؤ ہ ډ ټ ړ.
    [InlineData("ګون", "ɡwan")]
    [InlineData("كتاب", "kit̪aːb")]
    [InlineData("جوړ", "d͡ʒuːɽ")]
    public void TheOrthographicVariantsFold(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "bal"));

    [Theory]
    // Arabic presentation forms no longer read as the EMPTY STRING.
    [InlineData("ﻫﻨﺪ", "hnd̪")]
    [InlineData("ﺳﺎﻝ", "saːl")]
    public void ThePresentationFormsRead(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "bal"));

    [Fact]
    public void TheDigitDeGroupingStopsTheTailReadingAsZero()
    {
        Assert.Equal("d̪uwaːzd̪ah hazaːr", Phonemizer.Phonemize("12,000", "bal"));
        Assert.Equal("ʃiʃ lakku pand͡ʒaːhu d̪oː hazaːru haʃt̪ sad̪u ʃast̪",
            Phonemizer.Phonemize("۶۵۲،۸۶۰", "bal"));
        // THE GUARD THAT KEEPS A YEAR LIST OUT: four-digit heads cannot open a match, so the pauses
        // between the years survive.
        Assert.Contains(",", Phonemizer.Phonemize("۱۳۲۷،۱۳۳۷", "bal"));
    }

    [Fact]
    public void TheDecimalPointIsNotAClausePauseAndTheCommaDecimalIsNotClaimed()
    {
        Assert.Equal("d̪oː pant͡ʃ", Phonemizer.Phonemize("2.5", "bal"));
        Assert.Contains(",", Phonemizer.Phonemize("12,5", "bal"));
    }

    [Fact]
    public void TheEraAbbreviationsExpandIncludingTheTatweelForm()
    {
        Assert.Contains("hd͡ʒriː kmriː", Phonemizer.Phonemize("1355ھ. ق.", "bal"));
        Assert.Contains("hd͡ʒriː kmriː", Phonemizer.Phonemize("1373ﻫـ .ﻕ.", "bal"));
        Assert.Contains("piːʃ t͡ʃh miːlaːd̪", Phonemizer.Phonemize("11,000 ق م", "bal"));
        // THE DIGIT ANCHOR IS WHAT KEEPS قم, THE IRANIAN CITY, OUT — it is never digit-adjacent.
        Assert.DoesNotContain("miːlaːd̪", Phonemizer.Phonemize("شارستان قم", "bal"));
    }

    [Fact]
    public void TheSiLengthUnitsRead()
    {
        Assert.Equal("d̪ah kiːluːmt̪r", Phonemizer.Phonemize("10 km", "bal"));
        Assert.Equal("d̪ah mt̪r", Phonemizer.Phonemize("10 m", "bal"));
        Assert.Equal("d̪ah miːliːmt̪r", Phonemizer.Phonemize("10 mm", "bal"));
        // THE LATIN ABBREVIATION IS REAL BALOCHI TYPOGRAPHY — capitalised and glued to Extended
        // Arabic-Indic digits, which is why the match is case-insensitive.
        Assert.Equal("sad̪u d̪ah kiːluːmt̪r", Phonemizer.Phonemize("۱۱۰Km", "bal"));
        // A decimal operand is admitted.
        Assert.Equal("d̪oː pant͡ʃ kiːluːmt̪r", Phonemizer.Phonemize("2.5km", "bal"));
    }

    [Fact]
    public void HectareAndLitreStayRefused()
    {
        Assert.Equal("d̪ah ha", Phonemizer.Phonemize("10 ha", "bal"));
        Assert.Equal("d̪ah l", Phonemizer.Phonemize("10 l", "bal"));
    }
}
