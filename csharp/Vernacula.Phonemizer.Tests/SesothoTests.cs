// The portable half of test/sesotho.test.ts — Sesotho / Southern Sotho (st), Bantu S33 over the SOUTH
// AFRICAN orthography (the decision, and why a Lesotho form cannot be transposed into it, is in the TS).
//
// ⚠ st HAS NO FLEURS SPLIT (verified, not assumed — the catalogue says `fleurs 0` and the only Sotho-group
// transcript is `nso_za`), so PORTING.md's corpus-wide differential is unavailable and the weight falls on
// these plus the off-golden probes. See docs/investigations/st/st_port_investigation.md.
using Vernacula.Phonemizer;
using StEngine = Vernacula.Phonemizer.Languages.Sesotho.SesothoPhonemizer;
using StNormalize = Vernacula.Phonemizer.Languages.Sesotho.Normalize;
using StNumbers = Vernacula.Phonemizer.Languages.Sesotho.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SesothoTests
{
    [Theory]
    // The kaikki anchor, and the signatures: EJECTIVE plain stops against the aspirates, ⟨hl⟩→ɬ, ⟨h⟩→ɦ,
    // ⟨kg⟩→kχ, ⟨a⟩→ɑ.
    [InlineData("phuputso", "pʰupʼut͡sʼɔ")]
    [InlineData("lehlohonolo", "lɛɬɔɦɔnɔlɔ")]
    [InlineData("kgotso", "kχɔt͡sʼɔ")]
    [InlineData("ntate", "ntʼɑtʼɛ")]
    public void TheGreedyScan(string word, string want) => Assert.Equal(want, StEngine.PhonemizeWord(word));

    [Theory]
    // Units are the BARE counting stems — 6–9 are relative verb forms and take no class prefix.
    [InlineData(0, "lefeela")]
    [InlineData(7, "supa")]
    [InlineData(9, "robong")]
    // Teens and 21–99 use the motso/metso dummy noun, with cl.6 after mashome and cl.4 after metso.
    [InlineData(11, "leshome le motso o le mong")]
    [InlineData(12, "leshome le metso e mmedi")]
    [InlineData(21, "mashome a mabedi le motso o le mong")]
    [InlineData(42, "mashome a mane le metso e mmedi")]
    // Hundreds are multiplicative with cl.6 concord.
    [InlineData(100, "lekgolo")]
    [InlineData(300, "makgolo a mararo")]
    [InlineData(555, "makgolo a mahlano le mashome a mahlano le metso e mehlano")]
    // Thousands are cl.7/8 nouns, and the magnitudes are bare for 1×.
    [InlineData(1000, "sekete")]
    [InlineData(2000, "dikete tse pedi")]
    [InlineData(1000000, "milione")]
    [InlineData(1000000000, "bilione")]
    public void TheCardinalComposer(double n, string want) => Assert.Equal(want, StNumbers.NumberToWords(n));

    [Theory]
    [InlineData("21", "mɑʃɔmɛ ɑ mɑbɛdi lɛ mɔt͡sʼɔ ɔ lɛ mɔŋ")]
    [InlineData("1000", "sɛkʼɛtʼɛ")]
    // ⚠ ⟨kg⟩ IS A DECLARED SESOTHO GRAPHEME, so `50 kg` was reading as one velar affricate — trap 56, a
    // defect that produces a READING and that no leak class can see.
    [InlineData("50 kg", "dikʰilɔxrɑmɑ t͡sʼɛ mɑʃɔmɛ ɑ mɑɬɑnɔ")]
    public void TheWholePipeline(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "st").Trim());

    [Fact]
    public void RegistryWiring() => Assert.Equal("sɛkʼɛtʼɛ", Phonemizer.Phonemize("1000", "st").Trim());

    [Theory]
    // PERCENT and CURRENCY: the measure noun heads its phrase, with the cl.8/10 concord `tse`.
    [InlineData("50%", "diperesente tse 50")]
    [InlineData("$675", "didolara tse 675")]
    [InlineData("R470 bilione", "diranta tse bilione tse 470")]
    [InlineData("£15,500", "diponto tse 15500")]           // …and the grouping comma is spent
    [InlineData("US$100 milione", "didolara tsa Amerika tse milione tse 100")]
    // The percent word is not said twice — either spelling, either orthography.
    [InlineData("diperesente tse 1.5%", "diperesente tse 1 5")]
    [InlineData("liporesente tse 25%", "liporesente tse 25")]
    [InlineData("diphesente tse 35", "diphesente tse 35")]
    // UNITS.
    [InlineData("12 km", "dikhilomithara tse 12")]
    [InlineData("1,395 m", "dimithara tse 1395")]
    [InlineData("50 kg", "dikhilograma tse 50")]
    // The exponent branch — and the ASCII form, which was read as the NUMBER two.
    [InlineData("603 628 km²", "disekwere dikhilomithara tse 603628")]
    [InlineData("632,702 km2", "disekwere dikhilomithara tse 632702")]
    [InlineData("37,99 km²", "disekwere dikhilomithara tse 37 9 9")]
    // The rate, which the corpus writes only as km/h — and the range runs BEFORE the tier.
    [InlineData("0-100 km/h", "0 ho isa ho dikhilomithara tse 100 ka hora")]
    // RANGES take `ho isa ho`, ascending only.
    [InlineData("10-20", "10 ho isa ho 20")]
    [InlineData("2016-17", "2016-17")]                     // non-ascending: a season, not a span
    [InlineData("COVID-19", "COVID-19")]                   // letter-flanked: a designation
    // ⚠ a clause-final range still takes its joiner (trap 58).
    [InlineData("7-10.", "7 ho isa ho 10.")]
    [InlineData("1933 - 1945.", "1933 ho isa ho 1945.")]
    [InlineData("73–94.", "73 ho isa ho 94.")]
    // A currency-glued magnitude letter is spent BEFORE the metre key can claim it.
    [InlineData("R2.3m", "diranta tse dimilione tse 2 3")]
    [InlineData("$2.5bn", "didolara tse dibilione tse 2 5")]
    // Grouping, the dotted date and the decimal — all three were CLAUSE BREAKS.
    [InlineData("1,500", "1500")]
    [InlineData("603 628", "603628")]
    [InlineData("30.01.1912", "30 01 1912")]
    [InlineData("32.9", "32 9")]                           // no separator word is emitted
    [InlineData("*28.11.1820", "*28 11 1820")]
    // The ampersand is `le`, and the entity table is consulted first.
    [InlineData("Arts & Sciences", "Arts le Sciences")]
    [InlineData("African Union&nbsp;(AU)", "African Union (AU)")]
    [InlineData("Ntat&#39;a Rōna", "Ntat’a Rōna")]         // ⚠ an ORTHOGRAPHIC apostrophe, not decoration
    // Dotted capital runs lose their interior sentence breaks.
    [InlineData("ka 4000 B.C. Li ne li entsoe", "ka 4000 BC Li ne li entsoe")]
    [InlineData("thomo ea May 2011 U.S. ea ho bolaea", "thomo ea May 2011 US ea ho bolaea")]
    // The English ordinal suffix is stripped; Sesotho writes its own ordinals as words.
    [InlineData("60th", "60")]
    [InlineData("1st", "1")]
    // ⚠ THE REFUSALS, each with its measurement in the TS: no hectare, no clock, no `=`, no degree or scale
    // word, no cm/mm/l, no `€`.
    [InlineData("64 ha ba na mosebetsi", "64 ha ba na mosebetsi")]
    [InlineData("1:10 Le Molimo", "1:10 Le Molimo")]       // Genesis 1:10 — a verse, not a clock
    [InlineData("ka nako ya 1:56.72", "ka nako ya 1:56.72")] // a race time
    [InlineData("ScaleMajor = unit:year increment:11000", "ScaleMajor = unit:year increment:11000")]
    [InlineData("32.9°C", "32 9°C")]                       // the sign stays VISIBLE to the gate
    [InlineData("12 cm", "12 cm")]
    [InlineData("€ 959", "€ 959")]
    public void TheNormalizer(string input, string want) => Assert.Equal(want, StNormalize.NormalizeSesotho(input));

    /** A DOI's inner pair and a decimal tail must not be read as spans. */
    [Fact]
    public void TheRangeGuardDeclinesADoiAndADecimal()
    {
        Assert.Contains("1469-8219", StNormalize.NormalizeSesotho("etsa:10.1111/1469-8219.00039"), StringComparison.Ordinal);
        Assert.DoesNotContain("ho isa ho", StNormalize.NormalizeSesotho("5-13.7"), StringComparison.Ordinal);
        Assert.DoesNotContain("ho isa ho", StNormalize.NormalizeSesotho("5-13,7"), StringComparison.Ordinal);
    }

    /** No digit leak, sentinel or gap anywhere in the composer's dense range. */
    [Fact]
    public void NoLeakAcrossTheDenseRange()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var w = StNumbers.NumberToWords(n);
            Assert.False(w.Contains("undefined") || w.Contains("NaN") || w.Any(char.IsAsciiDigit), $"n={n}");
        }
    }
}
