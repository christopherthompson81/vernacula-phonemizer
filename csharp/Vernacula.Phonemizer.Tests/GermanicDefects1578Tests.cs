/**
 * #1578: the da/nb/af/bar defects the Rust port of the Germanic group found. Ported from
 * test/germanic-defects-1578.test.ts. Relational throughout, so no IPA is typed.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Afrikaans;
using Vernacula.Phonemizer.Languages.Danish;
using Vernacula.Phonemizer.Languages.Norwegian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class GermanicDefects1578Tests
{
    private static bool HaveModel(string path)
    {
        try { return File.Exists(DataPath.ResolveAllowMissing(path)); }
        catch { return false; }
    }

    /** The words the pre-pass offers the tagger, with a tagger that records and declines. Needs no model. */
    private static async Task<List<string>> Offered(string text, Func<string, Func<string, string?>, string> render)
    {
        var seen = new List<string>();
        await StructuralTagger.AskedWordsNeuralPrepass(text, w => { seen.Add(w); return Task.FromResult(""); }, render);
        return seen;
    }

    [Fact]
    public async Task DaOffersANumbersWords()
    {
        var da = DanishPhonemizer.CreateDanish();
        Assert.Contains("syvogfyrre", await Offered("47", (t, o) => da.Text(t, w => o(w))));
    }

    [Fact]
    public async Task NbOffersTheNativisedWholeTokenAndTheNumberWords()
    {
        var nb = NorwegianPhonemizer.CreateNorwegian();
        var words = await Offered("Dvořák og 200", (t, o) => nb.Text(t, w => o(w)));
        Assert.Contains("Dvorak", words);
        Assert.Contains("tohundre", words);
    }

    [Fact]
    public async Task AfOffersANormalizerWordButNeverALetterName()
    {
        var af = AfrikaansPhonemizer.CreateAfrikaans();
        Assert.Contains("fahrenheit", await Offered("Dit is 90°F.", (t, o) => af.Text(t, w => o(w))));
        Assert.DoesNotContain("er", await Offered("Die USSR het geval.", (t, o) => af.Text(t, w => o(w))));
    }

    [Fact]
    public async Task DaANumberReadsAsItsWrittenOutWordOnTheBestPath()
    {
        Registry.EnsureLanguages();
        if (!HaveModel("languages/danish/da-g2p-tagger.int8.onnx")) return; // no optional model here
        Assert.Equal(await DanishNeural.PhonemizeDaNeural("syvogfyrre"), await DanishNeural.PhonemizeDaNeural("47"));
        Assert.Equal(await DanishNeural.PhonemizeDaNeural("Den enogtyvende maj."),
            await DanishNeural.PhonemizeDaNeural("Den 21. maj."));
    }

    [Fact]
    public async Task NbNativisedWordsAndNumbersReachTheTagger()
    {
        Registry.EnsureLanguages();
        if (!HaveModel("languages/norwegian/nb-g2p-tagger.int8.onnx")) return;
        Assert.Equal(await NorwegianNeural.PhonemizeNbNeural("Han bor i Dvorak."),
            await NorwegianNeural.PhonemizeNbNeural("Han bor i Dvořák."));
        Assert.Equal(await NorwegianNeural.PhonemizeNbNeural("Sao"), await NorwegianNeural.PhonemizeNbNeural("São"));
        Assert.Equal(await NorwegianNeural.PhonemizeNbNeural("tohundre"), await NorwegianNeural.PhonemizeNbNeural("200"));
    }

    [Fact]
    public async Task AfANormalizerWordReachesTheTaggerAndALetterNameDoesNot()
    {
        Registry.EnsureLanguages();
        if (!HaveModel("languages/afrikaans/af-g2p-tagger.int8.onnx")) return;
        Assert.Equal(await AfrikaansNeural.PhonemizeAfNeural("Dit is negentig grade Fahrenheit."),
            await AfrikaansNeural.PhonemizeAfNeural("Dit is 90°F."));
        Assert.Equal(Phonemizer.Phonemize("Die USSR het geval.", "af"),
            await AfrikaansNeural.PhonemizeAfNeural("Die USSR het geval."));
    }

    [Theory]
    [InlineData("da", "Den 07. maj.", "Den 7. maj.")]
    [InlineData("da", "Den 07. og 08. maj.", "Den 7. og 8. maj.")]
    [InlineData("nb", "Den 07. mai.", "Den 7. mai.")]
    public void AZeroPaddedOrdinalReadsAsTheUnpaddedOne(string lang, string padded, string plain) =>
        Assert.Equal(Phonemizer.Phonemize(plain, lang), Phonemizer.Phonemize(padded, lang));

    [Fact]
    public void BarAFinalAAfterASilentHIsNotReduced()
    {
        foreach (var w in new[] { "Aha", "Oha" }) Assert.False(Phonemizer.Phonemize(w, "bar").Trim().EndsWith("ɐ"), w);
        Assert.EndsWith("ɐ", Phonemizer.Phonemize("Bana", "bar").Trim());
    }
}
