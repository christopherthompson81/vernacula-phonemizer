/**
 * ⚠ THE bho GOLDEN IS HINDI TEXT RE-RENDERED, NOT BHOJPURI. csharp/goldens/bho.tsv is derived from
 * csharp/goldens/hi.tsv by tools/gen_variant_golden.mts — Bhojpuri has no FLEURS corpus and no mined
 * artifact — so 200/200 pins C#↔TS parity on the shared Devanagari machinery and nothing about whether the
 * Bhojpuri-specific readings are the ones the manifest claims. These tests carry that half. The word
 * theory is test/bhojpuri.test.ts's expectations; the text theory is running Bhojpuri from
 * tools/corpus/attest/bho.jsonc, read off the TypeScript engine. Each row is a place where a Hindi-shaped
 * engine would still look plausible while being wrong.
 */
using Vernacula.Phonemizer.Languages.Bhojpuri;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class BhojpuriTests
{
    public BhojpuriTests() => Languages.Bootstrap.EnsureRegistered();

    [Theory]
    // ⟨ऐ⟩→ɛ and ⟨औ⟩→ɔ are MONOPHTHONGS, not diphthongs, and no vowel carries length.
    [InlineData("बैल", "bˈɛl")]
    [InlineData("कौन", "kˈɔn")]
    [InlineData("किताब", "kˈit̪ɑb")]
    [InlineData("पानी", "pˈɑni")]
    // The reduced inventory: श/ष→s (the only fricatives are /s ɦ/), ⟨व⟩→w (not Hindi's ʋ), ⟨ण ञ⟩→n.
    [InlineData("देश", "d̪ˈes")]
    [InlineData("विशाल", "wˈisɑl")]
    [InlineData("गणेश", "ɡˈənes")]
    [InlineData("अञ्जन", "ˈʌnd͡ʒən")]
    // …and no Hindi əɦə→ɛɦɛ lowering.
    [InlineData("शहर", "sˈəɦəɾ")]
    // A word-final avagraha ⟨ऽ⟩ RETAINS the vowel the schwa rule would delete; the pair is the whole rule.
    [InlineData("करऽ", "kˈəɾə")]
    [InlineData("कर", "kˈəɾ")]
    [InlineData("देखऽ", "d̪ˈekʰə")]
    [InlineData("खइलऽ", "kʰˈəilə")]
    public void WordReadsTheBhojpuriDivergence(string word, string ipa) =>
        Assert.Equal(ipa, BhojpuriPhonemizer.PhonemizeWord(word));

    [Theory]
    // Running Bhojpuri — morphology (बा, होला, गइल, भइल) rather than quoted Hindi, from tools/corpus/attest/bho.jsonc.
    [InlineData("भोजपुरी एगो भाषा बा", "bʱˈod͡ʒpuɾi ˈeɡo bʱˈɑsɑ bˈɑ")]
    [InlineData("प्रतिशत भू–भाग होला", "pɾˈət̪isət̪ bʱˈu bʱˈɑɡ ɦˈolɑ")]
    [InlineData("7वीं सदी ईसा पूर्व", "sˈɑt̪wĩ sˈəd̪i ˈisɑ pˈuɾw")]
    [InlineData("सवा आठ बजे", "sˈəwɑ ˈɑʈʰ bˈəd͡ʒe")]
    [InlineData("कुछ मिनट", "kˈut͡ʃʰ mˈinəʈ")]
    // ⚠ NOT the bare number. bho declares no symbolTier, so HINDI's claims ₹ before this engine's
    // `stripSymbols` sees it — see the header of src/languages/bhojpuri/bhojpuri.ts.
    [InlineData("₹500", "pˈɑ̃t͡ʃ sˈɔ ɾˈupje")]
    [InlineData("५०%", "pˈət͡ʃɑs pɾˈət̪isət̪")]
    public void TextReadsRunningBhojpuri(string text, string ipa) =>
        Assert.Equal(ipa, Phonemizer.Phonemize(text, "bho"));
}
