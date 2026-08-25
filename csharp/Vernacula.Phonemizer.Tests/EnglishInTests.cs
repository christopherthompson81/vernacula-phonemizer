/**
 * Indian English (en-IN) — the GenAm engine plus a context-free surface delta, applied PER WORD.
 * Ported from src/languages/english-in/english-in.ts.
 *
 * ⚠ WHAT THIS EXISTS TO CATCH is the REGISTRATION and the rules' ORDER and GUARDS, not the GenAm phonology —
 * the golden covers that. `Registry.Build` routed `en-IN` to a factory key nothing registered.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.EnglishIn;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishInTests
{
    [Fact]
    public void TheVariantIsRegisteredAtAll()
    {
        Assert.False(string.IsNullOrEmpty(Phonemizer.Phonemize("tin", "en-IN")));
    }

    [Fact]
    public void RetroflexionSparesTheTiedAffricates()
    {
        Assert.Contains("ʈ", Phonemizer.Phonemize("tin", "en-IN"));
        Assert.Contains("ɖ", Phonemizer.Phonemize("dog", "en-IN"));
        // ⚠ THE TIE GUARD IS THE WHOLE POINT: church/judge must keep t͡ʃ and d͡ʒ. Without the (?!U+0361)
        // lookahead the affricates become ʈ͡ʃ / ɖ͡ʒ, which is not GIE and not any English.
        var church = Phonemizer.Phonemize("church and judge", "en-IN");
        Assert.Contains("t͡ʃ", church);
        Assert.Contains("d͡ʒ", church);
        Assert.DoesNotContain("ʈ͡ʃ", church);
        Assert.DoesNotContain("ɖ͡ʒ", church);
    }

    [Fact]
    public void ThStoppingRunsAfterRetroflexionSoThinIsNotTin()
    {
        // Both become stops; they stay distinct by PLACE — dental [t̪ʰ] vs retroflex [ʈ].
        Assert.Contains("t̪ʰ", Phonemizer.Phonemize("thin", "en-IN"));
        Assert.Contains("d̪", Phonemizer.Phonemize("this", "en-IN"));
        Assert.NotEqual(Phonemizer.Phonemize("thin", "en-IN"), Phonemizer.Phonemize("tin", "en-IN"));
        // ⚠ ORDER: run TH-stopping FIRST and the dental stops it creates get swept into ʈ/ɖ by the
        // retroflexion, collapsing exactly that distinction.
        Assert.DoesNotContain("ʈ", Phonemizer.Phonemize("thin", "en-IN"));
    }

    [Fact]
    public void TheVWMergerAndTheRhoticTap()
    {
        // wet = vet = ʋɛʈ.
        Assert.Equal(Phonemizer.Phonemize("wet", "en-IN"), Phonemizer.Phonemize("vet", "en-IN"));
        Assert.Contains("ʋ", Phonemizer.Phonemize("wet", "en-IN"));
        // GIE is RHOTIC with a tap — the coda /ɹ/ is kept and tapped, unlike en-GB which drops it.
        Assert.Contains("ɾ", Phonemizer.Phonemize("car", "en-IN"));
        Assert.DoesNotContain("ɹ", Phonemizer.Phonemize("car", "en-IN"));
        Assert.DoesNotContain("ɝ", Phonemizer.Phonemize("bird", "en-IN"));
    }

    [Fact]
    public void MonophthongisationHitsFaceAndGoatButNotPriceAndMouth()
    {
        Assert.Contains("eː", Phonemizer.Phonemize("they", "en-IN"));
        Assert.Contains("oː", Phonemizer.Phonemize("goat", "en-IN"));
        // PRICE and MOUTH stay diphthongs — the offglides become plain [ɪ]/[ʊ], they do not collapse.
        Assert.Contains("aɪ", Phonemizer.Phonemize("price", "en-IN"));
        Assert.Contains("aʊ", Phonemizer.Phonemize("mouth", "en-IN"));
    }

    [Fact]
    public void TheDeltaIsAppliedPerWordThroughTheEnginesWordTransform()
    {
        // ⚠ NOT a wrap of the assembled utterance, unlike es-419 and fr-CA. Threading it through English's
        // `wordTransform` is what keeps the delta off clause punctuation and inter-word material — so a
        // single word must read the same either way.
        Assert.Equal(EnglishIn.PhonemizeWord("tin"), Phonemizer.Phonemize("tin", "en-IN"));
        Assert.Equal(EnglishIn.PhonemizeWord("tin"), EnglishIn.PhonemizeWordRules("tin"));
    }
}
