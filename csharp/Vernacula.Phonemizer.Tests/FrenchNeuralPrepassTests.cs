/**
 * THE FRENCH NEURAL PRE-PASS SCANS THE NORMALIZED TEXT (#1463). Ported from test/fr-neural-prepass.test.ts.
 *
 * ⚠ IT SCANNED THE CALLER'S RAW INPUT, so a word the NORMALIZER creates (a unit word, a spelled-out letter)
 * was never offered to the tagger. ⚠ AND THE LETTER NAMES `effe`, `emme`, `ji` and the unit word `kilooctet`,
 * which the tagger misreads, are supplement rows, so they never reach it.
 *
 * A RECORDING STUB stands in for the ONNX tagger: it records each word offered and answers a marker, so the
 * tests need no model and a marker in the output would mean a supplement word took the tagger's reading.
 */
using System.Reflection;
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.French;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class FrenchNeuralPrepassTests
{
    private sealed class Recording : IWordStructuralTagger
    {
        public readonly List<string> Asked = new();
        public Task<string> Tag(string word)
        {
            lock (Asked) Asked.Add(word);
            return Task.FromResult("Q");
        }
    }

    [Fact]
    public async Task AUnitWordTheSymbolTierCreatesIsOfferedToTheTagger()
    {
        const string t = "un fichier de 5 Mo";
        Assert.Contains("mégaoctets", FrenchPhonemizer.CreateFrench().NormalizedFor(t)); // the premise
        var rec = new Recording();
        await FrenchNeural.PrepassWith(rec, t);
        Assert.Contains("mégaoctets", rec.Asked);
    }

    [Theory]
    [InlineData("la FM")]
    [InlineData("le J. Martin")]
    [InlineData("la RTJ")]
    [InlineData("un fichier de 5 ko")]
    public async Task ASupplementWordIsNotOfferedAndReadsAsTheSyncPath(string t)
    {
        var rec = new Recording();
        var best = await FrenchNeural.PrepassWith(rec, t);
        foreach (var w in new[] { "effe", "emme", "ji", "kilooctet", "kilooctets" }) Assert.DoesNotContain(w, rec.Asked);
        Assert.Equal(Phonemizer.Phonemize(t, "fr"), best);
    }

    /// It took an `isWord` it never read, documented as deciding acronym-vs-initialism; that decision is
    /// NormalizeFrenchInitialisms's.
    [Fact]
    public void NormalizeFrenchTakesNoLexicon() =>
        Assert.Single(typeof(Normalize).GetMethod(nameof(Normalize.NormalizeFrench), BindingFlags.Public | BindingFlags.Static)!.GetParameters());
}
