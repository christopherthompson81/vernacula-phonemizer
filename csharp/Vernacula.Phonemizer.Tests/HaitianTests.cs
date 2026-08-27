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

    [Theory]
    // A decimal with a letter against it. ⚠ DECLINING IS NOT NEUTRAL — the guard that refused these left the
    // separator in place and the tokenizer read it as CLAUSE PUNCTUATION, so the "safe" branch emitted a full
    // stop mid-phrase AND lost the fractional part's leading zero. ×0 in the golden; twelve in the corpora,
    // six real and six DOI/URL fragments that the LEADING guard already refused.
    [InlineData("17.09m.", "disɛt viɡil zewo nɛf m .")]  // was `disɛt . nɛf m .` — and the 0 was gone
    [InlineData("1.00mm", "ɛ̃ viɡil zewo zewo milimɛt")]
    [InlineData("7.5cm", "sɛt viɡil sɛ̃k sãtimɛt")]
    [InlineData("442.7k", "kat sã kaɣãnde viɡil sɛt k")]
    [InlineData("1.9pwen", "ɛ̃ viɡil nɛf pwɛ̃")]
    // ⚠ TWO OF THE TWELVE ARE normalize.ts's OWN QUOTED ATTESTATIONS — cited as evidence for other rules
    // while they were reading a spurious full stop.
    [InlineData("1 a 1,5m", "ɛ̃ a ɛ̃ viɡil sɛ̃k m")]
    [InlineData("50cm a 1,80m", "sɛ̃kãt sãtimɛt a ɛ̃ viɡil katɣevɛ̃ m")]
    // …and a dotted CHAIN still declines, from either direction.
    [InlineData("1.2.3", "ɛ̃ . de . twa")]
    [InlineData("jpcl.16.1.07par", "ʒpkl . sɛz . ɛ̃ . sɛt paɣ")]
    // A spaced decimal is unmoved, and so is the leading-zero rule.
    [InlineData("17.09 m", "disɛt viɡil zewo nɛf m")]
    [InlineData("0,4 rebon", "zewo viɡil kat ɣebɔ̃")]
    public void ADecimalIsStillADecimalWhenALetterTouchesIt(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "ht"));
}
