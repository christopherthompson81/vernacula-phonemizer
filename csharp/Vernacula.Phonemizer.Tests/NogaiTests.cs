/**
 * The portable half of test/nogai.test.ts — Nogai / ногай тили (nog), Kipchak Turkic (Kipchak-Nogai),
 * Cyrillic. A near-deterministic digraph-aware grapheme scan + word-final (oxytone) stress. Nogai WRITES
 * the uvulars/velar-nasal as digraphs (къ→q, гъ→ʁ, нъ→ŋ) and the front vowels as digraphs (аь→æ, оь→ø,
 * уь→y), so ⟨к г⟩ are always [k ɡ] (no harmony inference, the Bashkir pattern). Referee-limited (1 kaikki
 * IPA + coarse ASJP).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Nogai;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class NogaiTests
{
    private static string Word(string s) => NogaiPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "nog").Trim();

    [Theory]
    // the one kaikki attestation + front-vowel digraphs.
    [InlineData("туькен", "tyˈken")]  // kaikki /ty.ken/ — ⟨уь⟩→[y], ⟨е⟩ post-consonant→[e]
    [InlineData("коьз", "ˈkøz")]      // ⟨оь⟩→[ø] (eye)
    [InlineData("муьйиз", "myˈjiz")]  // ⟨уь⟩→[y], ⟨й⟩→[j] (horn)
    public void KaikkiAttestationAndFrontVowelDigraphs(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // explicit-uvular digraphs къ/гъ/нъ (no harmony inference — ⟨к г⟩ stay [k ɡ]).
    [InlineData("къыз", "ˈqɯz")]     // ⟨къ⟩→[q], ⟨ы⟩→[ɯ] (girl)
    [InlineData("гъарув", "ʁaˈruw")] // ⟨гъ⟩→[ʁ]; ⟨в⟩→[w] coda
    [InlineData("янъы", "jaˈŋɯ")]    // ⟨нъ⟩→[ŋ]; ⟨я⟩→[ja] (new)
    [InlineData("кан", "ˈkan")]      // plain ⟨к⟩→[k] (NOT [q]) — blood
    public void ExplicitUvularDigraphs(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // simple vowels, в→w coda, iotation, final stress.
    [InlineData("сув", "ˈsuw")]        // ⟨в⟩→[w] post-vocalic coda (water)
    [InlineData("эмшек", "emˈʃek")]    // ⟨ш⟩→[ʃ] (breast)
    [InlineData("юлдыз", "julˈdɯz")]   // ⟨ю⟩→[ju], ⟨ы⟩→[ɯ] (star)
    [InlineData("эки", "eˈki")]        // final (oxytone) stress (two)
    public void VowelsCodaIotationFinalStress(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // a front-vowel digraph counts as the preceding vowel (coda-в / iotation edge case). ⟨уь⟩/⟨аь⟩ end in
    // the soft sign ь, so the post-vocalic tests read the emitted VOWEL segment, not the raw prior char.
    [InlineData("суьв", "ˈsyw")]  // ⟨уь⟩[y] + coda ⟨в⟩→[w] (constructed probe)
    [InlineData("аье", "æˈje")]   // ⟨аь⟩[æ] + post-vocalic ⟨е⟩→[je] (constructed probe)
    public void FrontVowelDigraphCountsAsPrecedingVowel(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // NUMBERS — Turkic decimal; Nogai's own lexemes, NOT Karakalpak's.
    [InlineData("7", "jeˈti")]                             // ети — j- lost (Karakalpak keeps it: jeti)
    [InlineData("11", "ˈon ˈbir")]                          // он бир — teens are two words
    [InlineData("25", "jɯrˈma ˈbes")]                       // йырма бес — the contracted Nogai 20
    [InlineData("100", "ˈjuz")]                             // юз — the multiplier "бир" is dropped
    [InlineData("555", "ˈbes ˈjuz elˈli ˈbes")]             // бес юз элли бес — ⟨элли⟩ 50, the plain [e] of ⟨э⟩
    [InlineData("1984", "ˈmɯŋ toˈɡɯz ˈjuz sekˈsen ˈdørt")]  // мынъ тогыз юз сексен доьрт
    [InlineData("12345", "ˈon eˈki ˈmɯŋ ˈyʃ ˈjuz ˈkɯrk ˈbes")]
    [InlineData("1000000", "ˈbir milliˈon")]                // бир миллион
    public void CardinalNumbers(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // registry wiring.
    public void RegistryWiring() => Assert.Equal("ˈkan", Say("кан"));
}
