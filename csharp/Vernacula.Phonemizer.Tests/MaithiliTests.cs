/**
 * ⚠ csharp/goldens/mai.tsv IS MINED WIKIPEDIA TEXT, and it exercises the Maithili divergences unevenly.
 * Measured over its 200 rows: ⟨े⟩ 1,251 / ⟨ो⟩ 385 / ⟨ै⟩ 170 / ⟨ौ⟩ 47, so the vowel divergences are pinned
 * hard — but ⟨॑⟩ U+0951 is 9 occurrences in 2 rows and EVERY ONE is a monosyllable, where the reading is
 * identical fold or no fold, and ⟨ऎ ऒ ॆ ꣿ ऋ ₹ ॐ ळ⟩ are 0. These tests carry the rest. The word theory is
 * test/maithili.test.ts's; each row here is a place where a Hindi-shaped engine would look plausible.
 */
using Vernacula.Phonemizer.Languages.Maithili;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class MaithiliTests
{
    public MaithiliTests() => Languages.Bootstrap.EnsureRegistered();

    [Theory]
    // SHORT e/o where Hindi has eː/oː, plus the dedicated Maithili short-e/short-o letters (0 in the golden).
    [InlineData("एकरा", "ˈekɾaː")]
    [InlineData("ऎकरा", "ˈekɾaː")]
    [InlineData("ओकरा", "ˈokɾaː")]
    [InlineData("ऒकरा", "ˈokɾaː")]
    // ⟨ऐ⟩→[əɪ] and ⟨औ⟩→[əʊ] are DIPHTHONGS here, against Hindi's ɛː/ɔː and Bhojpuri's monophthongs.
    [InlineData("बैसब", "bˈəɪsəb")]
    [InlineData("दौड़ब", "d̪ˈəʊɽəb")]
    // ⚠ ⟨ऋ⟩/⟨ृ⟩ ARE THE TAP, matching the manifest's only rhotic — the sibling defect filed against
    // bhojpuri.jsonc (ASCII `ri`, an alveolar trill) does NOT recur here.
    [InlineData("कृष्ण", "kɾˈɪʂɳ")]
    [InlineData("ऋषि", "ɾˈɪʂɪ")]
    [InlineData("कर", "kˈəɾ")]
    // A word-final avagraha retains the vowel the schwa rule would delete; the pair is the whole rule.
    [InlineData("करलऽ", "kˈəɾlə")]
    [InlineData("करल", "kˈəɾəl")]
    public void WordReadsTheMaithiliDivergence(string word, string ipa) =>
        Assert.Equal(ipa, MaithiliPhonemizer.PhonemizeWord(word));

    /**
     * ⚠ ⟨॑⟩ U+0951 folds onto the avagraha ⟨ऽ⟩ — the module's signature, and INERT ON THE GOLDEN because
     * all 9 of its occurrences there are monosyllables. `अब॑` is the one reading-changing shape.
     */
    [Theory]
    [InlineData("अब॑", "ˈəbə")]
    [InlineData("अबऽ", "ˈəbə")]
    [InlineData("अब", "ˈəb")]
    public void UdattaFoldsOntoTheAvagraha(string word, string ipa) =>
        Assert.Equal(ipa, Phonemizer.Phonemize(word, "mai"));

    /**
     * ⚠ THE FOLD MUST REACH `PhonemizeWord` TOO. `Word()` does not run the normalizer, so without its own
     * fold the eval path and the shipped path read the same spelling differently — a gap no golden can see.
     */
    [Fact]
    public void TheFoldReachesTheWordPathAsWellAsTheTextPath()
    {
        Assert.Equal("ˈəbə", MaithiliPhonemizer.PhonemizeWord("अब॑"));
        Assert.Equal(MaithiliPhonemizer.PhonemizeWord("करलऽ"), MaithiliPhonemizer.PhonemizeWord("करल॑"));
        // …and Hindi, which shares the engine, must not have acquired the fold.
        Assert.Equal("ˈəb", Phonemizer.Phonemize("अब॑", "hi"));
    }

    /**
     * ⚠ ⟨ꣿ⟩ U+A8FF is declared in maithili.jsonc's vowelSigns and is UNREACHABLE: Devanagari Extended sits
     * outside the shared word class `ऀ-ॣॲ-ॿ`, so the mark ends the token rather than colouring the vowel.
     * Pinned as a known-dead entry, not as a desired reading.
     */
    [Theory]
    [InlineData("कꣿ", "kˈə")]
    [InlineData("मꣿथिली", "mˈə t̪ʰˈɪliː")]
    public void UA8FFIsDeclaredButUnreachable(string text, string ipa) =>
        Assert.Equal(ipa, Phonemizer.Phonemize(text, "mai"));

    /** ⚠ ₹ is NOT stripped: mai declares no symbolTier, so the shared Hindi tier claims it first. */
    [Theory]
    [InlineData("₹500", "pˈaː̃t͡ʃ sˈəʊ ɾˈʊpje")]
    [InlineData("50%", "pət͡ʃˈaːs pɾˈət̪ɪʃət̪")]
    public void TheInheritedHindiSymbolTierClaimsTheSign(string text, string ipa) =>
        Assert.Equal(ipa, Phonemizer.Phonemize(text, "mai"));
}
