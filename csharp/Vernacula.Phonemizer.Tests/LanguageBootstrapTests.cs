// The registration seam — the C# stand-in for registry.ts's static imports, and the two ways it can be wrong.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Afrikaans;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LanguageBootstrapTests
{
    [Fact]
    public void BootstrapInstallsTheNeuralTable()
    {
        // ⚠ THE BOOTSTRAP OWNS BOTH TABLES. It once registered only the sync engines, so the FIRST
        // phonemizeAsync call in a process found no neural entry, served the rule reading, and installed
        // the table on its way out — one wrong utterance per process, invisible from the second call on.
        // Found by the parity gate (af: 1 of 200 rows, the first), not by any unit test, which is why the
        // invariant is pinned here.
        Registry.EnsureLanguages();
        Assert.NotNull(NeuralRegistry.GetNeuralPhonemizer("af"));
        Assert.NotNull(Phonemizer.GetNeuralPhonemizer("af"));
    }

    [Fact]
    public void UnportedLanguageIsReportedRatherThanGuessedAt()
    {
        // A missing engine must be a NAMED failure. The script router catches this exception and drops the
        // run, so without the record a golden row simply differs and reads as a porting bug in the language
        // that was ported — Quechua's Cyrillic rows are read by the RUSSIAN engine.
        // ⚠ THE SAMPLE MUST BE A LANGUAGE THAT IS STILL UNPORTED, so it changes as the port advances — it was
        // `de` until German landed. Pick one far down the queue rather than the next one up, so this does not
        // have to be edited every batch.
        Assert.Throws<NotImplementedException>(() => Registry.GetPhonemizer("th"));
        Assert.Contains("thai", Registry.PortPending);
    }

    [Theory]
    [InlineData("qu", "iskay chunka", "ˈiskaj ˈt͡ʃunka")]   // read off the TypeScript engine, not guessed
    [InlineData("af", "twee", "twˈiə")]           // ⟨tw⟩ is the glide, not [v] — the W_GLIDE_AFTER rule
    [InlineData("en", "virgin branson", "vˈɝd͡ʒɪn bɹˈænsən")]   // the ARPABET conditional vowels (ER/AH)
    [InlineData("ru", "XIX веке", "dʲɪvʲɪtnˈat͡sətɨj vʲˈekʲe")]   // the Roman pass takes ru's ORDINAL policy
    [InlineData("el", "15ο", "ðekato pempto")]   // the Greek ending is the CASE, and both members inflect
    [InlineData("en", "The word λόγος means word", "ðə wˈɝd loɣos mˈiːnz wˈɝd")]   // the script router reaches el
    public void PortedEnginesAnswer(string code, string text, string expected) =>
        Assert.Equal(expected, Phonemizer.Phonemize(text, code));

    [Fact]
    public async Task AfrikaansAsyncUsesTheTagger()
    {
        // The tagger tier sits between the two lexicons and the rules; on an OOV word the async reading
        // must differ from the rule reading, or the tier is not wired at all.
        const string oov = "dreinsisteme";
        var rules = AfrikaansPhonemizer.PhonemizeWordRules(oov);
        var async = await Phonemizer.PhonemizeAsync(oov, "af");
        Assert.NotEqual(rules, async);
    }
}
