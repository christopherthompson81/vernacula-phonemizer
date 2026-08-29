/**
 * Bishnupriya Manipuri / বিষ্ণুপ্রিয়া মণিপুরী (bpy) — Eastern Indo-Aryan, Bengali / Eastern-Nagari script
 * (~120k, Assam/Tripura + Sylhet). Reuses the Bengali engine (abugida scan + inherent-vowel deletion) with
 * BENGALI phoneme values — the referee is Bengali-like, NOT Assamese-like: the ʃ sibilants, the
 * retroflex/dental split and the affricates are all kept.
 *
 * The portable half of test/bishnupriya.test.ts, plus the two DIVERGENCE-FLAG probes below, which the TS
 * suite does not carry. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Bishnupriya;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class BishnupriyaTests
{
    private static string Word(string s) => BishnupriyaPhonemizer.PhonemizeWord(s);

    [Theory]
    // Bengali-like sibilants শ/ষ/স → [ʃ] (NOT the Assamese [x]).
    [InlineData("সাত", "ʃat̪")]           // স → ʃ, ত → dental t̪ (seven)
    [InlineData("বিশ", "biʃ")]            // শ → ʃ (twenty)
    // Affricates চ/জ + the retroflex/dental split kept (Bengali, not the Assamese merger).
    [InlineData("চার", "t͡ʃaɾ")]          // চ → t͡ʃ affricate (four), র → tap ɾ
    [InlineData("হাজার", "ɦad͡ʒaɾ")]      // জ → d͡ʒ, হ → ɦ (thousand)
    [InlineData("আট", "aʈ")]              // ট → RETROFLEX ʈ (eight)
    [InlineData("তিন", "t̪in")]           // ত → DENTAL t̪ (three)
    // Inherent-vowel deletion (final + medial).
    [InlineData("দশ", "d̪ɔʃ")]            // final inherent deleted (ten); দ → dental d̪
    [InlineData("পাহাড়", "paɦaɽ")]       // হ → ɦ, ড় → retroflex flap ɽ (mountain)
    [InlineData("নৌকা", "nouka")]         // ঔ/ৌ → ou diphthong (boat)
    [InlineData("বাঁশ", "bãʃ")]           // chandrabindu nasalizes the preceding vowel
    public void ReadsTheBengaliValuedInventory(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    /**
     * ⚠ THE FIRST OF THE TWO MANIFEST DIVERGENCE FLAGS, AND A GOLDEN CANNOT BE TRUSTED TO SEE IT.
     * `heightHarmony: false` is the ONE way Bishnupriya's phonology departs from Bengali's — Bengali raises
     * ɔ→o before a following high/mid vowel and Bishnupriya does not. If the flag failed to bind (a null
     * instead of `false`), harmony would silently switch ON and these words would read as Bengali does.
     * The expected values are Bishnupriya's; the Bengali readings are named beside them so the difference
     * is legible rather than asserted.
     */
    [Theory]
    [InlineData("সমুদ্র", "ʃɔmud̪ɾo", "ʃomud̪ɾo")]   // 'sea' — Bengali raises the initial ɔ; bpy does not
    [InlineData("বই", "bɔi", "boi")]                  // 'book' — likewise
    [InlineData("খরগোশ", "kʰɔɾɡoʃ", "kʰɔɾɡoʃ")]      // 'rabbit' — unraised in BOTH; the control
    public void HeightHarmonyIsOffTheOneDivergenceFromBengali(string input, string bpy, string bengali)
    {
        Assert.Equal(bpy, Word(input));
        Assert.Equal(bengali, Languages.Bengali.Bengali.PhonemizeWord(input));
    }

    /**
     * ⚠ THE SECOND FLAG, AND NOTHING IN THE TS SUITE COVERS IT. `skipLexicon: true` keeps Bishnupriya off
     * the Bengali whole-word pronunciation lexicon — the two languages share a script and an engine, so a
     * failure to bind would silently serve Bengali's recorded readings for Bishnupriya words. `ভালবাসা` is
     * the discriminator: the lexicon holds a form with the medial ɔ retained, and the rule engine deletes
     * it, so the two paths give different answers and this test can tell them apart.
     */
    [Fact]
    public void TheBengaliLexiconIsSkipped()
    {
        Assert.Equal("bʱalbaʃa", Word("ভালবাসা"));                                    // rule engine
        Assert.Equal("bʱalɔbaʃa", Languages.Bengali.Bengali.PhonemizeWord("ভালবাসা")); // Bengali's lexicon
    }

    [Fact]
    public void RegistryWiring() => Assert.Equal("aʈ", Phonemizer.Phonemize("আট", "bpy").Trim());
}
