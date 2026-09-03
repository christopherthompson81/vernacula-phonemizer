/**
 * Nigerian Pidgin (pcm) — the ONSET /r/ contract. Ported alongside src/languages/naija/naija.ts.
 *
 * ⚠ WHAT THIS EXISTS TO CATCH (#1250). Naija is non-rhotic, and `nativise` implements that as an onset rule
 * (`[ɹr]` before a vowel → `ɾ`) followed by a drop. Two things reached the drop that were not codas:
 *   · `ᵻ`, the parent's reduced vowel for unstressed `re-`/`ri-`, was missing from the onset rule's vowel
 *     string, so `ɹᵻ` failed the onset test and `reports` read *ipɔts* — the /r/ off the front of the word;
 *   · `ɚ`/`ɝ` were mapped to plain vowels BEFORE the onset rule could see them, on the reasoning that "the r
 *     is absorbed" — true in coda, false before a vowel, where the /r/ is the next syllable's onset.
 *     `around` read *aaund*, `correct` *kaɛkt*.
 * The fleet-wide audit over all 117,479 dict words lives in the TS (test/onset-r.test.ts), where the parent
 * engine is cheap to drive; the contract is pinned here. The golden covers the rest of the phonology.
 */
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class NaijaOnsetRTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "pcm");

    [Theory]
    [InlineData("reports", "ɾipɔts")]     // the reduced vowel is a vowel
    [InlineData("remember", "ɾimɛmba")]
    [InlineData("around", "aɾaund")]      // a PRE-VOCALIC ɚ is an onset /r/, not an absorbed one
    [InlineData("arrive", "aɾaiv")]
    [InlineData("correct", "kaɾɛkt")]
    public void AnOnsetRSurvives(string word, string want) => Assert.Equal(want, Say(word));

    [Theory]
    [InlineData("car", "ka")]             // …and in CODA it is still absorbed, which is the non-rhoticity
    [InlineData("market", "makat")]
    [InlineData("red", "ɾɛd")]            // a plain onset was always a tap and stays one
    public void ACodaRIsStillDropped(string word, string want) => Assert.Equal(want, Say(word));
}
