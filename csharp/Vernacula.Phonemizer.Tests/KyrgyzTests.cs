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
    [InlineData("кыз", "ˈqɯz")]      // onset к before back ы → q
    [InlineData("ак", "ˈɑq")]        // coda к after back а → q
    [InlineData("китеп", "kiˈtep")]  // onset к before front и → k
    [InlineData("Баткен", "bɑtˈken")] // onset к before front е → k (though the word has back а)
    public void VelarUvularHarmony(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ж→d͡ʒ, ө/ү/ы vowels, dark-l harmony, intervocalic б→β.
    [InlineData("жол", "ˈd͡ʒoɫ")]  // ж→d͡ʒ, dark л (back)
    [InlineData("көз", "ˈkøz")]    // ө→ø, front
    [InlineData("үй", "ˈyj")]      // ү→y
    [InlineData("ыр", "ˈɯr")]      // ы→ɯ
    [InlineData("обон", "oˈβon")]  // intervocalic б → β
    public void SignaturesAndDarkL(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // long vowels (doubling → Vː).
    [InlineData("тоо", "ˈtoː")]         // оо → oː
    [InlineData("Айсулуу", "ɑjsuˈɫuː")] // уу → uː
    public void LongVowels(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // cardinal numbers (Turkic decimal, space-separated).
    [InlineData("0", "ˈnøl")]                       // нөл
    [InlineData("21", "d͡ʒɯjɯrˈmɑ ˈbir")]            // жыйырма бир
    [InlineData("100", "ˈd͡ʒyz")]                    // жүз (omits leading 1)
    [InlineData("1000", "ˈbir ˈmiŋ")]                 // бир миң (does NOT omit the multiplier)
    [InlineData("1991", "ˈbir ˈmiŋ toˈʁuz ˈd͡ʒyz toqˈson ˈbir")]
    [InlineData("1000000000", "ˈbir milliˈɑrd")]      // бир миллиард (billion tier)
    public void CardinalNumbers(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // text: words + clause punctuation.
    public void WordsAndClausePunctuation() => Assert.Equal("ˈmen bɑˈrɑm .", Say("Мен барам."));

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
        Assert.Equal("ˈbir ˈmiŋ toˈʁuz ˈd͡ʒyz toqˈson birinˈt͡ʃi d͡ʒɯˈɫɯ", Say("1991-жылы"));
        Assert.Equal("ˈon toʁuzunˈt͡ʃu qɯɫɯmˈdɑ", Say("19-кылымда"));
        Assert.Equal("toʁuzunˈt͡ʃu ˈmɑj", Say("9-Май")); // CAPITALISED head (trap 7)
        Assert.Equal("onunˈt͡ʃu ˈon ekinˈt͡ʃi qɯɫɯmdɑˈʁɯ", Say("10-12-кылымдагы")); // both ends of a span
        Assert.Equal("ˈbir ˈmiŋ toˈʁuz ˈd͡ʒyz toqˈson birinˈt͡ʃi d͡ʒɯˈɫɯ", Say("1991-ж.")); // abbreviated head
    }

    [Fact]
    // a bare CASE suffix after digits is a cardinal, not an ordinal — and is re-harmonised.
    public void BareCaseSuffix()
    {
        Assert.Equal("ˈd͡ʒyz elyːˈdøn", Say("150дөн"));   // элүү + ablative -дөн
        Assert.Equal("ˈbir miŋˈɡe", Say("1000ге"));       // миң + dative -ге
        // ⚠ the written suffix is NOT copied — the spoken last word is беш, whose voiceless coda takes -ке.
        Assert.Equal("d͡ʒɯjɯrˈmɑ beʃˈke", Say("25ге"));
        // …and the discriminator holds in the other direction: a NOUN head is still an ordinal.
        Assert.Equal("ekinˈt͡ʃi deqɑbrˈdɑ", Say("2-декабрда"));
    }

    [Fact]
    // percent, its bound suffix, and the degree sign in both encodings.
    public void PercentAndDegree()
    {
        Assert.Equal("eˈlyː pɑˈjɯz", Say("50%"));
        Assert.Equal("sekˈsen pɑjɯzˈʁɑ", Say("80%ке")); // пайыз takes -га, never the written -ке
        Assert.Equal("d͡ʒɯjɯrˈmɑ ʁrɑˈdus", Say("20 °C")); // Latin C — was the ENGLISH letter name
        Assert.Equal("miˈnus ˈon seˈɡiz ʁrɑdusˈtɑn", Say("-18°Сден")); // CYRILLIC С
        Assert.Equal(Say("30 °C"), Say("30 °c"));                    // lowercased text is the majority form
        Assert.Equal("oˈtuz ʁrɑdusˈtɑn", Say("30 °C-дан"));           // ablative, absorbed by the suffix arm
        Assert.Equal(Say("30 °-ДАН"), Say("30 °C-ДАН"));            // uppercase: NOT a suffix, in either arm
    }

    [Fact]
    // the minus is read ONLY where the corpus can tell it from a range (trap 24).
    public void TheMinus()
    {
        Assert.Equal("temperɑtuˈrɑ miˈnus oˈtuz seˈɡiz ʁrɑˈdus", Say("температура -38°С"));
        Assert.Equal("miˈnus ˈqɯrq ʁrɑˈdus", Say("—40°С")); // this corpus writes the minus as an EM DASH
        Assert.Contains("miˈnus d͡ʒɯjɯrˈmɑ ˈyt͡ʃ", Say("-23...-29 °C")); // both ends of an ellipsis span
        // …and the three shapes that must NOT be claimed, one per rejected guard.
        Assert.DoesNotContain("miˈnus", Say("6-16 °C"));          // a digit precedes — a RANGE
        Assert.DoesNotContain("miˈnus", Say("39°11′–43°16′"));    // a prime precedes — a COORDINATE
        Assert.DoesNotContain("miˈnus", Say("2750-3800 метр"));   // no degree follows — a range
    }

    [Fact]
    // decimals and fractions share one attested construction.
    public void DecimalsAndFractions()
    {
        Assert.Equal("eˈki byˈtyn onˈdon ˈbeʃ", Say("2,5"));          // «1 бүтүн ондон үч … деп окулат»
        Assert.Equal("ˈnøl byˈtyn d͡ʒyzˈdøn eˈlyː ˈtørt", Say("0,54")); // two places → жүздөн
        Assert.Equal("tørtˈtøn ˈyt͡ʃ", Say("3/4"));                 // denominator ablative + numerator
        Assert.Equal("onˈdon ˈbir", Say("1/10"));                   // the corpus's «ондон бир үлүш»
    }

    [Fact]
    // grouping, units, currency and the initialism seam.
    public void GroupingUnitsCurrencyInitialism()
    {
        Assert.Equal("ˈbir milliˈon", Say("1 000 000"));              // was *bir nøl nøl*
        Assert.Equal("ˈbeʃ kiɫoˈmetr", Say("5 км"));                 // was a raw Latin-ish [km] leak
        Assert.Equal("ˈbir ˈmiŋ toqˈson t͡ʃɑrˈt͡ʃɯ kiɫoˈmetr", Say("1090 км²"));
        Assert.Equal("ˈd͡ʒyz milliˈon doɫˈɫɑr", Say("$100 миллион"));
        Assert.Equal("ˈes ˈes ˈes ˈer", Say("СССР"));                  // was the vowel-less cluster [ssːr]
        Assert.Equal("ˈes ˈes ˈes erˈdin", Say("СССРдин"));            // …with its case suffix kept on one word
        Assert.Equal("ˈɡes", Say("ГЭС"));                           // readable — correctly LEFT a word
    }

    [Fact]
    // what the layer must NOT do.
    public void WhatTheLayerMustNotDo()
    {
        // a sentence-final period still ends the clause.
        Assert.Equal("ˈmen bɑˈrɑm . ˈsen bɑrɑˈsɯŋ .", Say("Мен барам. Сен барасың."));
        // the bibliographic `=` is a title separator, not an equals: Latin on the right, no барабар.
        Assert.DoesNotContain("bɑrɑˈβɑr", Say("ПК = Upgrading"));
        // a version string's trailing letter is not a unit.
        Assert.DoesNotContain("ɡrɑmm", Say("802.11г"));
        // the range is deliberately unclaimed, and must stay a pair of cardinals with nothing invented.
        Assert.Equal("ˈyt͡ʃ ˈtørt", Say("3-4"));
    }
}
