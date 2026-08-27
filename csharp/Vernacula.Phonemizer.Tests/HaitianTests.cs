// The portable half of test/haitian.test.ts — the branches the 200-row golden cannot reach, and the
// intra-word marks the port was asked to measure.
//
// ⚠ HAITIAN ORTHOGRAPHY PUTS BOTH THE APOSTROPHE AND THE HYPHEN INSIDE WORDS (`l'ap`, `n'ap`, `ki-sa`,
// `pa-t`), so the word arm must not stop at either. It does not — but until #1073's class was swept here
// it stopped at the TYPOGRAPHIC apostrophe, and the two spellings of one construction read differently.
using Vernacula.Phonemizer;
using HaitianNumbers = Vernacula.Phonemizer.Languages.Haitian.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class HaitianTests
{
    [Theory]
    // The elision is ONE word whichever apostrophe the source types.
    [InlineData("Li l'ap ale", "li lap ale")]
    [InlineData("Li l’ap ale", "li lap ale")]
    [InlineData("Se sa m'ap di", "se sa map di")]
    [InlineData("Se sa m’ap di", "se sa map di")]
    [InlineData("Mòn Lopital (Morne l'Hôpital)", "mɔn lopital moɣne lhopital")]
    [InlineData("Mòn Lopital (Morne l’Hôpital)", "mɔn lopital moɣne lhopital")]
    // The intra-word hyphen is the same class of mark and Haitian writes it too.
    [InlineData("Nou n’ap ale nan ki-sa a", "nu nap ale nã kisa a")]
    [InlineData("Se pa-t sa l'ap di", "se pat sa lap di")]
    // A quote mark that is NOT an elision is dropped rather than read, either way round.
    [InlineData("’moun yo", "mun jo")]
    [InlineData("moun’ yo", "mun jo")]
    public void IntraWordMarksKeepTheWordWhole(string text, string expected) =>
        Assert.Equal(expected, Phonemizer.Phonemize(text, "ht").Trim());

    [Theory]
    // The FRENCH VIGESIMAL RESIDUE — 70/80/90 are a score plus a teen, so no `tens` table can express them.
    [InlineData(21, "venteyen")]
    [InlineData(22, "vennde")]
    [InlineData(29, "ventnèf")]
    [InlineData(70, "swasanndis")]
    [InlineData(80, "katreven")]
    [InlineData(81, "katrevenen")]
    [InlineData(91, "katrevenonz")]
    [InlineData(99, "katrevendiznèf")]
    [InlineData(10000, "di mil")]
    [InlineData(1000000, "en milyon")]
    [InlineData(1000000000, "en milya")]
    public void NumberToWordsMatchesTheLspTable(int n, string expected) =>
        Assert.Equal(expected, HaitianNumbers.NumberToWords(n));
}
