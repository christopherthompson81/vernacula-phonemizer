// The portable half of test/hawaiian.test.ts — Hawaiian / ʻŌlelo Hawaiʻi (haw), Eastern Polynesian
// (sibling of Māori), Latin script, canonical IPA. One of the simplest phonologies: 5 vowels + the
// macron (kahakō) = length, 8 consonants + the ʻokina ⟨ʻ⟩→[ʔ], loan-letter adaptation.
using Vernacula.Phonemizer;
using HawEngine = Vernacula.Phonemizer.Languages.Hawaiian.HawaiianPhonemizer;
using HawNormalize = Vernacula.Phonemizer.Languages.Hawaiian.Normalize;
using HawNumbers = Vernacula.Phonemizer.Languages.Hawaiian.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class HawaiianTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "haw").Trim();

    [Theory]
    // The ʻokina ⟨ʻ⟩→[ʔ] + the macron (kahakō) = length.
    [InlineData("Hawaiʻi", "hawaiʔi")]
    [InlineData("kāne", "kaːne")]
    [InlineData("ʻāina", "ʔaːina")]
    [InlineData("Kalaniʻōpuʻu", "kalaniʔoːpuʔu")]
    // The 8 native consonants + 5 vowels (near-1:1).
    [InlineData("aloha", "aloha")]
    [InlineData("mahalo", "mahalo")]
    [InlineData("pōhaku", "poːhaku")]
    [InlineData("keiki", "keiki")]
    // Loan-letter adaptation (t→k, g→k, r→l, d→k).
    [InlineData("Aigupita", "aikupika")]
    [InlineData("Doreka", "koleka")]
    public void TheGraphemeScan(string word, string want) => Assert.Equal(want, HawEngine.PhonemizeWord(word));

    [Theory]
    // Units (ʻe- prefix — the ʻokina is a real consonant) and the kana- tens.
    [InlineData(0, "ʻole")]
    [InlineData(5, "ʻelima")]
    [InlineData(20, "iwakālua")]
    [InlineData(40, "kanahā")]
    // 11-99: tens + kūmā + bare stem, fused into ONE word.
    [InlineData(11, "ʻumikūmākahi")]
    [InlineData(25, "iwakāluakūmālima")]
    [InlineData(99, "kanaiwakūmāiwa")]
    // Hundreds / thousands / millions — juxtaposed, no kūmā after haneli.
    [InlineData(100, "hoʻokahi haneli")]
    [InlineData(101, "hoʻokahi haneli ʻekahi")]
    [InlineData(555, "ʻelima haneli kanalimakūmālima")]
    [InlineData(1000, "hoʻokahi kaukani")]
    [InlineData(1000000, "hoʻokahi miliona")]
    [InlineData(1000000000, "hoʻokahi biliona")]
    public void TheComposer(double n, string want) => Assert.Equal(want, HawNumbers.NumberToWords(n));

    [Theory]
    // The cardinal path through the whole engine — the ʻokina becomes [ʔ] and the kahakō becomes length.
    [InlineData("0", "ʔole")]
    [InlineData("5", "ʔelima")]
    [InlineData("20", "iwakaːlua")]
    [InlineData("40", "kanahaː")]
    [InlineData("11", "ʔumikuːmaːkahi")]
    [InlineData("25", "iwakaːluakuːmaːlima")]
    [InlineData("99", "kanaiwakuːmaːiwa")]
    [InlineData("100", "hoʔokahi haneli")]
    [InlineData("101", "hoʔokahi haneli ʔekahi")]
    [InlineData("555", "ʔelima haneli kanalimakuːmaːlima")]
    [InlineData("1000", "hoʔokahi kaukani")]
    [InlineData("1000000", "hoʔokahi miliona")]
    // The loan ⟨b⟩ in biliona adapts to [p].
    [InlineData("1000000000", "hoʔokahi piliona")]
    public void TheNumberPipeline(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // ⚠ THE COORDINATE IS GLOSSED AGAINST ITS OWN NOTATION — and the compass letters are ʻĀ and K.
    [InlineData("ma 28°25′ʻĀ, 178°20′K",
        "ma 28 kēkelē 25 minuke ʻākau, 178 kēkelē 20 minuke komohana")]
    // ⚠ `H` IS NOT CLAIMED — it would be ambiguous between hema (south) and hikina (east).
    [InlineData("28°12′H", "28 kēkelē 12 minuke H")]
    // ⚠ THE DEGREE SIGN HAS A CONFUSABLE: U+00B0 and U+02DA RING ABOVE.
    [InlineData("25°", "25 kēkelē ")]
    [InlineData("38.4˚F", "38 4 kēkelē F")]
    // THE SEPARATORS: the comma groups, the dot decimates — and groups once.
    [InlineData("435,036", "435036")]
    [InlineData("3,849,674", "3849674")]
    [InlineData("19.95", "19 95")]
    // ⚠ ONE GERMAN FIGURE QUOTED INSIDE A HAWAIIAN SENTENCE GROUPS WITH A DOT.
    [InlineData("357.600", "357600")]
    // ⚠ …AND THE GUARD DECLINES AN IP ADDRESS: a decimal has exactly ONE dot.
    [InlineData("18.55.6.215", "18.55.6.215")]
    // ⚠ THE SCRIPTURE COLON IS A DIFFERENT CODEPOINT (U+02D0) FROM THE CLOCK (ASCII `:`).
    [InlineData("ʻOihana Kahuna 8ː10", "ʻOihana Kahuna 8ː10")]
    [InlineData("ka hola 12:18", "ka hola 12 18")]
    [InlineData("mai ka hola 12:00 awakea", "mai ka hola 12 00 awakea")]
    public void TheNormalizer(string input, string want) => Assert.Equal(want, HawNormalize.NormalizeHawaiian(input));

    [Fact]
    public void TheWholePipelineReadsTheCorpusUnits()
    {
        // ⚠ `klm` is kilomika and `kp` is kapuaʻi — neither is the SI abbreviation.
        Assert.Contains("kilomika", Say("3,200 klm"));
        Assert.Contains("kapua\u0294i", Say("13,796 kp"));
        // ⚠ `kuea` FOLLOWS the unit, unlike the Turkic rounds either side of this one.
        Assert.Contains("kilomika kuea", Say("4,028 km²"));
        // The rate connective is the corpus's own two-word phrase.
        Assert.Contains("kilomika o ka hola", Say("118 km/h"));
        Assert.Contains("pa\u02d0ke\u02d0neka", Say("20% o nā kānaka"));
    }

    [Fact]
    public void RegistryWiring() => Assert.Equal("aloha", Say("aloha"));

    /**
     * ⚠ THE DIGIT-BY-DIGIT FALLBACK ITERATES CODE POINTS, NOT CHARS. The TypeScript spreads the string
     * (`[...raw]`), which yields whole code points; iterating a C# string yields UTF-16 CODE UNITS, so an
     * astral character came back as TWO LONE SURROGATES with a space between them — malformed UTF-16 in
     * the phoneme stream, which is worse than either sensible reading of the character.
     *
     * Unreachable from `text()`, whose number branch is `\d+` — but `NumberToWords` is public and the
     * TypeScript answers it, so the two engines have to agree. Found by walking the composer: 1 divergence
     * in 218,000 rows.
     */
    [Theory]
    [InlineData("😀", "😀")]
    [InlineData("1😀2", "ʻekahi 😀 ʻelua")]
    [InlineData("a", "a")]
    public void TheDigitFallbackReadsCodePointsNotCodeUnits(string raw, string want) =>
        Assert.Equal(want, HawNumbers.NumberToWords(double.NaN, raw));
}
