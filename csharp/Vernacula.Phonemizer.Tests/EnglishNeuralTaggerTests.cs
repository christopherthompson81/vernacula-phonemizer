/**
 * The English neural OOV tagger's AVAILABILITY contract.
 * Ported from test/enNeural.test.ts.
 *
 * ⚠ THE FALLBACK IS SILENT UNLESS SOMETHING RECORDS WHY. Returning null rather than throwing is the policy —
 * an optional model must not take an utterance down — but the two catches in CreateEnglishTagger were bare,
 * so Onnx.LoadOrt's diagnosable message was built and discarded, and no caller, CLI or test could tell a
 * neural reading from an n-gram one. The gap is not cosmetic: on the words the dictionary misses the two
 * paths agree with misaki's lexicon 31.0% vs 19.9%, and -able/-ible is misread 28.9% of the time vs 0.2%.
 * These tests are what keep the reason wired up.
 */
using System.IO;
using System.Threading.Tasks;
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishNeuralTaggerTests
{
    /// <summary>The optional model, gated the way test/enNeural.test.ts gates on it.</summary>
    private static bool HaveModel()
    {
        try { return File.Exists(DataPath.ResolveAllowMissing("languages/english/en-g2p-tagger.int8.onnx")); }
        catch { return false; }
    }

    [Fact]
    public async Task AModelItCannotReadYieldsNoTaggerAndAReasonThatNamesIt()
    {
        Registry.EnsureLanguages();
        Assert.Null(await EnglishTaggerFactory.CreateEnglishTagger("definitely-not-a-model"));

        var why = EnglishTaggerFactory.UnavailableReason;
        Assert.False(string.IsNullOrEmpty(why));
        // Names the thing that failed, not just "error" — this string is the whole point of the change.
        Assert.Contains("definitely-not-a-model", why);
        Assert.Contains("English neural OOV G2P model", why);
    }

    [Fact]
    public async Task ATaggerThatBuildsClearsTheReason()
    {
        Registry.EnsureLanguages();
        if (!HaveModel()) return;   // no optional model here: nothing to assert
        Assert.NotNull(await EnglishTaggerFactory.CreateEnglishTagger());
        Assert.Null(EnglishTaggerFactory.UnavailableReason);
    }
}
