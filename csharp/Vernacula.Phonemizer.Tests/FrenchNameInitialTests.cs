/**
 * #1480. JS `\b` is ASCII-only even under the `u` flag, so the name-initial rule saw a word boundary between an
 * accented letter and the next one (`Unión.` read *Unióenne*), and the plural honorifics are not Lexique rows
 * (`Mmes` went to the Roman-ordinal pass, `Mlles` to the tagger). Ported from test/french.test.ts.
 * ⚠ Every expected reading is DERIVED — the same engine on the spelled-out form — never typed IPA.
 */
using Vernacula.Phonemizer.Languages.French;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class FrenchNameInitialTests
{
    [Fact]
    public void AWordsLastLetterAfterAnAccentedLetterIsNotALoneInitial()
    {
        Assert.Equal("Le syndicat Unión. Il part.", Normalize.NormalizeFrench("Le syndicat Unión. Il part."));
        Assert.Equal("Les plats cuisinés. Ils sont bons.", Normalize.NormalizeFrench("Les plats cuisinés. Ils sont bons."));
        Assert.Equal(
            $"{Phonemizer.Phonemize("Les plats cuisinés.", "fr")} {Phonemizer.Phonemize("Ils sont bons.", "fr")}",
            Phonemizer.Phonemize("Les plats cuisinés. Ils sont bons.", "fr"));
        // The same `\b` fronted the abbreviation rules: `p.` after `á` was read as *page*.
        Assert.Equal("Il cite Čáp. Puis il part.", Normalize.NormalizeFrench("Il cite Čáp. Puis il part."));
    }

    [Fact]
    public void ARealInitialStillReadsAsItsLetterName()
    {
        Assert.Equal($"{Manifest.MANIFEST.LetterNames["n"]} Wayne Hale", Normalize.NormalizeFrench("N. Wayne Hale"));
        Assert.Equal($"({Manifest.MANIFEST.LetterNames["j"]} Martin)", Normalize.NormalizeFrench("(J. Martin)"));
    }

    [Theory]
    [InlineData("fr")]
    [InlineData("fr-CA")]
    public async Task MmesAndMllesReadAsMesdamesAndMesdemoiselles(string lang)
    {
        var mesdames = Phonemizer.Phonemize("mesdames Dupont et Martin.", lang);
        var mesdemoiselles = Phonemizer.Phonemize("mesdemoiselles Dupont et Martin.", lang);
        foreach (var t in new[] { "Mmes Dupont et Martin.", "Mmes. Dupont et Martin.", "MMES Dupont et Martin." })
        {
            Assert.Equal(mesdames, Phonemizer.Phonemize(t, lang)); // was dø miljɛm — a Roman ordinal
            Assert.Equal(mesdames, await Phonemizer.PhonemizeAsync(t, lang));
        }
        foreach (var t in new[] { "Mlles Dupont et Martin.", "Mlles. Dupont et Martin." })
        {
            Assert.Equal(mesdemoiselles, Phonemizer.Phonemize(t, lang));
            Assert.Equal(mesdemoiselles, await Phonemizer.PhonemizeAsync(t, lang));
        }
        Assert.Equal(Phonemizer.Phonemize("Bonjour mesdames.", lang), Phonemizer.Phonemize("Bonjour Mmes.", lang));
    }

    [Fact]
    public void TheSingularsStayLexiquesTokensAndBareMmStaysTheUnit()
    {
        Assert.Equal("Mme Curie et Mlle Dupont", Normalize.NormalizeFrench("Mme Curie et Mlle Dupont"));
        Assert.Equal("10 MM", Normalize.NormalizeFrench("10 MM"));
    }
}
