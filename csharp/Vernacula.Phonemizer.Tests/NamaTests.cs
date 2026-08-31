// The portable half of test/nama.test.ts — Nama / Khoekhoe (naq), a Khoe-Kwadi CLICK language.
// ⚠ naq HAS NO GOLDEN AND NO CORPUS ARTIFACT in this repo, so these tests are the whole instrument.
using Vernacula.Phonemizer;
using NaEngine = Vernacula.Phonemizer.Languages.Nama.NamaPhonemizer;
using NaNormalize = Vernacula.Phonemizer.Languages.Nama.Normalize;
using NaNumbers = Vernacula.Phonemizer.Languages.Nama.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class NamaTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "naq").Trim();

    [Theory]
    // The click SYSTEM — the dental ⟨ǀ⟩ series × 5 accompaniments.
    [InlineData("ǀ", "ᵑ̊ǀˀ")] // BARE click → the glottalised nasal click
    [InlineData("ǀg", "ᵏǀ")] // ⟨g⟩ → tenuis
    [InlineData("ǀkh", "ᵏǀʰ")] // ⟨kh⟩ → aspirated
    [InlineData("ǀh", "ᵑ̊ǀʰ")] // ⟨h⟩ → aspirated nasal
    [InlineData("ǀn", "ᵑǀ")] // ⟨n⟩ → voiced nasal
    // The four click PLACES (bare = glottalised nasal at each place).
    [InlineData("ǁ", "ᵑ̊ǁˀ")]
    [InlineData("ǂ", "ᵑ̊ǂˀ")]
    [InlineData("ǃ", "ᵑ̊ǃˀ")]
    // Clicks in real words + ⟨kh⟩, ⟨g⟩→[x], final ⟨-b⟩→[p], long vowels.
    [InlineData("ǀgama", "ᵏǀama")] // ⟨ǀg⟩ tenuis click in a word
    [InlineData("ǂkhoab", "ᵏǂʰoap")] // ⟨ǂkh⟩ aspirated; final ⟨-b⟩→[p]
    [InlineData("ǃkhās", "ᵏǃʰaːs")] // ⟨ǃkh⟩; macron ⟨ā⟩ → long [aː]
    [InlineData("kharob", "kʰarop")] // ⟨kh⟩→[kʰ]; final ⟨-b⟩→[p]
    [InlineData("Khoekhoegowab", "kʰoekʰoexowap")] // ⟨g⟩ (not after a click) → [x]; ⟨w⟩→[w]
    // Nasalized (circumflex) vowels + doubled-vowel length.
    [InlineData("ǂgâ", "ᵏǂã")] // 'enter' — ⟨â⟩ → nasalized [ã] (phonemic in Nama)
    [InlineData("ǀî", "ᵑ̊ǀˀĩ")] // bare click + nasal [ĩ]
    [InlineData("khoraab", "kʰoraːp")] // doubled ⟨aa⟩ → long [aː]; final ⟨-b⟩→[p]
    public void TheClickSystem(string word, string want) => Assert.Equal(want, NaEngine.PhonemizeWord(word));

    [Theory]
    // SOLID disi compounds; the tens multiplier starts at TWO (20 = ǀgamdisi, never *ǀguidisi).
    [InlineData(1, "ǀgui")] // ⟨ǀg⟩ is the TENUIS click
    [InlineData(7, "hû")] // the circumflex is NASALITY, not tone
    [InlineData(20, "ǀgamdisi")]
    [InlineData(26, "ǀgamdisiǃnaniǀa")] // the ATTESTED worked example
    [InlineData(42, "hakadisiǀgamǀa")]
    [InlineData(100, "kaidisi")]
    [InlineData(1000, "ǀoadisi")] // bare ⟨ǀ⟩ = the glottalised nasal click
    [InlineData(555, "korokaidisi korodisikoroǀa")]
    [InlineData(12345, "disiǀgamǀa ǀoadisi ǃnonakaidisi hakadisikoroǀa")]
    // The two naturalised loan magnitudes published Khoekhoegowab actually uses.
    [InlineData(1000000, "miljun")]
    [InlineData(1000000000, "biljun")]
    // ZERO: no Khoekhoegowab zero could be sourced — the flagged Afrikaans contact-loan stopgap, not a
    // Nama numeral.
    [InlineData(0, "nul")]
    public void TheComposer(double n, string want) => Assert.Equal(want, NaNumbers.NumberToWords(n));

    [Theory]
    [InlineData("1", "ᵏǀui")]
    [InlineData("7", "hũ")]
    [InlineData("20", "ᵏǀamdisi")]
    [InlineData("26", "ᵏǀamdisiᵑǃaniᵑ̊ǀˀa")]
    [InlineData("42", "hakadisiᵏǀamᵑ̊ǀˀa")]
    [InlineData("100", "kaidisi")]
    [InlineData("1000", "ᵑ̊ǀˀoadisi")]
    [InlineData("555", "korokaidisi korodisikoroᵑ̊ǀˀa")]
    [InlineData("12345", "disiᵏǀamᵑ̊ǀˀa ᵑ̊ǀˀoadisi ᵑǃonakaidisi hakadisikoroᵑ̊ǀˀa")]
    [InlineData("1000000", "miljun")]
    [InlineData("1000000000", "biljun")]
    [InlineData("0", "nul")]
    public void TheCardinalsThroughThePipeline(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // #1140 — the macron vowels are LONG, not their bare counterparts.
    public void TheMacronVowelsAreLong()
    {
        Assert.Equal("haː", Say("hā"));
        Assert.Equal("ha", Say("ha"));
        Assert.NotEqual(Say("ha"), Say("hā"));
        Assert.Equal("ᵏǃʰaːs", Say("ǃkhās"));
        Assert.Equal(Say("haa"), Say("hā")); // …and length agrees with the doubled-vowel spelling
    }

    [Fact]
    // #1140 — the circumflex vowels are NASALIZED, not their bare counterparts.
    public void TheCircumflexVowelsAreNasalized()
    {
        Assert.Equal("hã", Say("hâ"));
        Assert.NotEqual(Say("ha"), Say("hâ"));
        Assert.Equal("ᵏǂã", Say("ǂgâ"));
        Assert.Equal("ᵑ̊ǀˀĩ", Say("ǀî"));
    }

    [Theory]
    // All ten accented vowels survive the nativiser rather than folding to their base.
    [InlineData("ā", "a")]
    [InlineData("ē", "e")]
    [InlineData("ī", "i")]
    [InlineData("ō", "o")]
    [InlineData("ū", "u")]
    [InlineData("â", "a")]
    [InlineData("ê", "e")]
    [InlineData("î", "i")]
    [InlineData("ô", "o")]
    [InlineData("û", "u")]
    public void AllTenAccentedVowelsSurviveTheNativiser(string acc, string bare) =>
        Assert.NotEqual(Say($"h{bare}"), Say($"h{acc}"));

    [Fact]
    // The normalize layer is the shared separator hygiene pass and nothing else: it spends digit separators
    // and emits no word.
    public void TheNormalizerIsTheSeparatorPassAndNothingElse()
    {
        Assert.Equal("1234567", NaNormalize.NormalizeNama("1 234 567"));
        Assert.Equal("15, 20", NaNormalize.NormalizeNama("15–20")); // en dash; the ASCII hyphen is left alone
        Assert.Equal("15-20", NaNormalize.NormalizeNama("15-20"));
        Assert.Equal("20 °C", NaNormalize.NormalizeNama("20 °C")); // a scale letter is read, not dropped
    }

    /** No digit leak, sentinel or gap anywhere in the composer's dense range. */
    [Fact]
    public void NoLeakAcrossTheDenseRange()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var w = NaNumbers.NumberToWords(n);
            Assert.False(w.Contains("undefined") || w.Contains("NaN") || w.Any(char.IsAsciiDigit), $"n={n}");
        }
    }
}
