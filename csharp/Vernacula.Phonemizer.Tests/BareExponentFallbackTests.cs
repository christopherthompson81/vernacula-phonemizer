/**
 * The UNDECLARED bare-exponent fallback (#1041) — the digits a language with no `bareExponent` still says.
 *
 * ⚠ THE GOLDENS BARELY COVER THIS. The fix moved six rows in four languages, so the parity gate would stay
 * green if the C# half of it were dropped in every OTHER engine. These cases carry the rule itself: what the
 * fallback emits, and the four things it declines — a letter base, a negative exponent, a lone ⁰/¹, and a
 * unit noun standing on either side of the mark.
 * Ported from test/bare-exponent.test.ts — see src/core/normalizeSymbols.ts for the corpus evidence.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class BareExponentFallbackTests
{
    private static string Say(string text, string lang) => Phonemizer.Phonemize(text, lang);

    [Theory]
    [InlineData("sw")]
    [InlineData("id")]
    [InlineData("ha")]
    public void AnUndeclaredLanguageKeepsTheDigits(string lang)
    {
        Assert.Equal(Say("10 6", lang), Say("10⁶", lang));
        Assert.Equal(Say("20 2", lang), Say("20²", lang));
    }

    [Fact]
    public void ALetterBaseIsDeclined()
    {
        // A unit, a romanization tone number, an isotope or a footnote far more often than a power.
        Assert.Equal(Say("E = mc", "sw"), Say("E = mc²", "sw"));
        Assert.Equal(Say("khan³⁵-ban⁵⁵", "id"), Say("khan-ban", "id")); // a Chao tone number shape
    }

    [Fact]
    public void ANegativeExponentIsDeclined()
    {
        // No sign word to spend, and this tier runs after the language's own minus rule — emitting the
        // digits alone would invert the value.
        Assert.Equal(Say("10", "sw"), Say("10⁻¹⁹", "sw"));
    }

    [Fact]
    public void ALoneZeroOrOneIsADegreeSignOrAPrime()
    {
        Assert.Equal(Say("360", "en"), Say("360⁰", "en"));
        Assert.Contains("pʰˈaᶷɚ", Say("10¹⁰", "en")); // …a multi-digit run starting with one is a real power
    }

    [Fact]
    public void AUnitBesideTheMarkOwnsIt()
    {
        // The mark BEFORE the noun is the unit's power: it is cleared, and clearing it also restores the
        // unit's own reading, whose adjacency to the number the mark was breaking.
        Assert.Equal(Say("3540 km", "sw"), Say("3540² km", "sw"));
        // ⚠ ONLY A SQUARE OR A CUBE — a larger power beside a unit is the NUMBER's magnitude and keeps it.
        Assert.Equal("kˈumi sˈita kilomˈita", Say("10⁶ km", "sw").Trim());
    }

    [Fact]
    public void AnEngineOffTheSharedTierCallsTheSamePass()
    {
        // ps has its own unit table — the tier cannot express its word order — so it calls the pass itself,
        // after that table. 5 rows of its artifact write scientific notation and every one read as bare
        // *lˈəs* ("ten"). ⚠ NO GOLDEN ROW MOVES for this, in either language: the gate cannot see it.
        Assert.Equal(Say("10 6", "ps"), Say("10⁶", "ps"));
        Assert.Equal(Say("10", "ps"), Say("10⁻¹⁹", "ps"));            // negative still declined
        Assert.Contains("mət̪ˈər mərbˈəʔ", Say("۵ km²", "ps"));       // …and its own unit rule untouched
    }

    [Fact]
    public void ADeclaredLanguageStillReadsTheWord()
    {
        Assert.Contains("skwˈɛɹd", Say("20²", "en"));
        Assert.Contains("skwˈɛɹ kəlˈɑːmʌt̬ɚz", Say("19500 km²", "en")); // the unit path keeps first claim
    }
}
