// The portable half of test/wolof.test.ts — Wolof (wo), Atlantic-Congo over the Latin orthography.
// NON-tonal. Two rules live in code rather than the table: CONSONANT GEMINATION and the ⟨n⟩→ŋ assimilation.
using Vernacula.Phonemizer;
using WoEngine = Vernacula.Phonemizer.Languages.Wolof.WolofPhonemizer;
using WoNormalize = Vernacula.Phonemizer.Languages.Wolof.Normalize;
using WoNumbers = Vernacula.Phonemizer.Languages.Wolof.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class WolofTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "wo").Trim();

    [Theory]
    // The ATR vowel pairs, and DOUBLING = LENGTH.
    [InlineData("cere", "cɛrɛ")]
    [InlineData("jigéen", "ɟiɡeːn")]
    [InlineData("gox", "ɡɔx")]
    [InlineData("góor", "ɡoːr")]
    [InlineData("kër", "kər")]
    // The palatal STOPS, the dorsals, and ⟨ñ⟩.
    [InlineData("baaxoñ", "baːxɔɲ")]
    [InlineData("ndox", "ndɔx")]
    [InlineData("ñuul", "ɲuːl")]
    // ⚠ THE TWO CODE RULES: gemination, and nasal assimilation before a velar.
    [InlineData("benn", "bɛnː")]
    [InlineData("làkk", "laːkː")]   // ⟨à⟩→aː AND ⟨kk⟩→kː in one word
    [InlineData("dëjj", "dəɟː")]
    [InlineData("Angale", "aŋɡalɛ")]
    [InlineData("weex", "wɛːx")]    // a doubled VOWEL is length, not a geminate
    public void TheGreedyScan(string word, string want) => Assert.Equal(want, WoEngine.PhonemizeWord(word));

    [Theory]
    // ⚠ THE QUINARY 6–9 — 5+n compounds on `juróom`, multi-word by design.
    [InlineData(5, "juróom")]
    [InlineData(6, "juróom benn")]
    [InlineData(7, "juróom ñaar")]
    [InlineData(8, "juróom ñett")]
    [InlineData(9, "juróom ñeent")]
    // The `fukk` tens take the multiplier FIRST, and it may itself be quinary.
    [InlineData(10, "fukk")]
    [InlineData(15, "fukk ak juróom")]
    [InlineData(20, "ñaar fukk")]
    [InlineData(21, "ñaar fukk ak benn")]
    [InlineData(47, "ñeent fukk ak juróom ñaar")]
    [InlineData(90, "juróom ñeent fukk")]     // (5+4)×10 — doubly quinary
    [InlineData(99, "juróom ñeent fukk ak juróom ñeent")]
    // The hundreds, thousands and the two borrowed magnitudes.
    [InlineData(100, "téeméer")]
    [InlineData(101, "téeméer ak benn")]
    [InlineData(555, "juróom téeméer ak juróom fukk ak juróom")]
    [InlineData(1000, "junni")]
    [InlineData(12345, "fukk ak ñaar junni ak ñett téeméer ak ñeent fukk ak juróom")]
    [InlineData(1000000, "milyoŋ")]
    [InlineData(2000000, "ñaar milyoŋ")]
    [InlineData(1000000000, "milyaar")]
    public void TheQuinaryComposer(double n, string want) => Assert.Equal(want, WoNumbers.NumberToWords(n));

    [Theory]
    [InlineData("6", "ɟuroːm bɛnː")]
    [InlineData("20", "ɲaːr fukː")]
    [InlineData("5%", "ɟuroːm ci teːmeːr")]
    // ⚠ ITS DEFECT PRODUCED A READING, NOT A LEAK: the gemination rule claims ⟨mm⟩, so `150mm` read as a
    // plausible Wolof geminate where a millimetre belongs.
    [InlineData("150mm", "teːmeːr ak ɟuroːm fukː milimɛt")]
    [InlineData("15.85", "fukː ak ɟuroːm ɟuroːm ɲɛtː ɟuroːm")]
    public void TheWholePipeline(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // PERCENT → `ci téeméer`, postposed — spaced and glued.
    [InlineData("Wolof (43,3 %)", "Wolof (43 3 ci téeméer)")]
    [InlineData("20,3% ci jéeri", "20 3 ci téeméer ci jéeri")]
    [InlineData("5% ci at", "5 ci téeméer ci at")]
    // CURRENCY: the bare sign, the US$ compound key, and the magnitude connective.
    [InlineData("$375", "375 dolaar")]
    [InlineData("US$5 ngir jàll", "5 dolaar ngir jàll")]
    [InlineData("US$ 65 milyoŋ", "65 milyoŋ ciy dolaar")]
    [InlineData("$12 miliyaar ciy dolaar", "12 miliyaar ciy dolaar")]  // said once, not twice
    // UNITS.
    [InlineData("2 798 km", "2798 kilomet")]
    [InlineData("146km", "146 kilomet")]
    [InlineData("40 cm", "40 sàntimet")]
    [InlineData("1,5 kg", "1 5 kilogaraam")]
    [InlineData("ci km kaare lay tollu", "ci kilomet kaare lay tollu")]
    // The exponent: superscript, ASCII, and the semicolon-less HTML entity.
    [InlineData("30.065.000 km²", "30065000 kilomet kaare")]
    [InlineData("4,033 km2", "4033 kilomet kaare")]
    [InlineData("74.900.000 km&sup2", "74900000 kilomet kaare")]
    [InlineData("74.900.000 km&sup2;", "74900000 kilomet kaare")]      // idempotent with core/markup.ts
    // DEGREES → `aj`, between the operands, with the redundancy guard.
    [InlineData("12°8 ak 16°41", "12 aj 8 ak 16 aj 41")]
    [InlineData("0° walla 20°", "0 aj walla 20 aj")]
    [InlineData("wu 60° (60 aj) ci bëj-gànnaar", "wu 60 (60 aj) ci bëj-gànnaar")]
    [InlineData("série B, n° 3", "série B, n° 3")]
    // RANGES → `ba`, and the shapes that must NOT be claimed.
    [InlineData("Senghor(1906-2001)", "Senghor(1906 ba 2001)")]
    [InlineData("( 1265 - 1321 g )", "( 1265 ba 1321 g )")]
    [InlineData("yàggug 10-20 fan", "yàggug 10 ba 20 fan")]
    [InlineData("Jëf 19:26-27 21:27", "Jëf 19:26-27 21:27")]           // SCRIPTURE, not a span
    [InlineData("1–1 mooy", "1–1 mooy")]                               // non-ascending
    [InlineData("1,602 189 2 ∙ 10 -19 C", "1602 189 2 ∙ 10 -19 C")]    // not after a multiplication dot
    // ⚠ a range that ENDS A CLAUSE is still a range (trap 58).
    [InlineData("yàggug 15-20.", "yàggug 15 ba 20.")]
    [InlineData("atum 1939–1940.", "atum 1939 ba 1940.")]
    [InlineData("atum 1939–1940,", "atum 1939 ba 1940,")]
    // DE-GROUPING: all three conventions, and the leading-zero guard that spares a decimal.
    [InlineData("$150,000", "150000 dolaar")]
    [InlineData("am na 605 695 ciy way-dëkk", "am na 605695 ciy way-dëkk")]
    [InlineData("tollu ci 112.622 yu kaare", "tollu ci 112622 yu kaare")]
    [InlineData("doomi aadama ci 0.449 ci 2021", "doomi aadama ci 0 4 4 9 ci 2021")]
    // DECIMALS read digit by digit, and the verse lists that are not decimals.
    [InlineData("Am 15.85 miliyoŋ", "Am 15 8 5 miliyoŋ")]
    [InlineData("ak 2,8 milyoŋ", "ak 2 8 milyoŋ")]
    [InlineData("ci Jëf 2:9; 19:10,22,26,27", "ci Jëf 2:9; 19:10,22,26,27")]
    // The dotted era and honorific markers are DE-DOTTED, never expanded.
    [InlineData("Ci 27 g.K. la juddu", "Ci 27 g K la juddu")]
    [InlineData("Yonnant bi (j.m) daan na", "Yonnant bi (j m) daan na")]
    [InlineData("atum 1967 g.K. Te delloosi", "atum 1967 g K. Te delloosi")]
    [InlineData("atum 1967 g.K.", "atum 1967 g K.")]
    [InlineData("ci wo.wikipedia bi", "ci wo.wikipedia bi")]           // every element must be ONE letter
    // The ampersand is `ak` — but the ENTITY fold runs first.
    [InlineData("soul, R&B, disco", "soul, R ak B, disco")]
    [InlineData("suufus 10&nbsp;km.", "suufus 10 kilomet.")]
    [InlineData("20°. &alpha di ab ngungu", "20 aj. alpha di ab ngungu")]
    // ⚠ THE REFUSALS, pinned so they cannot start firing by accident.
    [InlineData("Marko 14:2 ak Ge 1:26", "Marko 14:2 ak Ge 1:26")]
    [InlineData("ci 31/12/2007", "ci 31/12/2007")]
    [InlineData("cer (2/3) yu fekke", "cer (2/3) yu fekke")]
    [InlineData("baziira = gisug xol", "baziira = gisug xol")]
    public void TheNormalizer(string input, string want) => Assert.Equal(want, WoNormalize.NormalizeWolof(input));

    /** The decimal comma still declines a range whose right operand continues into a fraction. */
    [Fact]
    public void ADecimalCommaDeclinesTheRange() =>
        Assert.DoesNotContain(" ba ", WoNormalize.NormalizeWolof("atum 1939–1940,5"), StringComparison.Ordinal);

    /** No digit leak, sentinel or gap anywhere in the composer's dense range. */
    [Fact]
    public void NoLeakAcrossTheDenseRange()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var w = WoNumbers.NumberToWords(n);
            Assert.False(w.Contains("undefined") || w.Contains("NaN") || w.Any(char.IsAsciiDigit), $"n={n}");
        }
    }
}
