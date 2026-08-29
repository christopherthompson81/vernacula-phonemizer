/**
 * Crimean Tatar (crh) — qırımtatar tili, KIPCHAK Turkic with strong Oghuz influence, written in a
 * Turkish-based Latin alphabet that is highly phonemic: no digraphs (⟨ç ş ñ ğ⟩ are single letters),
 * spelled vowel harmony, ⟨q⟩→[q] against ⟨k⟩→[k] and ⟨ğ⟩→[ɣ] against ⟨g⟩→[ɡ]. The engine is a
 * left-to-right grapheme scan with gemination and word-final (oxytone) stress.
 *
 * The portable half of test/crimeantatar.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.CrimeanTatar;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class CrimeanTatarTests
{
    private static string Word(string s) => CrimeanTatarPhonemizer.PhonemizeWord(s);
    private static string Norm(string s) => Normalize.NormalizeCrimeanTatar(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "crh").Trim();

    [Theory]
    // ⚠ THE TURKISH-STYLE DOTLESS-I CASING: the capital ⟨I⟩ must lowercase to ⟨ı⟩=[ɯ], not to dotted
    // ⟨i⟩=[i]. A plain lowercase would give the wrong vowel for every capitalised back-vowel word.
    [InlineData("Qırım", "qɯˈrɯm")]
    [InlineData("QIRIM", "qɯˈrɯm")]
    // the vowel inventory and the q/k, ğ/g contrasts
    [InlineData("qara", "qɑˈrɑ")]
    [InlineData("ağa", "ɑˈɣɑ")]
    [InlineData("balıq", "bɑˈlɯq")]
    [InlineData("köy", "ˈkøj")]
    [InlineData("süt", "ˈsyt")]
    [InlineData("çay", "ˈt͡ʃɑj")]
    [InlineData("gece", "ɡeˈd͡ʒe")]
    [InlineData("añlamaq", "ɑŋlɑˈmɑq")]
    // ⚠ THE ⟨v⟩→[w] POST-VOCALIC CODA — after a vowel and NOT before one (the Kipchak offglide).
    [InlineData("suv", "ˈsuw")]
    [InlineData("av", "ˈɑw")]
    [InlineData("quvetsiz", "quvetˈsiz")]   // intervocalic ⟨v⟩ stays [v]
    [InlineData("vatan", "vɑˈtɑn")]         // onset ⟨v⟩ stays [v]
    // GEMINATION: a doubled letter → the phoneme + length.
    [InlineData("yollamaq", "jolːɑˈmɑq")]
    [InlineData("şeer", "ˈʃeːr")]
    public void ReadsTheGraphemeScan(string input, string expected) => Assert.Equal(expected, Word(input));

    [Theory]
    // Ranges — all three dash spellings, and the range must win before the minus rule sees the dash.
    [InlineData("1891 – 1938", "1891, 1938")]
    [InlineData("600—700 biñge", "600, 700 biñge")]
    [InlineData("520-590 mm", "520, 590 millimetr")]
    [InlineData("+3 – +4°C", "+3, +4 derece")]
    [InlineData("+22 – +28°C", "+22, +28 derece")]
    // …but a sign attached to an amount IS read.
    [InlineData("arareti –1,8°C", "arareti minus 1 8 derece")]
    [InlineData("arareti -6 °C", "arareti minus 6 derece")]
    // De-grouping: the space, comma and dot conventions all occur in this corpus.
    [InlineData("14 125 adadan", "14125 adadan")]
    [InlineData("30 300 000", "30300000")]
    [InlineData("36,000 senesine", "36000 senesine")]
    [InlineData("38.765", "38765")]
    // …and whatever separator survives is a DECIMAL, spent rather than spoken.
    [InlineData("1,5 million", "1 5 million")]
    [InlineData("5.9", "5 9")]
    // The percent sign carrying a written case suffix.
    [InlineData("0,7%-ine", "0 7 faizine")]
    [InlineData("69 %", "69 faiz")]
    // The degree sign, with the suffix attaching to the WORD.
    [InlineData("+23 °C-den +26 °C-ge qadar", "+23 dereceden +26 derecege qadar")]
    // ⚠ THE CYRILLIC ⟨С⟩ U+0421, which renders identically to the Latin ⟨C⟩ — the class carries both.
    [InlineData("+24°С", "+24 derece")]
    // The era marker and the four compass coordinates.
    [InlineData("m.e. 753 senesi", "milâttan evel 753 senesi")]
    [InlineData("46° ş.e.", "46 derece şimaliy enlik")]
    [InlineData("46° ş.e. enlikleri", "46 derece şimaliy enlikleri")]   // the noun the writer already wrote
    [InlineData("36° ş.b. boyluqları", "36 derece şarqiy boyluqları")]
    [InlineData("6° ğ.b. ve", "6 derece ğarbiy boyluq ve")]
    // …and a formula the rules must leave alone.
    [InlineData("PlotArea = left:50", "PlotArea = left:50")]
    public void TheNormalizerSteps(string input, string expected) => Assert.Equal(expected, Norm(input));

    [Fact]
    public void RegistryWiring() => Assert.Equal("qɯˈrɯm", Say("Qırım"));

    [Fact]
    public void NoDigitLeakSentinelOrGapAcrossTwentyThousand()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var words = string.Join(" ", Numbers.NumberToWords(n));
            Assert.Matches("^[^0-9]*$", words);
            Assert.NotEqual("", words);
        }
    }
}
