/**
 * Québécois French (fr-CA) — the France engine plus a context-free surface delta.
 * Ported from src/languages/french-ca/french-ca.ts.
 *
 * ⚠ WHAT THIS EXISTS TO CATCH is the REGISTRATION and the three rules' INTERACTION, not the France
 * phonology — the golden covers that. `Registry.Build` routed `fr-CA` to a factory key nothing registered.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.FrenchCa;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class FrenchCaTests
{
    [Fact]
    public void TheVariantIsRegisteredAtAll()
    {
        Assert.False(string.IsNullOrEmpty(Phonemizer.Phonemize("tu", "fr-CA")));
    }

    [Fact]
    public void AffricationFiresBeforeHighFrontVowelsAndGlidesOnly()
    {
        Assert.Contains("t͡s", Phonemizer.Phonemize("tu es parti", "fr-CA"));      // before /y/
        Assert.Contains("d͡z", Phonemizer.Phonemize("dire la vérité", "fr-CA"));   // before /i/
        Assert.Contains("t͡s", Phonemizer.Phonemize("tuile du toit", "fr-CA"));    // before the glide /ɥ/
        // ⚠ NOT BEFORE BACK /u/ — `tout` stays [tu]. This is the rule's boundary, so it is the assertion
        // that would catch a widened character class.
        Assert.DoesNotContain("t͡s", Phonemizer.Phonemize("tout le monde", "fr-CA"));
        // …and France French has none of it.
        Assert.DoesNotContain("t͡s", Phonemizer.Phonemize("tu es parti", "fr"));
    }

    [Fact]
    public void LaxingRespectsTheLengtheningCodas()
    {
        // Closed syllable with a NON-lengthening coda → lax.
        Assert.Contains("ɪ", Phonemizer.Phonemize("six personnes", "fr-CA"));
        Assert.Contains("ʏ", Phonemizer.Phonemize("jupe longue", "fr-CA"));
        Assert.Contains("ʊ", Phonemizer.Phonemize("route nationale", "fr-CA"));
        // ⚠ THE LENGTHENING CODAS /ʁ v z ʒ/ KEEP THE VOWEL TENSE — the exclusion is the whole point of the
        // CODA class, and dropping it would lax these too.
        Assert.DoesNotContain("ɪ", Phonemizer.Phonemize("dire", "fr-CA"));
        // ⚠ AND `musique` LAXES, against what the TS docstring used to claim. The lengthening set is about
        // the coda AFTER the vowel; here the /z/ is an ONSET before /i/ and the real coda is /k/. Both
        // engines say myzɪk. This assertion is the corrected claim, not the documented one.
        Assert.Contains("ɪ", Phonemizer.Phonemize("musique", "fr-CA"));
        // An OPEN syllable keeps the tense vowel: petit [pt͡si] vs petite [pt͡sɪt].
        Assert.DoesNotContain("ɪ", Phonemizer.Phonemize("petit", "fr-CA"));
        Assert.Contains("ɪ", Phonemizer.Phonemize("petite", "fr-CA"));
    }

    [Fact]
    public void AffricationRunsBeforeLaxingBecauseItNeedsTheUnderlyingVowel()
    {
        // `petite` needs BOTH: t→t͡s before /i/, then that /i/ laxes to [ɪ] in the closed syllable. Run in the
        // other order the laxed [ɪ] no longer matches the affrication class and the t͡s is lost.
        var petite = Phonemizer.Phonemize("petite", "fr-CA");
        Assert.Contains("t͡s", petite);
        Assert.Contains("ɪ", petite);
    }

    [Fact]
    public void WordFinalAIsPosterior()
    {
        Assert.Contains("ɑ", Phonemizer.Phonemize("le Canada", "fr-CA"));
        Assert.DoesNotContain("ɑ", Phonemizer.Phonemize("le Canada", "fr"));
    }

    [Fact]
    public void TheDeltaIsContextFreeSoTheWordPathMatchesTheTextPath()
    {
        // fr-CA declares `PhonemizeWordRules` as an alias, unlike pt-BR where the two genuinely differ.
        Assert.Equal(FrenchCa.PhonemizeWord("petite"), FrenchCa.PhonemizeWordRules("petite"));
        Assert.Equal(FrenchCa.ToQuebecois(Phonemizer.Phonemize("petite", "fr")), Phonemizer.Phonemize("petite", "fr-CA"));
    }
}
