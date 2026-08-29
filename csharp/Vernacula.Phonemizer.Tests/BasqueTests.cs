/**
 * Basque (eu) — euskara, a LANGUAGE ISOLATE. ⚠⚠ THE HALLMARK is the THREE-WAY SIBILANT / affricate system,
 * a laminal vs apical vs postalveolar contrast: ⟨z⟩→[s̻] ⟨s⟩→[s̺] ⟨x⟩→[ʃ], ⟨tz⟩→[t͡s̻] ⟨ts⟩→[t͡s̺] ⟨tx⟩→[t͡ʃ]
 * (zu 'you' vs su 'fire' is a minimal pair). ⟨r⟩ is a TAP [ɾ] between vowels and a TRILL [r] elsewhere.
 * Numbers are VIGESIMAL — base 20, with ⟨-ta⟩ suffixed for a remainder and ⟨eta⟩ free before the final
 * sub-100 group.
 *
 * The portable half of test/basque.test.ts, including the six the TS review found — five of which produce
 * a WRONG READING rather than a silence, so no leak class, DROP or referee could see any of them. Every
 * expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Basque;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class BasqueTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "eu").Trim();
    private static string Engine(string s) => Registry.GetPhonemizer("eu").Text(s).Trim();
    private static string Norm(string s) => Normalize.NormalizeBasque(s);

    [Theory]
    // THE HALLMARK — the three-way sibilant contrast (laminal / apical / postalveolar).
    [InlineData("zu", "s̻u")]            // 'you' — ⟨z⟩→[s̻] laminal
    [InlineData("su", "s̺u")]            // 'fire' — ⟨s⟩→[s̺] apical (a MINIMAL PAIR with zu)
    [InlineData("xede", "ʃede")]         // ⟨x⟩→[ʃ] postalveolar
    [InlineData("gizon", "ɡis̻on")]      // 'man' — ⟨z⟩→[s̻]
    // the three-way AFFRICATE contrast (⟨tz ts tx⟩)
    [InlineData("atzo", "at͡s̻o")]        // 'yesterday' — ⟨tz⟩→[t͡s̻] laminal
    [InlineData("hots", "hot͡s̺")]        // 'sound' — ⟨ts⟩→[t͡s̺] apical
    [InlineData("etxe", "et͡ʃe")]         // 'house' — ⟨tx⟩→[t͡ʃ] postalveolar
    [InlineData("hotz", "hot͡s̻")]        // 'cold' — ⟨tz⟩ (vs hots's ⟨ts⟩)
    // ⟨r⟩ — tap between vowels, trill finally / before a consonant / doubled
    [InlineData("udare", "udaɾe")]       // intervocalic single ⟨r⟩ → [ɾ] tap
    [InlineData("hartu", "hartu")]       // ⟨r⟩ before a consonant → [r] trill
    [InlineData("herri", "heri")]        // ⟨rr⟩ → [r] trill
    [InlineData("lur", "lur")]           // word-final ⟨r⟩ → [r] trill
    // palatal digraphs + ⟨j⟩ + ⟨g⟩
    [InlineData("onddo", "onɟo")]        // ⟨dd⟩→[ɟ] palatal stop
    [InlineData("jan", "xan")]           // ⟨j⟩→[x]
    [InlineData("euskara", "eus̺kaɾa")]  // the endonym — ⟨s⟩→[s̺], intervocalic ⟨r⟩→[ɾ]
    public void ReadsTheGreedyScan(string input, string expected) =>
        Assert.Equal(expected, BasquePhonemizer.PhonemizeWord(input));

    [Fact]
    public void GIsAlwaysTheStopNoSoftG() => Assert.Contains("ɡ", BasquePhonemizer.PhonemizeWord("gizon"));

    [Theory]
    // The VIGESIMAL (base-20) number system.
    [InlineData("20", "hoɡei")]                                  // one score
    [InlineData("30", "hoɡeita hamar")]                          // 20 + the connective -ta + 10
    [InlineData("40", "beroɡei")]                                // 2×20 — ⟨rr⟩→[r] trill
    [InlineData("60", "hiɾuɾoɡei")]                              // 3×20 — single ⟨r⟩→[ɾ] tap (contrast with 40)
    [InlineData("80", "lauɾoɡei")]                               // 4×20
    [InlineData("99", "lauɾoɡeita hemeɾet͡s̻i")]                   // 4×20 + 19
    [InlineData("101", "ehun eta bat")]                          // hundreds take the FREE connective ⟨eta⟩
    [InlineData("234", "berehun eta hoɡeita hamalau")]           // 200 eta (20+14)
    [InlineData("2025", "bi mila eta hoɡeita bos̺t")]            // 2 thousand eta (20+5)
    // the milioi / mila milioi scales — the LONG scale, so 10⁹ is NOT bilioi
    [InlineData("7", "s̻as̻pi")]
    [InlineData("12345", "hamabi mila hiɾuɾehun eta beroɡeita bos̺t")]
    [InlineData("100000", "ehun mila")]
    [InlineData("1000000", "milioi bat")]                        // "bat" FOLLOWS milioi
    [InlineData("2000000", "bi milioi")]
    [InlineData("1000000000", "mila milioi")]                    // was a DIGIT-LEAK
    [InlineData("2000000000", "bi mila milioi")]
    public void ComposesTheVigesimalCardinals(string input, string expected) =>
        Assert.Equal(expected, Engine(input));

    [Theory]
    // The grouping PERIOD is not a sentence break.
    [InlineData("42.262.142", "42262142")]
    [InlineData("1.000", "1000")]
    [InlineData("Am 2.18.19-26", "Am 2.18.19-26")]               // a dotted CITATION is not a grouped figure
    [InlineData("41.000 urteko", "41000 urteko")]
    // The decimal COMMA is `koma`, from espeak's own `_dpt`.
    [InlineData("93,55.", "93 koma 55.")]                        // still a decimal at a sentence end
    // Units, the squared modifier, the rate denominator.
    [InlineData("42.262.142 km²", "42262142 kilometro karratu")]
    [InlineData("5 km³", "5 kilometro kubiko")]
    [InlineData("26 °F", "26 gradu Fahrenheit")]
    // The ending also glues to the UNIT, and only where the writer marked the boundary.
    [InlineData("44.579.000 km²ko eremua", "44579000 kilometro karratuko eremua")]
    [InlineData("40 091 km-koa", "40091 kilometrokoa")]          // space-grouped too
    [InlineData("kg-ko", "kilogramoko")]
    [InlineData("man", "man")]                                    // ⚠ the hyphen guard: `m`+`an` is a WORD
    [InlineData("gizonak eta emakumeak", "gizonak eta emakumeak")]
    // A magnitude word between the figure and its unit keeps them adjacent.
    [InlineData("44 milioi km²", "44 milioi kilometro karratu")]
    [InlineData("399 milioi km-koa", "399 milioi kilometrokoa")]
    // Population density is refused whole — its numerator is a NOUN, which no unit table can name.
    [InlineData("(141 bizt./km²)", "(141 bizt./km²)")]
    // `2x` is not a case ending, which is why CASE_ENDINGS is a closed list.
    [InlineData("2x3", "2x3")]
    public void TheNormalizerSteps(string input, string expected) => Assert.Equal(expected, Norm(input));

    [Theory]
    [InlineData("93,55", "lauɾoɡeita hamahiɾu koma beroɡeita hamabos̺t")]
    // Percent is PREFIXED, which the wiki states outright.
    [InlineData("% 32,1", "ehuneko hoɡeita hamabi koma bat")]
    [InlineData("%7a", "ehuneko s̻as̻pia")]                       // sign, figure and article together
    [InlineData("5 km", "bos̺t kilometro")]
    [InlineData("120 km/h", "ehun eta hoɡei kilometro orduko")]
    [InlineData("56,7 ° C", "beroɡeita hamas̺ei koma s̻as̻pi ɡradu kels̺ius̺")]
    // The glued case ending attaches to the LAST spoken word, and is not derived.
    [InlineData("1980an", "mila bedeɾat͡s̻iehun eta lauɾoɡeian")]
    [InlineData("1980ko", "mila bedeɾat͡s̻iehun eta lauɾoɡeiko")]
    [InlineData("25ean", "hoɡeita bos̺tean")]
    public void TheWholePipeline(string input, string expected) => Assert.Equal(expected, Say(input));

    /**
     * ⚠ A LEADING ZERO IN THE FRACTION IS PART OF THE QUANTITY. `5,09` and `5,9` came out BYTE-IDENTICAL:
     * the fraction is read as a NUMBER and `Number("09")` is 9, so the quantity was wrong by a factor of
     * ten in well-formed Basque, invisible to every gate. ×10 in the corpus.
     */
    [Fact]
    public void ALeadingZeroInTheFractionIsPartOfTheQuantity()
    {
        Assert.NotEqual(Say("5,9"), Say("5,09"));
        Assert.Equal("5 koma zero 9", Norm("5,09"));
        Assert.Equal("5 koma 9", Norm("5,9"));
        Assert.Equal("0 koma zero 8", Norm("0,08"));
        // and the same in step 5's own arm, where the ending has to glue to the last word
        Assert.Equal("bost koma zero bederatzieko", Norm("5,09eko"));
    }

    /** ⚠ U+00BA `º` IS FOLDED TO U+00B0 `°` — the corpus writes it ×12 against ×16, and it caused two
     *  defects: the scale went unread (⟨C⟩ → /k/, trap 56) and `º` being `\p{L}` also blocked the decimal
     *  guard beside it, so `0,1-0,5º` normalised asymmetrically. */
    [Theory]
    [InlineData("0,4º C", "0 koma 4 gradu Celsius")]
    [InlineData("0,1-0,5º", "0 koma 1-0 koma 5°")]               // BOTH decimals, not just the first
    public void TheMasculineOrdinalIndicatorIsFoldedOntoTheDegreeSign(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Fact]
    public void FoldingChangesTheCharacterNotTheReadingABareDegreeIsStillRefused() =>
        Assert.Contains("°", Norm("30º-ko latitudearen"));

    /** ⚠ A RATE DENOMINATOR TAKES THE ENDING TOO, AND MUST NOT DOUBLE IT. The tier's trailing guard sees
     *  the HYPHEN rather than a letter, so it matched, emitted `orduko`, and the writer's own `-ko`
     *  survived beside it — a stutter rather than an obvious leak. */
    [Theory]
    [InlineData("5 km/h-ko", "5 kilometro orduko")]
    [InlineData("120 km/h-koa", "120 kilometro ordukoa")]
    [InlineData("300 km/s-ko", "300 kilometro segundoko")]
    [InlineData("120 km/h", "120 kilometro orduko")]             // unchanged without an ending
    public void ARateDenominatorTakesTheEndingWithoutDoublingIt(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** ⚠ A HYPHENATED ENDING IS CLAIMED ONLY AFTER A VOWEL — the one place the file's central claim fails.
     *  The hyphen exists so the ending can be written BARE and the linking vowel supplied in speech, so the
     *  writer has NOT chosen the allomorph there: `995-ko` would be *hamabostko*, which is not a word. */
    [Theory]
    [InlineData("26-en", "hogeita seien")]
    [InlineData("995-ko", "995-ko")]
    [InlineData("km-koa", "kilometrokoa")]                       // the UNIT side is safe: every noun is vowel-final
    // the fraction is magnitude-bounded like the head, not left unguarded
    [InlineData("3,14159265358979a", "3,14159265358979a")]
    public void AHyphenatedEndingIsClaimedOnlyAfterAVowel(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /**
     * ⚠ A DROPPED NEGATIVE SIGN CHANGES THE VALUE — the corpus's record low temperatures were reading as
     * POSITIVE, wrong by 178 degrees and invisible to every gate. ⚠ SUBTRACTION STAYS REFUSED: the same
     * wiki article that sources `minus` gives the OPERATOR a different word (*hamar ken zazpi*).
     */
    [Fact]
    public void ANegativeAttachedToAnAmountIsReadAndARangeOrParentheticalIsNot()
    {
        Assert.Contains("minus̺", Engine("-66 °C"));
        Assert.Contains("minus̺", Engine("magnitudea -2,8 da"));
        Assert.DoesNotContain("minus̺", Engine("2.000 – 1.000"));          // subtraction
        Assert.DoesNotContain("minus̺", Engine("21. - 29. liburuak"));     // a SPACED ordinal range
        Assert.DoesNotContain("minus̺", Engine("ugaria –700 inguru– mota")); // an en-dash parenthetical
        Assert.DoesNotContain("minus̺", Engine("995-ko"));                 // the case-ending hyphen
        // ⚠ THE LABEL-VALUE DASH, which is SPACED. Every genuine negative in this corpus is written tight,
        // and guarding on the left operand's class instead would have refused `-89.2 ° C` as well.
        Assert.DoesNotContain("minus̺", Engine("Bilbo - 400.000 biztanle"));
    }

    [Fact]
    public void NoDigitLeakSentinelOrGapAcrossTwentyThousand()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var words = BasquePhonemizer.CardinalWords(n);
            Assert.Matches("^[^0-9]*$", words);
            Assert.NotEqual("", words);
        }
    }
}
