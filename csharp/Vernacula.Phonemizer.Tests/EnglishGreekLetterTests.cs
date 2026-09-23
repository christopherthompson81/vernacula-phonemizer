/**
 * A lone Greek letter is a SYMBOL, not Greek text (#1448). Ported from test/english-normalize.test.ts.
 *
 * ⚠ BEFORE THIS, EVERY GREEK LETTER IN ENGLISH WAS READ IN MODERN GREEK — `the β value` read
 * `ðə vita vˈæɫjuː` — and seven of the 24 emitted `ɣ`, `ɾ` or `ç`, phones english.jsonc does not declare.
 * A Kokoro backend REFUSES a supplied stream carrying an unknown symbol rather than dropping it, so one
 * `ɣ` takes out synthesis for the whole utterance.
 *
 * ⚠ THIS FILE EXISTS BECAUSE THE PORT HAD NO COVERAGE AT ALL FOR THE CLASS. No golden carries a Greek
 * code point either, so the trace-parity harness does not reach it — the two ports agreed when checked by
 * hand, and nothing would have said so had they stopped agreeing.
 */
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishGreekLetterTests
{
    private static string Norm(string s) => Normalize.NormalizeEnglish(s);

    [Theory]
    [InlineData("the β value", "the beta value")]
    [InlineData("α and Ω", "alpha and omega")]
    [InlineData("a σ of 3", "a sigma of 3")]
    public void ALoneLetterBecomesItsEnglishName(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /// <summary>A RUN of two or more is a WORD and stays Greek, for the foreign reader.</summary>
    [Theory]
    [InlineData("the word λόγος means word")]
    [InlineData("Ελλάδα is Greece")]
    public void ARunOfTwoOrMoreStaysGreek(string input) => Assert.Equal(input, Norm(input));

    /// ⚠ THE NAME IS SPACED OFF ITS NEIGHBOUR. Splicing it in glued the words — `Δx` became `deltax` and
    /// read `dˈɛɫtˌæks`. `Δx`/`Δt` are the commonest Greek-symbol shape in technical prose.
    [Theory]
    [InlineData("Δx is small", "delta x is small")]
    [InlineData("Δt", "delta t")]
    [InlineData("Σx", "sigma x")]
    public void TheNameIsSpacedOffALatinNeighbour(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /// ⚠ THE ACCENT IS THE GREEK-PROSE SIGNAL, and the guard has to see a DECOMPOSED one — a letter plus a
    /// combining mark — or the first letter of a Greek word becomes "alpha".
    [Theory]
    [InlineData("άλφα")]
    [InlineData("ά")]
    public void AnAccentedLetterIsPartOfAWord(string input) => Assert.Equal(input, Norm(input));

    /// <summary>`μ` and `Ω` are UNIT symbols before they are letter names, so the unit rule runs first.</summary>
    [Theory]
    [InlineData("a 5 μm layer", "a 5 micro meters layer")]
    [InlineData("set 5 Ω now", "set 5 ohms now")]
    [InlineData("a 1 Ω load", "a 1 ohm load")]
    [InlineData("the Ω value", "the omega value")]   // no number → the letter after all
    public void TheUnitReadingWinsOverTheLetterName(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /// ⚠ EVERY SPELLING OF THE PREFIXED OHM IS DECLARED, AND IT IS A 10⁹ QUESTION. `mΩ` written with
    /// U+2126 or a lowercase omega missed the exact table and fell to the FOLDED index, where
    /// `"mΩ".ToLowerInvariant()` is `"mω"` — the slot `MΩ` occupies. It read "mega ohms".
    [Theory]
    [InlineData("a 5 kΩ resistor", "a 5 kilo ohms resistor")]
    [InlineData("a 5 MΩ resistor", "a 5 mega ohms resistor")]
    [InlineData("a 5 mΩ shunt", "a 5 milli ohms shunt")]
    [InlineData("a 5 mΩ shunt", "a 5 milli ohms shunt")]
    [InlineData("a 5 mω shunt", "a 5 milli ohms shunt")]
    [InlineData("5 Ω total", "5 ohms total")]
    [InlineData("the Ω value", "the omega value")]
    public void EverySpellingOfTheOhmIsDeclared(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /// ⚠ THE SUPERSCRIPT IS CONSUMED HERE because step 6b caps a LETTER base at three characters
    /// (`Smith¹` is a footnote) and `omega` is five — so `Ω²` would otherwise lose its `²` outright.
    [Theory]
    [InlineData("Ω²", "omega squared")]
    [InlineData("χ² test", "chi squared test")]
    [InlineData("Ω²", "omega squared")]
    public void ATrailingSuperscriptIsRead(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /// ⚠ AND AN OPTIONAL GROUP BACKTRACKS: with only the trailing guard widened, `α²β` declined the `α`,
    /// matched the `β`, and emitted `α² beta` — stranding a raw superscript that is then dropped. Both
    /// guards refuse a superscript, so a two-letter expression is left whole for the router.
    [Theory]
    [InlineData("α²β")]
    [InlineData("Ω²Ω")]
    public void ASuperscriptBetweenTwoGreekLettersStrandsNothing(string input) =>
        Assert.Equal(input, Norm(input));
}
