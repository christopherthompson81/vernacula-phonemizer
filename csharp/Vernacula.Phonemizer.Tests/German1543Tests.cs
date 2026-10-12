/**
 * #1543: a dotted abbreviation before , ; : ! ? keeps no dot of its own, and one before a closing German quote is
 * still expanded. Ported from test/german-1543.test.ts. Expectations are relational, never typed IPA.
 */
using Xunit;
using GermanNormalize = Vernacula.Phonemizer.Languages.German.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class German1543Tests
{
    [Theory]
    [InlineData("Es kostet 21 Mio., also viel.", "Es kostet 21 Millionen, also viel.")]
    [InlineData("Es kostet 1 Mio., also viel.", "Es kostet eine Million, also viel.")]
    [InlineData("Es sind 21 Mio.; danach mehr.", "Es sind 21 Millionen; danach mehr.")]
    [InlineData("Es sind 21 Mio.: genug.", "Es sind 21 Millionen: genug.")]
    [InlineData("Sind es 21 Mio.?", "Sind es 21 Millionen?")]
    [InlineData("Es sind 21 Mio.!", "Es sind 21 Millionen!")]
    [InlineData("Siehe S., dann weiter.", "Siehe Seite, dann weiter.")]
    [InlineData("Es kostet 21 Mio.", "Es kostet 21 Millionen.")]
    [InlineData("Es kostet 1 Mio.  ", "Es kostet eine Million.  ")]
    [InlineData("(Es sind 21 Mio.)", "(Es sind 21 Millionen.)")]
    [InlineData("Es sind 21 Mio... mehr", "Es sind 21 Millionen... mehr")]
    public void TheDotFollowsThePhraseEnd(string abbr, string plain) =>
        Assert.Equal(GermanNormalize.NormalizeGerman(plain), GermanNormalize.NormalizeGerman(abbr));

    [Theory]
    [InlineData("Er sagte »21 Mio.«", "Er sagte »21 Millionen.«")]
    [InlineData("Er sagte „21 Mio.“", "Er sagte „21 Millionen.“")]
    public void AClosingGermanQuoteIsAPhraseEnd(string abbr, string plain) =>
        Assert.Equal(Phonemizer.Phonemize(plain, "de"), Phonemizer.Phonemize(abbr, "de"));
}
