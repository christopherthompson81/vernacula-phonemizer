/**
 * #1585 — number and unit misreadings in the west group that the Rust port found (cy, ga, eu, an, ast, oc).
 * Every input is a SYNTHETIC probe; relations are used where a well-formed twin exists, so no IPA is typed.
 * Ported from test/west-defects-1585.test.ts.
 */
using Xunit;
using An = Vernacula.Phonemizer.Languages.Aragonese;
using Ast = Vernacula.Phonemizer.Languages.Asturian;
using Cy = Vernacula.Phonemizer.Languages.Welsh;
using Eu = Vernacula.Phonemizer.Languages.Basque;
using Ga = Vernacula.Phonemizer.Languages.Irish;
using Oc = Vernacula.Phonemizer.Languages.Occitan;

namespace Vernacula.Phonemizer.Tests;

public class WestDefects1585Tests
{
    private static string Say(string lang, string s) => Phonemizer.Phonemize(s, lang).Trim();
    private static string Last(string s) => s.Split(' ')[^1];

    [Fact]
    public void Welsh()
    {
        Assert.Equal(Say("cy", "4.5 m"), Say("cy", "4.5m"));
        Assert.NotEqual(Say("cy", "802.11 metr"), Say("cy", "802.11n"));
        var km = Last(Say("cy", "5 km"));
        Assert.Equal(km, Last(Say("cy", "2.5 km")));
        Assert.Equal(km, Last(Say("cy", "1-2 km")));
        Assert.Contains("cilomedr", Cy.Normalize.NormalizeWelsh("1-2 km"));
        Assert.Equal("1/0", Cy.Normalize.NormalizeWelsh("1/0"));
        Assert.Equal("1/1", Cy.Normalize.NormalizeWelsh("1/1"));
        Assert.Equal("hanner", Cy.Normalize.NormalizeWelsh("1/2"));
    }

    [Fact]
    public void Irish()
    {
        Assert.Equal("Bhí sé 5 go dtí 3.", Ga.Normalize.NormalizeIrish("Bhí sé 5-3."));
        Assert.DoesNotContain("go dtí", Ga.Normalize.NormalizeIrish("1.5-2.5"));
        Assert.Equal("leath", Ga.Normalize.NormalizeIrish("1/2"));
        Assert.Equal("an cúigiú", Ga.Normalize.NormalizeIrish("1/5"));
        Assert.Equal(Say("ga", "4.5 m"), Say("ga", "4.5m"));
    }

    [Fact]
    public void Basque()
    {
        Assert.Equal("20 gradu", Eu.Normalize.NormalizeBasque("20°"));
        Assert.Equal("20 gradu", Eu.Normalize.NormalizeBasque("20º"));
        Assert.Equal("10 gradutik", Eu.Normalize.NormalizeBasque("10°tik"));
        Assert.Equal("26 gradu Celsius", Eu.Normalize.NormalizeBasque("26 °C"));
        Assert.Equal(Say("eu", "2,5 km"), Say("eu", "2.5 km"));
        Assert.Equal(Say("eu", "8,0ko"), Say("eu", "8.0ko"));
        Assert.DoesNotContain("koma", Eu.Normalize.NormalizeBasque("Am 2.18.19-26"));
        Assert.Equal(Say("eu", "5eko"), Say("eu", "5-eko"));
        Assert.Equal("995-ko", Eu.Normalize.NormalizeBasque("995-ko"));
    }

    [Fact]
    public void Aragonese()
    {
        Assert.Equal(Say("an", "5:30"), Say("an", "-5:30"));
        Assert.Equal("menos 5", An.Normalize.NormalizeAragonese("-5"));
        Assert.Equal(Say("an", "20° U"), Say("an", "20° W"));
    }

    public static TheoryData<string> OnTheHour => new() { "an", "ast", "oc" };

    [Theory]
    [MemberData(nameof(OnTheHour))]
    public void ATimeOnTheHourIsTheHourAlone(string lang)
    {
        Func<string, string> normalize = lang switch
        {
            "an" => An.Normalize.NormalizeAragonese,
            "ast" => Ast.Normalize.NormalizeAsturian,
            _ => Oc.Normalize.NormalizeOccitan,
        };
        Assert.Equal("9", normalize("9:00"));
        Assert.Equal("9 30", normalize("9:30"));
        Assert.Equal(Say(lang, "9"), Say(lang, "9:00"));
    }
}
