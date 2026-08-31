/**
 * Classical Nahuatl (nāhuatlahtōlli) — Uto-Aztecan, the traditional Spanish-based orthography,
 * AUTHORED from Andrews §2. Vowel length is unwritten in traditional texts → short vowels (the referee's
 * ː is backbone-folded). Two corroborating human referees (wikipron 886 / kaikki 2329).
 *
 * The portable half of test/nahuatl.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Nahuatl;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class NahuatlTests
{
    private static string Word(string s) => NahuatlPhonemizer.PhonemizeWord(s);
    private static string Norm(string s) => Normalize.NormalizeNahuatl(s);
    private static string Text(string s) => Phonemizer.Phonemize(s, "nci");

    [Theory]
    [InlineData("nahuatl", "nawat͡ɬ")]       // ⟨hu⟩→[w], ⟨tl⟩→[t͡ɬ]
    [InlineData("Ahuitzotl", "awit͡sot͡ɬ")]   // ⟨tz⟩→[t͡s]
    [InlineData("xochitl", "ʃot͡ʃit͡ɬ")]      // 'flower' — ⟨x⟩→[ʃ], ⟨ch⟩→[t͡ʃ]
    [InlineData("tlahtolli", "t͡ɬaʔtolli")]  // 'word' — the SALTILLO ⟨h⟩→[ʔ] (after a vowel)
    public void TheAffricatesDigraphsAndSaltillo(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("cihuatl", "siwat͡ɬ")]      // 'woman' — ⟨c⟩ before i → [s]; ⟨hu⟩→[w]
    [InlineData("quimichin", "kimit͡ʃin")]   // ⟨qu⟩ before i → [k]
    [InlineData("cuauhtli", "kʷawt͡ɬi")]    // 'eagle' — ⟨cu⟩+V→[kʷ], ⟨uh⟩ coda→[w]
    [InlineData("teuctli", "tekʷt͡ɬi")]     // 'lord' — ⟨uc⟩ coda → [kʷ]
    public void TheCQuCuUcContextRules(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("cachuah", "kakwaʔ")]      // ⟨chu⟩ = [k]-coda + ⟨hu⟩[w] (=/kakwa/), NOT [t͡ʃ]
    [InlineData("yehhuatl", "jeʔwat͡ɬ")]    // ⟨h⟩→[ʔ] then ⟨hu⟩→[w]; ⟨y⟩→[j]
    [InlineData("he", "e")]                // word-initial ⟨h⟩ is silent (saltillo only occurs AFTER a vowel)
    public void TheChuTrapAndTheInitialSaltillo(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Fact]
    public void RegistryWiring() => Assert.Equal("nawat͡ɬ", Text("nahuatl").Trim());

    /**
     * NUMBERS — VIGESIMAL (base 20) and positional, with a magnitude noun per power of twenty:
     * pōhualli 20 · tzontli 400 · xiquipilli 8000 · pōhualxiquipilli 160 000 · tzonxiquipilli 3 200 000 ·
     * pōhualtzonxiquipilli 64 000 000. TWO joiners: the linker ⟨on-⟩ (⟨om-⟩ before a vowel or ⟨m⟩) inside
     * the sub-400 part, and the relational ⟨īpan⟩ between groups from 400 up.
     */
    [Theory]
    [InlineData(1, "cē")]
    [InlineData(7, "chicōme")]
    [InlineData(10, "mahtlāctli")]
    [InlineData(11, "mahtlāctli oncē")]                  // no *11 word: 10 + 1 with the ⟨on-⟩ linker
    [InlineData(12, "mahtlāctli omōme")]                 // ⟨on-⟩ → ⟨om-⟩ before a vowel
    [InlineData(15, "caxtōlli")]
    [InlineData(19, "caxtōlli onnāhui")]
    [InlineData(20, "cempōhualli")]                      // 'one count'
    [InlineData(21, "cempōhualli oncē")]
    [InlineData(30, "cempōhualli ommahtlāctli")]         // ⟨om-⟩ before ⟨m⟩
    [InlineData(35, "cempōhualli oncaxtōlli")]
    [InlineData(42, "ōmpōhualli omōme")]
    [InlineData(99, "nāppōhualli oncaxtōlli onnāhui")]   // 80 + 15 + 4
    [InlineData(100, "mācuīlpōhualli")]                  // five counts
    [InlineData(101, "mācuīlpōhualli oncē")]
    [InlineData(200, "mahtlācpōhualli")]
    [InlineData(220, "mahtlāctli oncempōhualli")]        // an 11 MULTIPLIER: 10 scores + 1 score
    [InlineData(380, "caxtōlli onnāppōhualli")]          // a 19 multiplier: 15 + 4 scores
    [InlineData(400, "centzontli")]
    [InlineData(401, "centzontli īpan cē")]              // ⟨īpan⟩ takes over from ⟨on-⟩ at 400
    [InlineData(555, "centzontli īpan chicōmpōhualli oncaxtōlli")]
    [InlineData(999, "ōntzontli īpan chiucnāppōhualli oncaxtōlli onnāhui")] // 800 + 180 + 15 + 4
    [InlineData(1000, "ōntzontli īpan mahtlācpōhualli")] // 800 + 200 — attested verbatim
    [InlineData(8000, "cenxiquipilli")]
    [InlineData(9000, "cenxiquipilli īpan ōntzontli īpan mahtlācpōhualli")] // attested verbatim
    [InlineData(15000, "cenxiquipilli īpan caxtōlli omōntzontli īpan mahtlācpōhualli")] // attested verbatim
    [InlineData(160000, "cempōhualxiquipilli")]
    [InlineData(1000000, "chicuacempōhualxiquipilli īpan mācuīlxiquipilli")] // attested verbatim
    [InlineData(3200000, "centzonxiquipilli")]
    [InlineData(64000000, "cempōhualtzonxiquipilli")]
    public void TheVigesimalSeries(int n, string expected) =>
        Assert.Equal(expected, Numbers.NumberToWords(n));

    [Fact]
    public void TheDensestAttestedCompositeVerbatim() =>
        Assert.Equal(
            "caxtōlli onnāuhxiquipilli īpan caxtōlli onnāuhtzontli īpan caxtōlli onnāppōhualli oncaxtōlli onnāhui",
            Numbers.NumberToWords(159999));

    [Fact]
    public void NoGapsOrSentinelsAcrossZeroThroughTwentyThousand()
    {
        var re = new System.Text.RegularExpressions.Regex("undefined|NaN|[0-9]");
        for (var n = 0; n <= 20000; n++)
            Assert.DoesNotMatch(re, Numbers.NumberToWords(n));
    }

    /** 20⁷ = 1 280 000 000 has no further magnitude noun → digit-by-digit. Classical Nahuatl has no attested
     *  numeral for zero; ⟨ahtle⟩ 'nothing' is a disclosed stopgap. */
    [Theory]
    [InlineData(0, "ahtle")]
    [InlineData(1280000000, "cē ōme chicuēyi ahtle ahtle ahtle ahtle ahtle ahtle ahtle")] // 1 280 000 000
    public void AboveTwentyToTheSevenTheDigitsAreRead(int n, string expected) =>
        Assert.Equal(expected, Numbers.NumberToWords(n));

    /** End-to-end: the numeral is phonemized, not passed through as digits. */
    [Theory]
    [InlineData("21", "sempoːwalli onseː")]  // cempōhualli oncē — ⟨ce⟩ = [se]
    [InlineData("400", "sent͡sont͡ɬi")]       // centzontli
    public void NumbersEndToEndThroughTheScan(string input, string expected) =>
        Assert.Equal(expected, Text(input));

    /** THE SPACE IS A GROUPING MARK, and this is the highest-value rule in the layer: the paleoanthropology
     *  articles write `1 000 000`, `720 000`, `480 000`, `128 000`, `149 600 000`, and un-grouped they read
     *  as two numerals with the zero stopgap *ahtle* between them. */
    [Theory]
    [InlineData("(720 000) xihuitl", "(720000) xihuitl")]
    [InlineData("(1 000 000) xihuitl", "(1000000) xihuitl")]
    [InlineData("in ic 149 600 000 kilómetros cah", "in ic 149600000 kilómetros cah")]
    [InlineData("5 000 000 xihuitl", "5000000 xihuitl")]   // the whole number is matched at once, not one join per pass
    [InlineData("H 2 O: gelo", "H 2 O: gelo")]             // a run of fewer than three digits is not a group
    public void TheSpaceGroupedFigureIsOneNumberByTheThreeDigitTest(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** THE COMMA GROUPS IN NAHUATL PROSE while a chapter,verse citation has one or two digits after the
     *  comma and is declined by the same test. */
    [Theory]
    [InlineData("Mētztli īyōllo 384,400 km ca.", "Mētztli īyōllo 384400 kilómetros ca.")]
    [InlineData("(21,860,000,000 km³)", "(21860000000 km³)")]
    [InlineData("Mt 20,29-34; Mc 10,46-52", "Mt 20,29-34; Mc 10,46-52")]
    public void TheCommaGroupsAndAScriptureCitationIsNotAGroup(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** THE DECIMAL DOT IS NEUTRALISED, not spoken. The defect being fixed is the false SENTENCE BREAK it
     *  produces mid-quantity. */
    [Fact]
    public void TheDecimalDotStopsBeingASentenceBreak()
    {
        Assert.Equal("ōctacāyōtl 8 2 Mw", Norm("ōctacāyōtl 8.2 Mw"));
        Assert.DoesNotContain(" . ", Text("in cotoctic 0.04% momeliuhca"));
    }

    /** THE COLON IS A SCRIPTURE REFERENCE 14× AND A CLOCK 6×, AND ARITY SEPARATES THEM: `h:m:s` is claimed
     *  outright, the two-part form ONLY before `hrs`, which is what separates the clocks from fourteen
     *  Gospel citations written with the identical ASCII colon. */
    [Theory]
    [InlineData("īpan 12:02:50 nicān cāhuitl", "īpan 12 02 50 nicān cāhuitl")]
    [InlineData("īpan 12:14 hrs Tecolotlan", "īpan 12 14 horas Tecolotlan")]
    [InlineData("Tlachicuēiti 21, 4:00 hrs.", "Tlachicuēiti 21, 4 00 horas.")] // the trailing dot is not consumed
    [InlineData("Mateo 1:16, Marcos 8:29, Lucas 9:20", "Mateo 1:16, Marcos 8:29, Lucas 9:20")]
    public void TheClockIsClaimedByArityOrByHrs(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Fact]
    public void AReignSpanKeepsItsColon() => Assert.Contains("18:41", Norm("imAmox in Tlahtohqueh 18:41-45."));

    /** THE DEGREE CONFUSABLE IS A SPANISH ORDINAL HERE — `º` U+00BA in `2º Potencial de ionización` — which
     *  is the opposite direction from Hawaiian, whose confusable WAS a degree. */
    [Theory]
    [InlineData("itotonca cequi 17 °C.", "itotonca cequi 17 grados.")]
    [InlineData("moātili 0 °C īhuān", "moātili 0 grados īhuān")]
    [InlineData("2º Potencial de ionización", "2º Potencial de ionización")]
    [InlineData("3º potencial de ionización", "3º potencial de ionización")]
    public void TheDegreeSignIsReadAndTheMasculineOrdinalIndicatorIsNot(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** THE UNIT RULES REQUIRE THE SPACE, which is why this layer declares no shared symbol tier: the tier's
     *  `\s?` cannot decline `9.8m sales` (English "million" in a discography) or `180m Ta` (an isomer
     *  label), and every genuine metre in the corpus has the space. */
    [Theory]
    [InlineData("Momātia īxquichca 10 m īhuān", "Momātia īxquichca 10 metros īhuān")]
    [InlineData("Yucatán 35 km tlāpcopa", "Yucatán 35 kilómetros tlāpcopa")]
    [InlineData("(1995) 9.8m sales", "(1995) 9 8m sales")]
    [InlineData("180m Ta {Sin}", "180m Ta {Sin}")]
    [InlineData("(37,932,330 km²)", "(37932330 km²)")]   // `km²` KEEPS ITS POWER VISIBLE
    [InlineData("Velocidad del sonido 4970 m/s", "Velocidad del sonido 4970 m/s")] // a rate is declined
    public void AUnitNeedsItsSpaceAndAGluedMIsNotAMetre(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** THE `&nbsp;` ENTITY IS LITERAL IN THIS DUMP — it reaches the g2p as the word *nbsp* and hides the
     *  unit behind it. Replaced by a SPACE, not deleted, or the figure fuses to its unit. */
    [Theory]
    [InlineData("huehcatlanyōtīca 45.9&nbsp;km.", "huehcatlanyōtīca 45 9 kilómetros.")]
    [InlineData("tlatēctli 133&nbsp;km in", "tlatēctli 133 kilómetros in")]
    public void TheLiteralNbspBecomesTheSpaceItIsAndUnblocksTheUnit(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Fact]
    public void TheNbspDoesNotReachTheIpa() => Assert.DoesNotContain("nbsp", Text("huehcatlanyōtīca 57&nbsp;km."));

    /** THE PLUS IS A MORPHEME BOUNDARY IN 22 OF ITS 24 INSTANCES — the numeral stubs decompose the vigesimal
     *  word and then state the digits. Reading it produces *cēm plus pōhual plus on plus ēyi*. */
    [Fact]
    public void TheNumeralStubsPlusIsLeftSilent()
    {
        const string glossed = "Cēmpōhualomēyi (cēm + pōhual + on + ēyi) ītōcā cē tlapōhualli";
        Assert.Equal(glossed, Norm(glossed));
        Assert.DoesNotMatch("plus|m[aá]s", Text(glossed));
    }

    /** THE CURRENCY AND THE FRACTION ARE SELF-GLOSSED — the writer has already said `pesos`/`tomin` and
     *  `īnnāhui cē`, so expanding either sign says the noun twice. */
    [Theory]
    [InlineData("ipatiuh cetzin $40 pesos tlen tomin", "ipatiuh cetzin $40 pesos tlen tomin")]
    [InlineData("īnnāhui cē (1/4) ītechpa", "īnnāhui cē (1/4) ītechpa")]
    public void TheSelfGlossedCurrencyAndFractionAreLeftAlone(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** RANGES. The life-and-reign spans are read; the ISO date, the ISBN and the UTC offset are declined by
     *  the fleet-standard chain and head guards. */
    [Theory]
    [InlineData("Itzcōātl (1427-1440).", "Itzcōātl (1427, 1440).")]
    [InlineData("(1934–1964); México", "(1934, 1964); México")]
    [InlineData("Love Me Do (1962-10-05)", "Love Me Do (1962-10-05)")]
    [InlineData("ISBN 970-07-6492-3", "ISBN 970-07-6492-3")]
    [InlineData("nicān cāhuitl (UTC-5)", "nicān cāhuitl (UTC-5)")]
    public void AReignSpanIsARangeAndAnIsoDateAnIsbnAndAUtcOffsetAreNot(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** U+200B, ×15, doubled after `uan ` throughout the machine-translated modern-Nahuatl articles.
     *  Invisible, so it can only ever be noise. ZWJ/ZWNJ are deliberately NOT touched. */
    [Theory]
    [InlineData("uan \u200B\u200Beli nopa", "uan eli nopa")]
    [InlineData("Cicero;\u200B Arpino", "Cicero; Arpino")]
    public void TheZeroWidthSpaceIsStrippedWithoutFusingItsNeighbours(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** WHOLE-PIPELINE. The point of the layer is what the g2p finally says. */
    [Fact]
    public void TheGroupedFigureTheUnitAndTheClockReachTheIpaAsWords()
    {
        // 720000 is a real base-20 composite, not seven-hundred-twenty followed by *ahtle*.
        Assert.DoesNotContain("aʔt͡ɬe", Text("(720 000) xihuitl"));
        // `35 km` — the unit is a word, not a raw Latin token.
        Assert.Contains("kilometɾos", Text("Yucatán 35 km tlāpcopa"));
        // `17 °C` used to end as a bare [k]; it now says the scale word.
        Assert.Contains("ɡɾados", Text("itotonca cequi 17 °C."));
        // …and a Gospel citation keeps its colon-pause rather than becoming a time of day.
        Assert.Contains(",", Text("Marcos 8:29"));
    }
}
