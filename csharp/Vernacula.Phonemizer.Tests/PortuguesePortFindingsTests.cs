/**
 * Three Portuguese defects the Rust port found by reading (#1463), fixed TS-first.
 * Ported from test/portuguese-port-findings.test.ts.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class PortuguesePortFindingsTests
{
    private static string Norm(string s, bool br = false) =>
        Languages.Portuguese.Normalize.NormalizePortuguese(s, br);

    [Fact]
    public void BrazilianClockReadsTheBrazilianTeens()
    {
        Assert.Equal("Às dezesseis horas e dezessete em ponto", Norm("Às 16h17 em ponto", true));
        Assert.Equal("Às dezenove horas e dezesseis", Norm("Às 19:16", true));
        Assert.Equal("ˈas dezesˈejs ˈɔɾɐs e dezesˈɛt͡ʃi ẽj̃ pˈõtu", Phonemizer.Phonemize("Às 16h17 em ponto", "pt-BR"));
        Assert.Contains(Phonemizer.Phonemize("17", "pt-BR"), Phonemizer.Phonemize("16h17", "pt-BR"));
        Assert.Contains(Phonemizer.Phonemize("17", "pt"), Phonemizer.Phonemize("16h17", "pt"));
    }

    [Fact]
    public void EuropeanClockKeepsTheEuropeanTeens()
    {
        Assert.Equal("Às dezasseis horas e dezassete em ponto", Norm("Às 16h17 em ponto"));
        Assert.Equal("Às dezanove horas e dezasseis", Norm("Às 19:16"));
    }

    [Theory]
    [InlineData("Comeu 17/19 do bolo", false, "Comeu dezassete décimos nonos do bolo")]
    [InlineData("Comeu 2/21 do bolo", false, "Comeu dois vigésimos primeiros do bolo")]
    [InlineData("Comeu 17/19 do bolo", true, "Comeu dezessete décimos nonos do bolo")]
    [InlineData("Comeu 16/17 do bolo", true, "Comeu dezesseis décimos sétimos do bolo")]
    [InlineData("Comeu 3/100 do bolo", false, "Comeu três centésimos do bolo")]
    [InlineData("Comeu 1/19 do bolo", false, "Comeu um décimo nono do bolo")]
    public void FractionPluralInflectsEveryWord(string text, bool br, string want) => Assert.Equal(want, Norm(text, br));

    [Fact]
    public void FractionIpa() =>
        Assert.Equal("kumˈew dɨzɐsˈetɨ dˈɛsimuʃ nˈonuʃ do bˈolu", Phonemizer.Phonemize("Comeu 17/19 do bolo", "pt"));

    [Theory]
    [InlineData("Mediu 1.000 °C", "Mediu 1.000 graus Celsius")]
    [InlineData("Mediu 1.000 °F", "Mediu 1.000 graus Fahrenheit")]
    [InlineData("Mediu 1.000°", "Mediu 1.000 graus")]
    [InlineData("Mediu 1 °C", "Mediu 1 grau Celsius")]
    [InlineData("Mediu 1,5 °C", "Mediu 1,5 graus Celsius")]
    [InlineData("Mediu 0.5 °C", "Mediu 0.5 graus Celsius")]
    public void DegreeCountsDotGroupedThousands(string text, string want) => Assert.Equal(want, Norm(text));

    [Fact]
    public void DegreeIpa() =>
        Assert.Equal("med͡ʒˈiw mˈiw ɡɾˈaws sewsˈiws", Phonemizer.Phonemize("Mediu 1.000 °C", "pt-BR"));
}
