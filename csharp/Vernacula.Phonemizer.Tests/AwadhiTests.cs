/**
 * ⚠ awa's 200-row golden is MINED Awadhi Wikipedia prose, so it pins the common path hard and says nothing
 * about the rare one — 0 rows carry a clock time, 1 carries ₹, and 3 carry ⟨ऽ⟩ (4 occurrences), NONE of
 * them word-final, which is the only position where the avagraha changes a reading. These tests carry the
 * rest: the six documented divergences from Hindi (a Hindi-shaped engine would look plausible while being
 * wrong at every one) and the corners the mined text happens not to contain. Expectations are test/awadhi.test.ts's
 * plus readings taken off the TypeScript engine; see src/languages/awadhi/awadhi.ts for the sourcing.
 */
using Vernacula.Phonemizer.Languages.Awadhi;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class AwadhiTests
{
    public AwadhiTests() => Languages.Bootstrap.EnsureRegistered();

    [Theory]
    // (1) SIBILANT MERGER श/ष→[s]: Awadhi has no /ʃ/ at all. शहर also pins (5) — no Hindi əɦə→ɛɦɛ lowering.
    [InlineData("शहर", "sˈəɦəɾ")]
    [InlineData("देश", "d̪ˈeːs")]
    [InlineData("भाषा", "bʱˈaːsaː")]
    // (2) INTERVOCALIC FLAP ड/ढ→ɽ/ɽʱ …
    [InlineData("सडक", "sˈəɽək")]
    [InlineData("गढा", "ɡˈəɽʱaː")]
    [InlineData("पडोसी", "pəɽˈoːsiː")] // …surviving the stress mark the engine already inserted…
    [InlineData("कडैल", "kˈəɽʌil")] // …and reaching a ʌi/ʌu DIPHTHONG onset, which only (4) creates.
    // …and its three exceptions: a nasal CONSONANT, a nasalised VOWEL, and word-initial position.
    [InlineData("अंडा", "ˈə̃ɳɖaː")]
    [InlineData("अँडा", "ˈə̃ɖaː")]
    [InlineData("डर", "ɖˈəɾ")]
    [InlineData("अड्डा", "ˈəɖɖaː")] // a geminate is not followed by a vowel
    // (3) व→[w], not Hindi's labiodental ʋ.
    [InlineData("अवधी", "ˈəwd̪ʱiː")]
    [InlineData("विशाल", "wɪsˈaːl")]
    // (4) ऐ/औ→[ʌi]/[ʌu], central-onset DIPHTHONGS — not Bhojpuri's ɛ/ɔ and not Hindi's ɛː/ɔː.
    [InlineData("बैल", "bˈʌil")]
    [InlineData("कौन", "kˈʌun")]
    // (6) word-final avagraha RETAINS the schwa; the minimal pair is the whole rule.
    [InlineData("रामऽ", "ɾˈaːmə")]
    [InlineData("राम", "ɾˈaːm")]
    // ⚠ PINNED, NOT ENDORSED: awadhi.jsonc has no ज्ञ→ɡj post-rule, so ⟨ज्ञ⟩ reads [d͡ʒɲ]. Filed in
    // src/languages/awadhi/awadhi.ts as an undocumented divergence awaiting a referee.
    [InlineData("विज्ञान", "wɪd͡ʒɲˈaːn")]
    // ⟨ऋ⟩/⟨ृ⟩ write the TAP, unlike bhojpuri.jsonc's ASCII `ri` — the manifest's only rhotic is ɾ and this
    // agrees with it.
    [InlineData("कृष्ण", "kɾˈɪsɳ")]
    [InlineData("ऋषि", "ɾˈɪsɪ")]
    // Shared Indo-Aryan core, where Awadhi does not diverge.
    [InlineData("पानी", "pˈaːniː")]
    [InlineData("किताब", "kɪt̪ˈaːb")]
    public void WordReadsTheAwadhiDivergence(string word, string ipa) =>
        Assert.Equal(ipa, AwadhiPhonemizer.PhonemizeWord(word));

    [Theory]
    // The flap runs on text() output as a whole, so a space is the ONLY thing keeping it inside a word.
    [InlineData("गोडा डाल", "ɡˈoːɽaː ɖˈaːl")]
    // ⚠ NOT the bare number. awa declares no symbolTier, so HINDI's claims ₹ before this engine's
    // `stripSymbols` sees it — see the header of src/languages/awadhi/awadhi.ts.
    [InlineData("₹500", "pˈaː̃t͡ʃ sˈʌu ɾˈʊpjeː")]
    [InlineData("५०%", "pət͡ʃˈaːs pɾˈət̪ɪsət̪")]
    // Native digits, and the inherited Hindi clock rule the golden never reaches.
    [InlineData("१६ घंटा २० मिनट", "sˈoːləɦ ɡʱˈə̃ɳʈaː bˈiːs mˈɪnəʈ")]
    [InlineData("१०:३० बजे", "d̪ˈəs bˈəd͡ʒkəɾ t̪ˈiːs mˈɪnəʈ")]
    [InlineData("५५० ईसा पूर्व", "pˈaː̃t͡ʃ sˈʌu pət͡ʃˈaːs ˈiːsaː pˈuːɾw")]
    public void TextReadsRunningAwadhi(string text, string ipa) =>
        Assert.Equal(ipa, Phonemizer.Phonemize(text, "awa"));
}
