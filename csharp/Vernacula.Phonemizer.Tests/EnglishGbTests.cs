/**
 * British English (en-GB) — the GenAm engine plus the RP lexical-set delta, applied PER WORD.
 * Ported from src/languages/english-gb/english-gb.ts.
 *
 * ⚠ WHAT THIS EXISTS TO CATCH is the REGISTRATION, the five SET LOADS, and the first-occurrence rule — not
 * the GenAm phonology, which the golden covers.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.EnglishGb;
using System.Threading.Tasks;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishGbTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "en-GB");

    [Fact]
    public void TheVariantIsRegisteredAtAll() => Assert.False(string.IsNullOrEmpty(Say("grass")));

    [Fact]
    public void AllFiveLexicalSetsAreActuallyLoaded()
    {
        // ⚠ THE FAILURE THIS GUARDS IS SILENT. `LoadTsvMap(optional: true)` returns an EMPTY map when the file
        // is missing, and en-GB then answers with the rule-only delta — plausible RP-ish IPA with the wrong
        // vowel in exactly the words the sets exist for. Nothing throws. Verified by breaking all five
        // filenames: 16 probe rows change.
        Assert.Contains("ɑː", Say("grass"));                 // BATH: æ → ɑː
        Assert.Contains("ɒ", Say("the dog"));                // CLOTH: ɔː → ɒ
        Assert.Contains("j", Say("a new student"));          // yod: Cuː → Cjuː
        Assert.Contains("ɑː", Say("father"));                // PALM: keeps ɑː against the LOT rule
        Assert.Contains("ɒ", Say("i am sorry"));             // LOTR: ɑːɹ → ɒɹ before a vowel
    }

    [Fact]
    public void TheLexicalVariantTableIsLoadedToo()
    {
        // ⚠ SAME SILENT FAILURE AS THE FIVE SETS ABOVE — `Lexical` is also `optional: true`, so a missing
        // file leaves en-GB answering with the parent's American WORD in plausible RP phonology. `process`
        // is the cheapest probe: LOT in GenAm, GOAT in British, and no accent rule travels between them,
        // so the əᶷ can only have come from the table.
        Assert.Contains("əᶷ", Say("process"));
        Assert.Contains("əᶷ", Say("progress"));
        Assert.Contains("aluminium", EnglishGb.LexicalVariants());
        // ...and NOT the participles, which the parent already reads as verbs — see the PROVENANCE file.
        Assert.DoesNotContain("progressed", EnglishGb.LexicalVariants());
    }

    [Fact]
    public void ALexicalRowGuardedOnAReadingLeavesTheOtherSenseAlone()
    {
        // ⚠ THE SUBSTITUTION IS POS-BLIND AND THE PARENT IS NOT. `progress` is pɹˈɑːɡɹɛs as a noun and
        // pɹəɡɹˈɛs as a verb; unguarded, the row put the NOUN's citation into a VERB frame. The row
        // names the GenAm reading it replaces, so it fires on one sense and not the other — and this is
        // the C# half of that contract, since both ports read the same file.
        Assert.Equal(Phonemizer.Phonemize("we progress quickly", "en"), Say("we progress quickly"));
        Assert.Equal(Phonemizer.Phonemize("she progresses well", "en"), Say("she progresses well"));
        Assert.Contains("əᶷ", Say("the progress is good"));
    }

    [Fact]
    public void BathAppliesToTheFirstOccurrenceOnly()
    {
        // ⚠ THE WHOLE REASON THESE FOUR REPLACEMENTS OMIT THE "g" FLAG. `aftermath` is a BATH word whose
        // LATER æ is a plain TRAP: ˈɑːftəmæθ, not ˈɑːftəmˌɑːθ. A global replace converts both and is wrong.
        var aftermath = Say("the aftermath of the storm");
        Assert.Contains("ɑːft", aftermath);
        Assert.Contains("æθ", aftermath);
    }

    [Fact]
    public void PalmBlocksTheLotRuleRatherThanRunningAfterIt()
    {
        // The LOT rule would turn father's [ɑː] into [ɒ]; PALM membership SKIPS the rule for that word.
        Assert.Contains("ɑː", Say("father"));
        // …and a non-PALM LOT word still lowers.
        Assert.Contains("ɒ", Say("hot pot"));
    }

    [Fact]
    public void NonRhoticityKeepsALinkingRBeforeAVowel()
    {
        // Coda /ɹ/ is dropped: car → kɑː.
        Assert.DoesNotContain("ɹ", Say("park the car"));
        // But ɚ/ɝ BEFORE a vowel keep a linking /ɹ/ — different → dɪfəɹənt.
        Assert.Contains("ɹ", Say("different"));
        // The r-coloured vowels are gone either way.
        Assert.DoesNotContain("ɝ", Say("a bird"));
        Assert.DoesNotContain("ɚ", Say("a better letter"));
    }

    [Fact]
    public void TheCentringDiphthongsReplaceVowelPlusCodaR()
    {
        Assert.Contains("ɪə", Say("come near"));    // NEAR
        Assert.Contains("ɛə", Say("a square"));     // SQUARE
        Assert.Contains("ɔː", Say("go north"));     // NORTH/FORCE
    }

    /// <summary>
    /// AN ONSET /r/ IS NEVER DELETED (#1250). Non-rhotic English drops CODA /r/ and never onset /r/, but the
    /// guard is a NEGATIVE test spelled out as a vowel string, and `ᵻ` — the reduced vowel the parent emits
    /// for unstressed `re-`/`ri-` — was missing from it. So `ɹᵻ` counted as "not before a vowel" and the /r/
    /// came off the FRONT of the word. The fleet-wide audit over all 117,479 dict words lives in the TS
    /// (test/onset-r.test.ts), where the parent engine is cheap to drive; what is pinned here is the
    /// contract, plus the stress-mark run that hid a vowel from the same guard.
    /// </summary>
    [Theory]
    [InlineData("reports", "ɹᵻpʰˈɔːts")]
    [InlineData("alacrity", "əlˈækɹᵻti")]   // NOT only word-initial — the /ɹ/ of the cluster `kɹ`
    [InlineData("asperity", "əspˈɛɹᵻti")]   // …and `ɛɹ` before `ᵻ` is not SQUARE
    [InlineData("authority", "əθˈɔːɹᵻti")]  // …nor `ɔːɹ` NORTH
    // ⚠ WAS `ɹipʰˈɔːt` AND WAS THE "TELL" HERE — a vowel that resolved to `i` rather than `ᵻ`, showing the
    // guard had not touched it. It is now `ᵻ` for an unrelated reason: `report` is a LATINATE `re-`, which
    // reduces (gold, Moby and Merriam-Webster all agree), so the dict row moved R IY0 → R IH0. The line
    // still earns its place — an onset /ɹ/ surviving beside the reduced vowel is exactly the contract —
    // but it is no longer the counter-example it was, and `greedier` below is what carries that now.
    [InlineData("report", "ɹᵻpʰˈɔːt")]
    [InlineData("greedier", "ɡɹˌˈiːdiə")]   // `ɡɹˌˈiːd̬iʲɚ` — two stress marks, one optional mark could not see past
    public void AnOnsetRSurvivesTheReducedVowel(string word, string want) =>
        Assert.Equal(want, EnglishGb.PhonemizeWord(word));

    [Theory]
    [InlineData("car", "kʰˈɑː")]
    [InlineData("market", "mˈɑːkət")]
    [InlineData("water", "wˈɔːtə")]
    public void ACodaRIsStillDropped(string word, string want) =>
        Assert.Equal(want, EnglishGb.PhonemizeWord(word));

    [Fact]
    public void TheRuleOnlyPathIsTheNonCircularSignalAndDiffersFromShipped()
    {
        // The referee eval scores `PhonemizeWordRules`, which must NOT consult the mined sets — otherwise the
        // score is circular. `grass` is a BATH word, so the two paths must disagree on it.
        Assert.NotEqual(EnglishGb.PhonemizeWordRules("grass"), EnglishGb.PhonemizeWord("grass"));
        // A word in no set reads the same either way.
        Assert.Equal(EnglishGb.PhonemizeWordRules("green"), EnglishGb.PhonemizeWord("green"));
    }

    [Fact]
    public async Task AsyncTakesTheTaggerThenTheDelta()
    {
        // ⚠ #1260: en-GB composes on the sync `en` engine, and its async path WAS the sync path — `Croydon` (OOV)
        // reached the n-gram, which doubled the vowel, and the RP delta faithfully carried *kɹˈɒɔᶦdɒn* into the
        // corpus. The variant now takes the same BiLSTM reading `en` does, then the delta.
        Assert.Equal("kɹˈɔᶦdən", (await Phonemizer.PhonemizeAsync("Croydon", "en-GB")).Trim());
        Assert.NotEqual(Phonemizer.Phonemize("Croydon", "en-GB").Trim(), (await Phonemizer.PhonemizeAsync("Croydon", "en-GB")).Trim());
        // A dictionary word and everything that is not an OOV word are byte-identical to the sync variant.
        const string s = "The cat sat on the mat in 1997 at Roydon.";
        Assert.Equal(Phonemizer.Phonemize(s, "en-GB"), await Phonemizer.PhonemizeAsync(s, "en-GB"));
        Assert.Equal("kɾˈɔɪɖən", (await Phonemizer.PhonemizeAsync("Croydon", "en-IN")).Trim());
    }
}
