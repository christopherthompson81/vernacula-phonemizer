/**
 * mag's golden IS real Magahi — csharp/goldens/mag.tsv is the MINED tier over tools/corpus/mined/mag.jsonc
 * (mag.wikipedia; no FLEURS transcript and no audio exist for Magahi), so 200/200 is corpus coverage of the
 * language rather than another language's text re-rendered. These tests carry what the 200 rows do not: the
 * word-level theory from test/magahi.test.ts, and the arms of the shared Hindi normalizer that the corpus
 * happens not to exercise. See src/languages/magahi/magahi.ts for the sourcing and the filed findings.
 */
using Vernacula.Phonemizer.Languages.Magahi;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class MagahiTests
{
    public MagahiTests() => Languages.Bootstrap.EnsureRegistered();

    private static string Say(string t) => Phonemizer.Phonemize(t, "mag").Trim();

    [Theory]
    // The Magahi delta: glide hardening व→b, य→d͡ʒ, where Bhojpuri keeps w / j.
    [InlineData("वंश", "bˈə̃s")]
    [InlineData("यंत्र", "d͡ʒˈə̃n̪t̪ɾ")]
    [InlineData("विशाल", "bˈisɑl")]
    // The shared Bihari core: no phonemic length, श/ष→s, ण→n, ऐ→ɛ / औ→ɔ as MONOPHTHONGS.
    [InlineData("देश", "d̪ˈes")]
    [InlineData("बैल", "bˈɛl")]
    [InlineData("कौन", "kˈɔn")]
    [InlineData("गणेश", "ɡˈənes")]
    [InlineData("शहर", "sˈəɦəɾ")]
    // ⟨ऋ⟩/⟨ृ⟩ write the TAP; the ASCII `ri` bhojpuri.jsonc was fixed for does not recur here.
    [InlineData("कृष्ण", "kɾˈisn")]
    [InlineData("ऋषि", "ɾˈisi")]
    // The avagraha ⟨ऽ⟩ RETAINS the final inherent vowel — the minimal pair the grammar draws.
    [InlineData("करऽ", "kˈəɾə")]
    [InlineData("कर", "kˈəɾ")]
    public void WordReadings(string word, string ipa) => Assert.Equal(ipa, MagahiPhonemizer.PhonemizeWord(word));

    // ⚠ PINNED IN EVERY POSITION, WHICH IS NOT WHAT THE SOURCE CITES. Vinod Kumar 2026 §6.2 states the
    // hardening word-initially and magahi.jsonc applies it as a flat consonant map, so it fires medially and
    // finally too. Filed in src/languages/magahi/magahi.ts with the corpus counts; pinned here so a future
    // editor who reads only "word-initial" cannot narrow it silently.
    [Theory]
    [InlineData("पाण्डव", "pˈɑnɖəb")]
    [InlineData("महाकाव्य", "məɦɑkˈɑbd͡ʒ")]
    [InlineData("भारतीय", "bʱˈɑɾt̪id͡ʒ")]
    public void GlideHardeningIsNotPositional(string word, string ipa) =>
        Assert.Equal(ipa, MagahiPhonemizer.PhonemizeWord(word));

    // Magahi's own ordinal suffix मा, declared in magahi.jsonc. Before it, the inherited Hindi table
    // (वाँ/वीं/वें) claimed none of the corpus's 15 ordinals and मा was spoken as its own word.
    [Theory]
    [InlineData("१७मा शताब्दी", "sət̪ɾˈəɦmɑ sət̪ˈɑbd̪i")]
    [InlineData("१०मा बेर", "d̪ˈəsmɑ bˈeɾ")]
    [InlineData("२३मा मुख्यमन्त्री", "t̪eˈismɑ mukʰd͡ʒəmˈənt̪ɾi")]
    // …and मा as an ordinary word, not after a digit, is untouched.
    [InlineData("स्थल मा भद्रकाली", "st̪ʰˈəl mˈɑ bʱˈəd̪ɾəkɑli")]
    // ⚠ THE DECLARATION IS ADDITIVE. `own?.ordinalSuffixes ?? MANIFEST.ordinalSuffixes` overrides
    // WHOLESALE, so a block holding only मा silently removes Hindi's rows and its suppletive arm.
    [InlineData("१६वीं सदी", "solˈəɦbĩ sˈəd̪i")]
    [InlineData("१ला", "pˈəɦlɑ")]
    [InlineData("२रा", "d̪ˈusɾɑ")]
    // …with the guards those arms carry intact: था is the past copula, not 2's suffix.
    [InlineData("२था", "d̪ˈo t̪ʰˈɑ")]
    [InlineData("२राज्य", "d̪ˈo ɾˈɑd͡ʒː")]
    [InlineData("१० वापस", "d̪ˈəs bˈɑpəs")]
    public void Ordinals(string text, string ipa) => Assert.Equal(ipa, Say(text));

    // The tiers mag inherits from Hindi, none of them declared in magahi.jsonc: the shared symbol tier
    // (₹ and %), the Devanagari unit abbreviations, the clock, and the Indian lakh/crore grouping — all
    // reached through NATIVE Devanagari digits, which the registry's foldNativeDigits pass supplies.
    [Theory]
    [InlineData("₹५००", "pˈɑ̃t͡ʃ sˈɔ ɾˈupd͡ʒe")]
    [InlineData("५०%", "pˈət͡ʃɑs pɾˈət̪isət̪")]
    [InlineData("१२ किमी", "bˈɑɾəɦ kˈilomiʈəɾ")]
    [InlineData("१०:३०", "d̪ˈəs bˈəd͡ʒkəɾ t̪ˈis mˈinəʈ")]
    [InlineData("२०१९", "d̪ˈo ɦˈəzɑɾ ˈunːis")]
    [InlineData("१,००,०००", "ˈek lˈɑkʰ")]
    [InlineData("३०°C", "t̪ˈis ɖˈiɡɾi sˈelsid͡ʒəs")]
    public void InheritedTiers(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Fact]
    public void AboveTwoToThe53TheDigitsStillRead()
    {
        // core/numbers.ts spellDigits: above 2^53 the reading is a digit string, and the LAST digit must
        // survive — mag is not on ACCEPTED_LOSSY in test/large-numeral-fidelity.test.ts.
        Assert.NotEqual(Say("१२३४५६७८९०१२३४५६७८९०१२"), Say("१२३४५६७८९०१२३४५६७८९०१३"));
    }

    [Fact]
    public void EmbeddedLatinRunsGoToEnglish()
    {
        // createMagahi(readAsEnglish) — the registry injects the English reader for embedded Latin.
        var got = Say("भारत में Wikipedia");
        Assert.DoesNotContain("Wikipedia", got);
        Assert.Contains("w", got);
    }
}
