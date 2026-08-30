/**
 * The portable half of test/karakalpak.test.ts — Karakalpak (kaa), Kipchak Turkic (close to Kazakh), the
 * 2016 LATIN alphabet. Signatures: the WRITTEN uvular series ⟨q⟩→[q] / ⟨x⟩→[χ] / ⟨ǵ⟩→[ʁ] (vs velar
 * ⟨k g⟩ / ⟨h⟩), the acute FRONT vowels ⟨á ó ú⟩→[æ ø y] (vs back ⟨a o u⟩), the dotless ⟨ı⟩→[ɯ],
 * ⟨ń⟩→[ŋ], ⟨j⟩→[ʒ], and word-final stress.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Karakalpak;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KarakalpakTests
{
    private static string Word(string s) => KarakalpakPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "kaa").Trim();
    private static string Norm(string s) => Normalize.NormalizeKarakalpak(s);

    [Theory]
    // THE WRITTEN uvular series ⟨q x ǵ⟩ + final stress.
    [InlineData("qaraqalpaq", "qɑrɑqɑlˈpɑq")] // the endonym — ⟨q⟩→[q] uvular throughout, ⟨a⟩→[ɑ]
    [InlineData("xalıq", "χɑˈlɯq")]            // 'people' — ⟨x⟩→[χ] uvular, dotless ⟨ı⟩→[ɯ]
    [InlineData("ǵárezsizlik", "ʁærezsizˈlik")] // ⟨ǵ⟩→[ʁ] uvular voiced, ⟨á⟩→[æ]
    [InlineData("basqa", "bɑsˈqɑ")]            // ⟨q⟩→[q]; final stress backs up one onset consonant
    public void TheWrittenUvularSeries(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // THE acute FRONT vowels ⟨á ó ú⟩ vs back ⟨a o u⟩; ⟨ı⟩→ɯ.
    [InlineData("ásir", "æˈsir")]      // ⟨á⟩→[æ]
    [InlineData("sózlik", "søzˈlik")]  // ⟨ó⟩→[ø]
    [InlineData("úsh", "ˈyʃ")]         // ⟨ú⟩→[y], ⟨sh⟩→[ʃ]
    [InlineData("juldız", "ʒulˈdɯz")]   // ⟨j⟩→[ʒ], dotless ⟨ı⟩→[ɯ]
    public void TheFrontVowels(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨ń⟩→ŋ, ⟨w⟩→w, and the Turkish-style dotless-I casing.
    [InlineData("máńgi", "mæŋˈɡi")]    // ⟨ń⟩→[ŋ]
    [InlineData("suw", "ˈsuw")]        // ⟨w⟩→[w]
    [InlineData("Ishan", "ɯˈʃɑn")]     // capital dotless ⟨I⟩→[ɯ] (NOT dotted [i]) — Turkish-I casing
    [InlineData("ISHAN", "ɯˈʃɑn")]     // all-caps too
    public void DotlessICasing(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // NUMBERS — Turkic decimal in the 2016 Latin orthography.
    [InlineData("7", "ʒeˈti")]                 // jeti — the Kipchak j- Nogai has lost
    [InlineData("11", "ˈon ˈbir")]             // on bir — teens are two words
    [InlineData("25", "ʒiɡirˈmɑ ˈbes")]        // jigirma bes
    [InlineData("100", "ˈʒyz")]                // júz — the multiplier "bir" is dropped
    [InlineData("555", "ˈbes ˈʒyz eˈliw ˈbes")] // bes júz eliw bes — ⟨eliw⟩ 50 (the -w form, cf. Kazakh елу)
    [InlineData("1984", "ˈmɯŋ toˈʁɯz ˈʒyz sekˈsen ˈtørt")]
    [InlineData("12345", "ˈon eˈki ˈmɯŋ ˈyʃ ˈʒyz ˈqɯrq ˈbes")]
    [InlineData("1000000", "ˈbir milliˈon")]   // bir million
    public void TheNumbers(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // text() tokenizes both capital ⟨I⟩ (dotless) and ⟨İ⟩ (dotted).
    public void TheDottedCapital()
    {
        // ⟨İ⟩ (U+0130) is the Karakalpak capital of ⟨i⟩ — it must survive tokenization (not drop the /i/).
        Assert.Equal("iˈʃɑn", Say("İshan")); // dotted capital → [i]
        Assert.Equal("ɯˈʃɑn", Say("Ishan")); // dotless capital → [ɯ]
    }

    [Fact]
    // ⚠ the EM-DASH is a COPULA, not a minus — and one clause carries both marks.
    public void TheEmDashIsACopula()
    {
        Assert.Equal("Ortasha jas — 31 3", Norm("Ortasha jas — 31,3"));
        Assert.Equal("Temirjollardıń uzınlıǵı — 3 9 mıń kilometr",
            Norm("Temirjollardıń uzınlıǵı — 3,9 mıń km"));
        Assert.Equal("temperaturası — 2 gradus den minus 3 gradus ge shekem",
            Norm("temperaturası — 2 °C den -3 °C ge shekem"));
    }

    [Fact]
    // the comma groups AND decimates, and so does the dot.
    public void TheGroupingAndDecimals()
    {
        Assert.Equal("19605052", Norm("19,605,052"));
        Assert.Equal("1500 kilometr", Norm("1,500 km"));
        Assert.Equal("18 7", Norm("18,7")); // no decimal word is sourceable — neutralised
        Assert.Equal("1 65", Norm("1.65"));
        // ⚠ exactly ONE dot in the run is what tells a decimal from an IP address or a dotted date
        Assert.Equal("198.51.100.0", Norm("198.51.100.0"));
        Assert.Equal("26.02.1994 jıl", Norm("26.02.1994-j."));
    }

    [Fact]
    // ⚠ the percent sign takes a case suffix, attached or detached.
    public void ThePercentCaseSuffix()
    {
        Assert.Equal("96 procentin", Norm("96%in"));
        Assert.Equal("50 procentten 80 procentke", Norm("50% ten 80% ke"));
        Assert.Equal("14 procenti jasaydı", Norm("14% i jasaydı"));
    }

    [Fact]
    // ⚠ `+` is the name of a programming language — the DIGIT lookahead separates the senses.
    public void ThePlusGuard()
    {
        Assert.Equal("C++ tilin", Norm("C++ tilin"));
        Assert.Equal("C++11 (14882:2011)", Norm("C++11 (14882:2011)"));
        Assert.Equal("(plyus 40 plyus 45 gradus)", Norm("(+40+45 °C)"));
        // …and the paired arm is gated on a following degree, or a 6-to-90 mm span reads as an addition
        Assert.Equal("diametri 6+90 millimetr", Norm("diametri 6+90 mm"));
    }

    [Fact]
    // ⚠ the corpus glosses its own degree sign, and the scale letter may be CYRILLIC.
    public void TheDegreeGlossAndCyrillicScale()
    {
        // ⚠ without the degree sign the paired arm correctly does NOT fire — the gate is `°`/`gradus`
        // immediately after the digits, and a Cyrillic scale letter in between is not that.
        Assert.Equal("plyus 15+20С gradus", Norm("+15+20\u0421 gradus"));
        Assert.Equal("plyus 15 plyus 20 gradus", Norm("+15+20\u00b0\u0421 gradus"));
        Assert.Equal("4 4 gradus", Norm("4,4\u00b0C"));
        Assert.Equal("(minus 32 minus 38 gradus)", Norm("(-32-38 \u00b0C)"));
    }

    [Fact]
    // the era marker, the magnitude abbreviations, and the two-token square measures.
    public void TheEraMarkerAndAbbreviations()
    {
        Assert.Equal("biziń eramızǵa shekem 776-jılı", Norm("b.e.sh. 776-jılı"));
        Assert.Equal("21 million jılı", Norm("21 mln. jılı"));
        Assert.Equal("23 3 milliard kilovatt saat", Norm("23,3 mlrd. kvt/saat"));
        // ⚠ these run BEFORE the tier, or it rewrites the `m` of `8 m.kv.` and strands `.kv.`
        Assert.Equal("8 kvadrat metr maydan", Norm("8 m.kv. maydan"));
        Assert.Equal("23 2 adam/1 kvadrat kilometr", Norm("23,2 adam/1 km kv"));
        Assert.Equal("Suyıqlanıw temperaturası 323 gradus ", Norm("Suyıqlanıw t-rası 323°"));
    }

    [Fact]
    // the clock, and the hour bound that declines a standard number.
    public void TheClock()
    {
        Assert.Equal("saat 8 00 de", Norm("saat 8:00 de"));
        Assert.Equal("saat 12 13 05 de", Norm("saat 12:13:05 de"));
        Assert.Equal("ISO/IEC 14882:2024", Norm("ISO/IEC 14882:2024"));
    }

    [Fact]
    // the whole pipeline.
    public void TheWholePipeline()
    {
        Assert.Equal("\u02c8\u0292yz \u02c8m\u026f\u014b dol\u02c8l\u0251r investikij\u0251\u02c8s\u026f",
            Say("$100,000 investiciyası"));
        Assert.Contains("milli\u02c8metr", Say("150 mm ge shekem"));
    }
}
