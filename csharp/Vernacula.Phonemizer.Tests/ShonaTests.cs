// The portable half of test/shona.test.ts — the branches the 200-row golden cannot reach.
//
// ⚠ SHONA HAS NO REFEREE FOR THE NORMALIZATION LAYER AT ALL (no wikipron, <25 kaikki entries, and
// `epitran sna-Latn` is word-only), so these assertions are the only gate on it in either engine. Each
// refusal is pinned as well as each rule: a refusal nothing asserts is indistinguishable from an oversight.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using ShonaNumbers = Vernacula.Phonemizer.Languages.Shona.Numbers;
using ShonaNormalize = Vernacula.Phonemizer.Languages.Shona.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ShonaTests
{
    [Theory]
    // The bare RECITATION series — sn.wikipedia states it, and says it is NOT what quantifies a noun.
    [InlineData(1, "motsi")]
    [InlineData(9, "pfumbamwe")]
    [InlineData(10, "gumi")]
    [InlineData(12, "gumi ne piri")]
    // The class-6 concord INSIDE the numeral: `makumi maviri`, never the bare stem.
    [InlineData(20, "makumi maviri")]
    [InlineData(98, "makumi mapfumbamwe ne sere")]
    [InlineData(100, "zana")]
    [InlineData(200, "mazana maviri")]
    [InlineData(305, "mazana matatu ne shanu")]
    [InlineData(431, "mazana mana ne makumi matatu ne motsi")]
    // Thousands take the class-8 concord, and the magnitude LEADS its count.
    [InlineData(1000, "chiuru")]
    [InlineData(2000, "zviuru zviviri")]
    [InlineData(8000, "zviuru zvisere")]
    [InlineData(3540, "zviuru zvitatu ne mazana mashanu ne makumi mana")]
    [InlineData(10000, "zviuru gumi")]
    [InlineData(100000, "zviuru zana")]
    // The million/billion arms the de-grouping rule exposed.
    [InlineData(1000000, "miriyoni")]
    [InlineData(1606000, "miriyoni ne zviuru mazana matanhatu ne tanhatu")]
    [InlineData(2e9, "mabhiriyoni maviri")]
    // Beyond the composer's range, digit-by-digit — the branch nothing else exercises.
    [InlineData(1e12, "motsi zero zero zero zero zero zero zero zero zero zero zero zero")]
    public void NumberToWordsComposes(double n, string want) => Assert.Equal(want, ShonaNumbers.NumberToWords(n));

    [Fact]
    public void TheCorpusWorkedReadingOf431257698() =>
        Assert.Equal(
            "mamiriyoni mazana mana ne makumi matatu ne motsi ne zviuru mazana maviri ne makumi mashanu ne nomwe"
                + " ne mazana matanhatu ne makumi mapfumbamwe ne sere",
            ShonaNumbers.NumberToWords(431257698));

    // ⚠ PAST 2^53 THE DOUBLE HAS ALREADY LOST DIGITS, so the fallback reads the RAW string the tokenizer
    // saw. Without the parameter a 22-digit run loses its tail — and the parity golden cannot see that.
    [Theory]
    [InlineData("1234567890123456789012", 22, "piri")]
    [InlineData("12345678901234567890123456789", 29, "pfumbamwe")]
    // ⚠ THE TWO THAT PIN IT: past 2^53 both parse to the SAME double, so a reading built from `String(n)`
    // would make them identical. The raw string is what keeps them apart.
    [InlineData("1000000000000000000001", 22, "motsi")]
    [InlineData("1000000000000000000009", 22, "pfumbamwe")]
    public void TheOverflowFallbackKeepsEveryDigitOfTheRaw(string raw, int digits, string lastWord)
    {
        var words = ShonaNumbers.NumberToWords(Js.Number(raw), raw).Split(' ');
        Assert.Equal(digits, words.Length);
        Assert.Equal(lastWord, words[^1]);
    }

    [Theory]
    [InlineData("piri", "maviri")]
    [InlineData("makumi maviri ne piri", "makumi maviri ne maviri")]
    [InlineData("zana ne shanu", "zana ne mashanu")]
    // Class 6 is a PLURAL, so "one" beside it is a class mismatch Shona solves by changing the NOUN.
    [InlineData("motsi", "motsi")]
    // A numeral ending in a magnitude word already carries its concord and must not be touched.
    [InlineData("makumi matatu", "makumi matatu")]
    public void WithClass6ConcordMovesOnlyTheFinalStem(string input, string want) =>
        Assert.Equal(want, ShonaNumbers.WithClass6Concord(input));

    [Theory]
    // Percent is POSTPOSED, and the word is `pazana` — the lower-count but only bare-postposed candidate.
    [InlineData("85%", "makumi masere ne ʃanu pazana")]
    // Currency: madhora, PREFIXED, with `US$` as its own key because this corpus GLUES the ISO code.
    [InlineData("$60", "mad̤ora makumi matan̤atu")]
    [InlineData("US$28,000", "mad̤ora ɀiuru makumi maʋiri ne masere")]
    [InlineData("ye$150", "je mad̤ora zana ne makumi maʃanu")]
    [InlineData("$2", "mad̤ora maʋiri")]
    // Units are PREFIXED and the rate connective is `pa`.
    [InlineData("3m", "mamita matatu")]
    [InlineData("105 kg", "makiroɡiramu zana ne maʃanu")]
    [InlineData("120 km/hr", "makiromita zana ne makumi maʋiri pa awa")]
    [InlineData("2 km", "makiromita maʋiri")]
    [InlineData("10 mm", "mamirimita ɡumi")]
    [InlineData("2 mm", "mamirimita maʋiri")]
    [InlineData("10 ha", "hekita ɡumi")]
    [InlineData("10 l", "rita ɡumi")]
    [InlineData("10 L", "rita ɡumi")]
    [InlineData("10 km/l", "makiromita ɡumi pa rita")]
    // The squared word is `maskweya`, BEFORE the unit noun. The last two are the shape `NOT_VERSION`
    // declines and Normalize step 7 claims locally.
    [InlineData("1m²", "maskweja mamita mot͡si")]
    [InlineData("0,5m²", "maskweja mamita zero koma ʃanu")]
    [InlineData("1.5m", "mamita mot͡si pojiⁿdi ʃanu")]
    [InlineData("60 x 6", "makumi matan̤atu kuwaⁿzana ne tan̤atu")]
    // A bare count of hours reads; the rate slot keeps the bare denominator form.
    [InlineData("8hr", "maawa masere")]
    [InlineData("8hrs", "maawa masere")]
    [InlineData("2 hrs", "maawa maʋiri")]
    // Local rules.
    [InlineData("1,606,000", "mirijoni ne ɀiuru mazana matan̤atu ne tan̤atu")]
    [InlineData("makore 25-30", "makore makumi maʋiri ne ʃanu kuȿika makumi matatu")]
    [InlineData("0-100 km/hr", "zero kuȿika makiromita zana pa awa")]
    [InlineData("32 ° C", "mad̤iɡiriji makumi matatu ne maʋiri kelsius")]
    [InlineData("ne180 °", "nemad̤iɡiriji zana ne makumi masere")]
    [InlineData("0 o C", "mad̤iɡiriji zero kelsius")]
    [InlineData("12.9cm", "maseⁿdimita ɡumi ne piri pojiⁿdi p͡fuᵐbamwe")]
    [InlineData("46–76&nbsp;kg", "makumi mana ne tan̤atu kuȿika makiroɡiramu makumi manomwe ne matan̤atu")]
    public void PhonemizesTheSymbolAndLocalArms(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "sn"));

    [Fact]
    // A Shona proclitic agrees with the HEAD NOUN, not the numeral, so the glued and spaced spellings of
    // the same particle give the same reading and no rule is needed (trap 14/15, measured harmless).
    public void AProcliticGluedToADigitRunReadsTheSameEitherWay()
    {
        Assert.Equal(Phonemizer.Phonemize("gore ra 1923", "sn"), Phonemizer.Phonemize("gore ra1923", "sn"));
        Assert.Equal("ɡore ra t͡ʃiuru ne mazana map͡fuᵐbamwe ne makumi maʋiri ne tatu",
            Phonemizer.Phonemize("gore ra1923", "sn"));
    }

    [Theory]
    [InlineData("US$7 000", "US$7000")]
    // Descending pairs are declined — a subtraction, a football score, an English magnitude glued on.
    [InlineData("59 - 32 = 27", "59 - 32 = 27")]
    [InlineData("Brazilians 3-0 mu Stade", "Brazilians 3-0 mu Stade")]
    [InlineData("imbwa 13-16million", "imbwa 13-16million")]
    // A clause-final or comma-followed range IS still a range; the decimal refusal lives in the LEFT guard.
    [InlineData("makore 25-30.", "makore 25 kusvika 30.")]
    [InlineData("March 20-21, 2019", "March 20 kusvika 21, 2019")]
    [InlineData("50-70.", "50 kusvika 70.")]
    [InlineData("Vhoriyamu 1984-5.", "Vhoriyamu 1984-5.")]
    [InlineData("Dzinoreba 2.1-3.4m", "Dzinoreba 2.1-3.4m")]
    // Dotted capital runs lose their interior dots but keep a sentence end — and put back the swallowed space.
    [InlineData("muna 3000 B.C. ne kutengeza", "muna 3000 BC ne kutengeza")]
    [InlineData("Zimbabwe state (1000 C.E. - 1830)", "Zimbabwe state (1000 CE - 1830)")]
    // ⚠ THE LIMIT, PINNED RATHER THAN FIXED: this rule keeps the letter-excluding left guard, so a run
    // with a proclitic glued to it is declined. Zero corpus instances; widening it would be trap 9.
    [InlineData("yakabva kuU.S.", "yakabva kuU.S.")]
    [InlineData("mwaka wechizana 19 - (19th Century)", "mwaka wechizana 19 - (19 Century)")]
    // No fraction rule, which also keeps the corpus's slashed DATES intact.
    [InlineData("Ndabaningi Sithole (31/07/1920", "Ndabaningi Sithole (31/07/1920")]
    [InlineData("Genesis 30:13", "Genesis 30:13")]
    [InlineData("zvibodzwa 3:2", "zvibodzwa 3:2")]
    // Neither pass may leave a doubled or edge space (the SLOT-GAP class).
    [InlineData(" makore 25-30 ", "makore 25 kusvika 30")]
    public void NormalizePreArms(string input, string want) => Assert.Equal(want, ShonaNormalize.NormalizeShonaPre(input));

    [Theory]
    // A comma-separated LIST of numbers is not a run of decimals — 0 of 11 claimed, and it takes BOTH
    // lookarounds to do it.
    [InlineData("3,4,6,7,8,9,10,4,11,2,1,4", "3,4,6,7,8,9,10,4,11,2,1,4")]
    [InlineData("273,15K", "273 koma 1 5K")]
    [InlineData("1.25", "1 poyindi 2 5")]
    [InlineData(" 12.9 ", "12 poyindi 9")]
    // No clock, no equals, no minus, no plus — every candidate carries a concord this layer cannot compute.
    [InlineData("iri pa 06:00hrs", "iri pa 06:00hrs")]
    [InlineData("Basa = Fosi", "Basa = Fosi")]
    [InlineData("chikwereti -$100", "chikwereti -$100")]
    [InlineData("kuyenzana na (22/7)", "kuyenzana na (22/7)")]
    // ⚠ THE CONCORD PASS DECLINES A DECIMAL OPERAND ON BOTH DIGIT LENGTHS. A one-digit integer part cannot
    // backtrack, so it passes even with a guard that is missing its `?` — the two-digit case is the pin.
    [InlineData("masendimita 5.5", "masendimita 5 poyindi 5")]
    [InlineData("madhora 25.5", "madhora 25 poyindi 5")]
    [InlineData("makiromita 12,5", "makiromita 12 koma 5")]
    [InlineData("madhora 25", "madhora makumi maviri ne mashanu")]
    public void NormalizePostArms(string input, string want) => Assert.Equal(want, ShonaNormalize.NormalizeShonaPost(input));

    [Fact]
    // A 24-hour clock is DELIBERATELY still raw: the unit belongs to neither half of `06:00`, and a
    // visible leak beats a confidently wrong quantity.
    public void TheTwentyFourHourClockStaysRaw() =>
        Assert.Contains("hrs", Phonemizer.Phonemize("06:00hrs", "sn"), StringComparison.Ordinal);

    [Fact]
    public void ThePlusSignIsLeftUnread() =>
        Assert.Contains("+", ShonaNormalize.NormalizeShonaPost("longitude +30 o E"), StringComparison.Ordinal);
}
