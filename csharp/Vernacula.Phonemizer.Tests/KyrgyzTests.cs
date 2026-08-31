/**
 * The portable half of test/kyrgyz.test.ts — Kyrgyz (ky), Turkic (Kipchak), Cyrillic. Left-to-right g2p with
 * SPELLED vowel harmony + three code rules: the velar/uvular harmony (к→q/г→ʁ back, k/ɡ front — a CODA is
 * governed by the preceding vowel: ак→aq), dark-⟨л⟩ harmony (л→ɫ back / l front), and long vowels (doubling
 * → Vː). ж→d͡ʒ, ң→ŋ, intervocalic б→β.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Kyrgyz;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KyrgyzTests
{
    private static string Word(string s) => KyrgyzPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "ky").Trim();
    private static string Norm(string s) => Normalize.NormalizeKyrgyz(s);

    [Theory]
    // velar/uvular harmony: к→q/k, coda governed by preceding vowel.
    [InlineData("кыз", "qɯz")]      // onset к before back ы → q
    [InlineData("ак", "ɑq")]        // coda к after back а → q
    [InlineData("китеп", "kitep")]  // onset к before front и → k
    [InlineData("Баткен", "bɑtken")] // onset к before front е → k (though the word has back а)
    public void VelarUvularHarmony(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ж→d͡ʒ, ө/ү/ы vowels, dark-l harmony, intervocalic б→β.
    [InlineData("жол", "d͡ʒoɫ")]  // ж→d͡ʒ, dark л (back)
    [InlineData("көз", "køz")]    // ө→ø, front
    [InlineData("үй", "yj")]      // ү→y
    [InlineData("ыр", "ɯr")]      // ы→ɯ
    [InlineData("обон", "oβon")]  // intervocalic б → β
    public void SignaturesAndDarkL(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // long vowels (doubling → Vː).
    [InlineData("тоо", "toː")]         // оо → oː
    [InlineData("Айсулуу", "ɑjsuɫuː")] // уу → uː
    public void LongVowels(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // cardinal numbers (Turkic decimal, space-separated).
    [InlineData("0", "nøl")]                       // нөл
    [InlineData("21", "d͡ʒɯjɯrmɑ bir")]            // жыйырма бир
    [InlineData("100", "d͡ʒyz")]                    // жүз (omits leading 1)
    [InlineData("1000", "bir miŋ")]                 // бир миң (does NOT omit the multiplier)
    [InlineData("1991", "bir miŋ toʁuz d͡ʒyz toqson bir")]
    [InlineData("1000000000", "bir milliɑrd")]      // бир миллиард (billion tier)
    public void CardinalNumbers(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // text: words + clause punctuation.
    public void WordsAndClausePunctuation() => Assert.Equal("men bɑrɑm .", Say("Мен барам."));

    [Theory]
    // the ordinal composition, one case per BRANCH of the harmony rule.
    [InlineData(1, "биринчи")]
    [InlineData(3, "үчүнчү")]
    [InlineData(40, "кыркынчы")]
    [InlineData(10, "онунчу")]
    [InlineData(2, "экинчи")]
    [InlineData(20, "жыйырманчы")]
    [InlineData(50, "элүүнчү")]
    [InlineData(1991, "бир миң тогуз жүз токсон биринчи")]
    [InlineData(100, "жүзүнчү")]
    [InlineData(1000, "бир миңинчи")]
    public void OrdinalComposition(double n, string want) => Assert.Equal(want, Normalize.KyrgyzOrdinal(n));

    [Fact]
    // the hyphenated ordinal, and the head noun is put back with its own case suffix.
    public void HyphenatedOrdinal()
    {
        Assert.Equal("bir miŋ toʁuz d͡ʒyz toqson birint͡ʃi d͡ʒɯɫɯ", Say("1991-жылы"));
        Assert.Equal("on toʁuzunt͡ʃu qɯɫɯmdɑ", Say("19-кылымда"));
        Assert.Equal("toʁuzunt͡ʃu mɑj", Say("9-Май")); // CAPITALISED head (trap 7)
        Assert.Equal("onunt͡ʃu on ekint͡ʃi qɯɫɯmdɑʁɯ", Say("10-12-кылымдагы")); // both ends of a span
        Assert.Equal("bir miŋ toʁuz d͡ʒyz toqson birint͡ʃi d͡ʒɯɫɯ", Say("1991-ж.")); // abbreviated head
    }

    [Fact]
    // a bare CASE suffix after digits is a cardinal, not an ordinal — and is re-harmonised.
    public void BareCaseSuffix()
    {
        Assert.Equal("d͡ʒyz elyːdøn", Say("150дөн"));   // элүү + ablative -дөн
        Assert.Equal("bir miŋɡe", Say("1000ге"));       // миң + dative -ге
        // ⚠ the written suffix is NOT copied — the spoken last word is беш, whose voiceless coda takes -ке.
        Assert.Equal("d͡ʒɯjɯrmɑ beʃke", Say("25ге"));
        // …and the discriminator holds in the other direction: a NOUN head is still an ordinal.
        Assert.Equal("ekint͡ʃi deqɑbrdɑ", Say("2-декабрда"));
    }

    [Fact]
    // percent, its bound suffix, and the degree sign in both encodings.
    public void PercentAndDegree()
    {
        Assert.Equal("elyː pɑjɯz", Say("50%"));
        Assert.Equal("seksen pɑjɯzʁɑ", Say("80%ке")); // пайыз takes -га, never the written -ке
        Assert.Equal("d͡ʒɯjɯrmɑ ʁrɑdus", Say("20 °C")); // Latin C — was the ENGLISH letter name
        Assert.Equal("minus on seɡiz ʁrɑdustɑn", Say("-18°Сден")); // CYRILLIC С
        Assert.Equal(Say("30 °C"), Say("30 °c"));                    // lowercased text is the majority form
        Assert.Equal("otuz ʁrɑdustɑn", Say("30 °C-дан"));           // ablative, absorbed by the suffix arm
        Assert.Equal(Say("30 °-ДАН"), Say("30 °C-ДАН"));            // uppercase: NOT a suffix, in either arm
    }

    [Fact]
    // the minus is read ONLY where the corpus can tell it from a range (trap 24).
    public void TheMinus()
    {
        Assert.Equal("temperɑturɑ minus otuz seɡiz ʁrɑdus", Say("температура -38°С"));
        Assert.Equal("minus qɯrq ʁrɑdus", Say("—40°С")); // this corpus writes the minus as an EM DASH
        Assert.Contains("minus d͡ʒɯjɯrmɑ yt͡ʃ", Say("-23...-29 °C")); // both ends of an ellipsis span
        // …and the three shapes that must NOT be claimed, one per rejected guard.
        Assert.DoesNotContain("minus", Say("6-16 °C"));          // a digit precedes — a RANGE
        Assert.DoesNotContain("minus", Say("39°11′–43°16′"));    // a prime precedes — a COORDINATE
        Assert.DoesNotContain("minus", Say("2750-3800 метр"));   // no degree follows — a range
    }

    [Fact]
    // decimals and fractions share one attested construction.
    public void DecimalsAndFractions()
    {
        Assert.Equal("eki bytyn ondon beʃ", Say("2,5"));          // «1 бүтүн ондон үч … деп окулат»
        Assert.Equal("nøl bytyn d͡ʒyzdøn elyː tørt", Say("0,54")); // two places → жүздөн
        Assert.Equal("tørttøn yt͡ʃ", Say("3/4"));                 // denominator ablative + numerator
        Assert.Equal("ondon bir", Say("1/10"));                   // the corpus's «ондон бир үлүш»
    }

    [Fact]
    // grouping, units, currency and the initialism seam.
    public void GroupingUnitsCurrencyInitialism()
    {
        Assert.Equal("bir million", Say("1 000 000"));              // was *bir nøl nøl*
        Assert.Equal("beʃ kiɫometr", Say("5 км"));                 // was a raw Latin-ish [km] leak
        Assert.Equal("bir miŋ toqson t͡ʃɑrt͡ʃɯ kiɫometr", Say("1090 км²"));
        Assert.Equal("d͡ʒyz million doɫɫɑr", Say("$100 миллион"));
        Assert.Equal("es es es er", Say("СССР"));                  // was the vowel-less cluster [ssːr]
        Assert.Equal("es es es erdin", Say("СССРдин"));            // …with its case suffix kept on one word
        Assert.Equal("ɡes", Say("ГЭС"));                           // readable — correctly LEFT a word
    }

    [Fact]
    // what the layer must NOT do.
    public void WhatTheLayerMustNotDo()
    {
        // a sentence-final period still ends the clause.
        Assert.Equal("men bɑrɑm . sen bɑrɑsɯŋ .", Say("Мен барам. Сен барасың."));
        // the bibliographic `=` is a title separator, not an equals: Latin on the right, no барабар.
        Assert.DoesNotContain("bɑrɑβɑr", Say("ПК = Upgrading"));
        // a version string's trailing letter is not a unit.
        Assert.DoesNotContain("ɡrɑmm", Say("802.11г"));
        // the range is deliberately unclaimed, and must stay a pair of cardinals with nothing invented.
        Assert.Equal("yt͡ʃ tørt", Say("3-4"));
    }
}
