/**
 * Papiamentu (Papiamento) (pap) — an Iberian-lexified creole of the ABC islands, the Curaçao phonemic
 * orthography. Signatures: coda-⟨n⟩ RETENTION — word-final ⟨n⟩→[ŋ] (+ vowel nasalization: bon→[bõŋ]),
 * medial ⟨n⟩ kept [n] (kontra→[kontɾa]); the digraphs ⟨ch sh dj zj⟩→[t͡ʃ ʃ d͡ʒ ʒ]; the open-vowel
 * letters ⟨è ò ù⟩→[ɛ ɔ ø] + the ⟨ou⟩ diphthong [ɔu]; degemination; acute/penult stress.
 *
 * The portable half of test/papiamento.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Papiamento;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class PapiamentoTests
{
    private static string Word(string s) => PapiamentoPhonemizer.PhonemizeWord(s);
    private static string Text(string s) => Registry.GetPhonemizer("pap").Text(s).Trim();
    private static string Norm(string s) => Normalize.NormalizePapiamento(s);

    [Theory]
    [InlineData("bon", "ˈbõŋ")]                // 'good' — word-final ⟨n⟩ → [ŋ], vowel nasalized
    [InlineData("federashon", "fedeɾaˈʃõŋ")]   // ⟨sh⟩→[ʃ]; final -on → [õŋ]; final stress
    [InlineData("mashin", "maˈʃĩŋ")]           // final ⟨n⟩ → [ŋ]
    [InlineData("kontra", "ˈkontɾa")]          // medial coda ⟨n⟩ is KEPT [n] (not dropped)
    [InlineData("Papiamentu", "papiaˈmentu")]  // the endonym — medial ⟨n⟩ kept
    public void CodaNRetentionWordFinalNgMedialN(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("dushi", "ˈduʃi")]     // 'sweet/nice' — ⟨sh⟩→[ʃ]
    [InlineData("Kòrsou", "ˈkɔɾsɔu")]  // ⟨ò⟩→[ɔ]; ⟨ou⟩→[ɔu] diphthong (one nucleus, stress first)
    [InlineData("futbòl", "futˈbɔl")]  // ⟨ò⟩→[ɔ]; consonant-final → ultimate stress
    [InlineData("amigu", "aˈmiɡu")]    // intervocalic ⟨g⟩→[ɡ]; penult
    public void DigraphsOpenVowelsOuAndDegemination(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("abolí", "aboˈli")]  // acute ⟨í⟩ → final stress
    [InlineData("dia", "ˈdia")]      // penult (hiatus, not a diphthong)
    [InlineData("kas", "ˈkas")]      // 'house' — consonant-final
    [InlineData("hende", "ˈhende")]  // 'person' — medial ⟨n⟩ kept [n]
    public void StressAcuteOverridesElsePenultFinal(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    // ── NUMBERS — everything below 1000 is ONE orthographic word: the tens change final ⟨-a⟩ → ⟨-i⟩
    // before a unit (trinta → trintiun) and a hundred links to its remainder through the fused ⟨-ti-⟩
    // (shen → shentiun). The -i- is the additive conjunction ⟨i⟩.

    [Theory]
    [InlineData(7, "shete")]
    [InlineData(16, "dieseis")]                       // haplology: one ⟨s⟩ (not *diesseis)
    [InlineData(21, "bintiun")]                       // binti already ends in -i
    [InlineData(31, "trintiun")]                      // trinta → trinti + un, one word
    [InlineData(42, "kuarentidos")]
    [InlineData(101, "shentiun")]                     // the fused ⟨-ti-⟩ hundred link
    [InlineData(555, "sinkushentisinkuentisinku")]
    [InlineData(12345, "diesdos mil i treshentikuarentisinku")]
    [InlineData(1000000, "un mion")]
    [InlineData(1000000000, "mil mion")]              // a thousand million (no invented lexeme)
    public void NumbersUnitsTensFusedHundredsThousandsMillions(int n, string expected) =>
        Assert.Equal(expected, Numbers.NumberToWords(n));

    [Theory]
    [InlineData(101, "ʃentiˈũŋ")]   // final ⟨n⟩ → nasal vowel + [ŋ]
    [InlineData(100, "ˈʃẽŋ")]       // shen
    [InlineData(42, "kuaɾentiˈdos")] // a single accent, not four
    public void NumbersThroughTheG2p(int n, string expected) =>
        Assert.Equal(expected, Word(Numbers.NumberToWords(n)));

    // ── TEXT NORMALIZATION (Normalize.cs) ──────────────────────────────────────────────────────────────

    [Fact]
    public void TwoOrthographiesEachMarkBothGroupsAndDecimates()
    {
        // Curaçaoan/Dutch: the DOT groups, the COMMA decimates.
        Assert.Equal("130627", Norm("130.627"));
        Assert.Equal("2754000", Norm("2.754.000"));
        Assert.Equal("bintikuaˈteɾ ˈkoma ˈseis poɾˈʃento", Text("24,6%"));
        // Aruban/American: the COMMA groups, the DOT decimates — in the same artifact.
        Assert.Equal("1290", Norm("1,290"));
        Assert.Equal("52000", Norm("52,000"));
        Assert.Equal("27,3", Norm("27.3"));
    }

    [Fact]
    public void TheEraInTheArubanSpellingTheCorpusWrites()
    {
        Assert.Equal("460 antes di Cristo.", Norm("460 a.C."));
        Assert.Equal("98, 138 despues di Cristo.", Norm("98–138 d.C."));
    }

    [Fact]
    public void DegreesBothSenses()
    {
        Assert.Equal(Text("32 grado Celsius"), Text("32°C"));
        Assert.Equal("46 grado 37 minüt W", Norm("46° 37' W"));
        Assert.Equal("36 grado ", Norm("36°")); // an interior angle; the pad collapses
    }

    [Fact]
    public void TheColonIsAFlagProportionNotAClock()
    {
        // "E strepinan horizontal tin un proporshon di 5:1:2" — the Curaçao flag's stripe ratio. A clock
        // rule would read it as five past one (trap 9).
        Assert.Equal("5:1:2", Norm("5:1:2"));
        Assert.Equal("1/6 i 2/9", Norm("1/6 i 2/9"));
    }

    [Fact]
    public void TheTierAndItsWordsExistInOnlyOneOrthography()
    {
        // `porshento` ×28 and `kuadrá` ×23 are attested; `porcento` and `cuadrado` score ZERO.
        Assert.Equal("ʃentioˈt͡ʃenta kilometeɾˈnãŋ kuadˈɾa", Text("180 km²"));
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58).
        Assert.Equal("129, 216.", Norm("129–216."));
    }

    [Fact]
    public void RegistryWiring() => Assert.Equal("ˈbõŋ", Phonemizer.Phonemize("bon", "pap").Trim());
}
