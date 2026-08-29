/**
 * Georgian / ქართული (ka) — Kartvelian, the Mkhedruli script. The orthography is essentially
 * ONE-LETTER-ONE-PHONEME, so the g2p is a greedy scan + ONE context rule (word-final voiced-stop devoicing
 * ბ/დ/გ→pʰ/tʰ/kʰ). Signatures: the three-way stop/affricate contrast VOICED / ASPIRATED / EJECTIVE, the
 * uvulars ღ=ʁ ხ=χ ყ=qʼ, and 5 vowels. Numbers are VIGESIMAL (30 = 20+10, 40 = 2×20, 99 = 4×20+19).
 *
 * The portable half of test/georgian.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Georgian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class GeorgianTests
{
    private static string Word(string s) => GeorgianPhonemizer.PhonemizeWord(s);
    /** The RAW engine — no roman pass. */
    private static string Say(string s) => Registry.GetPhonemizer("ka").Text(s).Trim();
    /** Through the registry, where Core/Roman.cs wraps the engine. */
    private static string Full(string s) => Phonemizer.Phonemize(s, "ka").Trim();
    private static string Norm(string s) => Normalize.NormalizeGeorgian(s);

    [Theory]
    // The three-way contrast, the uvulars and the five vowels.
    [InlineData("ბუ", "bu")]
    [InlineData("ფული", "pʰuli")]
    [InlineData("პური", "pʼuɾi")]
    [InlineData("თბილისი", "tʰbilisi")]
    [InlineData("კაცი", "kʼat͡sʰi")]
    [InlineData("ღვინო", "ʁvinɔ")]
    [InlineData("ხაჭაპური", "χat͡ʃʼapʼuɾi")]
    [InlineData("წყალი", "t͡sʼqʼali")]
    [InlineData("გამარჯობა", "ɡamaɾd͡ʒɔba")]
    [InlineData("ძაღლი", "d͡zaʁli")]
    [InlineData("ბავშვი", "bavʃvi")]
    [InlineData("საქართველო", "sakʰaɾtʰvɛlɔ")]
    [InlineData("დედა", "dɛda")]
    [InlineData("ქართული", "kʰaɾtʰuli")]
    // ⚠ WORD-FINAL VOICED-STOP DEVOICING — the one context rule (categorical in the 20,894-word referee).
    [InlineData("კარგად", "kʼaɾɡatʰ")]
    [InlineData("მადლობად", "madlɔbatʰ")]
    [InlineData("გუდა", "ɡuda")]   // …and NOT medially
    public void ReadsTheGreedyScan(string input, string expected) => Assert.Equal(expected, Word(input));

    /** ⚠ MTAVRULI TITLECASE (U+1C90–1CBF) must lowercase to the Mkhedruli block the table keys on, or those
     *  codepoints miss the scan and are SILENTLY DROPPED. Verified against JS across all 48 codepoints
     *  before the port was written. */
    [Fact]
    public void MtavruliTitlecaseFoldsToMkhedruli()
    {
        Assert.Equal(Word("დავე"), Word("ᲓᲐᲕᲔ"));
        Assert.Equal("sakʰaɾtʰvɛlɔ", Word("ᲡᲐᲥᲐᲠᲗᲕᲔᲚᲝ"));
    }

    [Theory]
    // The VIGESIMAL system: scores of twenty, with the remainder inside the same word.
    [InlineData("20", "ɔt͡sʰi")]
    [InlineData("21", "ɔt͡sʰdaɛɾtʰi")]
    [InlineData("30", "ɔt͡sʰdaatʰi")]           // 20+10 — there is no "ten" digit at all
    [InlineData("45", "ɔɾmɔt͡sʰdaχutʰi")]       // 2×20+5
    [InlineData("50", "ɔɾmɔt͡sʰdaatʰi")]        // 2×20+10
    [InlineData("67", "samɔt͡sʰdaʃvidi")]       // 3×20+7
    [InlineData("89", "ɔtʰχmɔt͡sʰdat͡sʰχɾa")]    // 4×20+9
    [InlineData("99", "ɔtʰχmɔt͡sʰdat͡sʰχɾamɛtʼi")] // 4×20+19
    [InlineData("7", "ʃvidi")]
    [InlineData("8", "ɾva")]
    // ⚠ TRUNCATION from 100 up: a numeral FOLLOWED by a smaller number drops its final ⟨ი⟩.
    [InlineData("100", "asi")]
    [InlineData("101", "as ɛɾtʰi")]
    [InlineData("555", "χutʰas ɔɾmɔt͡sʰdatʰχutʰmɛtʼi")]
    [InlineData("999", "t͡sʰχɾaas ɔtʰχmɔt͡sʰdat͡sʰχɾamɛtʼi")]
    [InlineData("1000", "atʰasi")]              // bare ათასი, no *ერთი ათასი
    [InlineData("1001", "atʰas ɛɾtʰi")]
    [InlineData("12345", "tʰɔɾmɛtʼi atʰas samas ɔɾmɔt͡sʰdaχutʰi")]
    [InlineData("1000000", "ɛɾtʰi miliɔni")]    // …but 10⁶/10⁹ KEEP the numeral
    [InlineData("1000000000", "ɛɾtʰi miliaɾdi")]
    public void ComposesTheVigesimalCardinals(string input, string expected) => Assert.Equal(expected, Say(input));

    [Theory]
    [InlineData(1, "პირველი")]       // ⚠ SUPPLETIVE in isolation
    [InlineData(8, "მერვე")]
    [InlineData(9, "მეცხრე")]
    [InlineData(20, "მეოცე")]
    [InlineData(40, "მეორმოცე")]
    [InlineData(100, "მეასე")]
    [InlineData(1000, "მეათასე")]
    [InlineData(2016, "ორი ათას მეთექვსმეტე")]
    public void ComposesTheOrdinalCircumfix(int n, string expected) => Assert.Equal(expected, Normalize.OrdinalWord(n));

    [Theory]
    // Thousands de-group before anything reads a number or a pause (`5 000` was *χutʰi nuli*, "five zero").
    [InlineData("5 000", "χutʰi atʰasi")]
    [InlineData("1 900 000", "ɛɾtʰi miliɔn t͡sʰχɾaasi atʰasi")]
    [InlineData("1,300", "atʰas samasi")]
    // Percent and per mille, postposed, with the ending on the WORD.
    [InlineData("5 %", "χutʰi pʼɾɔt͡sʰɛntʼi")]
    [InlineData("82%-ით", "ɔtʰχmɔt͡sʰdaɔɾi pʼɾɔt͡sʰɛntʼitʰ")]   // was *…ɔɾi itʰ*, the ending alone
    [InlineData("98 %-მა", "ɔtʰχmɔt͡sʰdatʰvɾamɛtʼi pʼɾɔt͡sʰɛntʼma")]
    [InlineData("210 ‰", "ɔɾas atʰi pʼɾɔmilɛ")]
    // Degrees: the scale name FOLLOWS the degree noun.
    [InlineData("12 °C", "tʰɔɾmɛtʼi ɡɾadusi t͡sʰɛlsiusi")]
    [InlineData("2 °C-მდე", "ɔɾi ɡɾadusi t͡sʰɛlsiusamdɛ")]
    [InlineData("100 °F", "asi ɡɾadusi pʰaɾɛnhaitʼi")]          // ×0 in the corpus — the neighbour, trap 8
    // Units, the PREPOSED measure word, and the rate.
    [InlineData("500 მმ", "χutʰasi milimɛtʼɾi")]
    [InlineData("500 მმ-ია", "χutʰasi milimɛtʼɾia")]
    [InlineData("500 კმ²", "χutʰasi kʼvadɾatʼuli kʼilɔmɛtʼɾi")]
    [InlineData("5 სმ³", "χutʰi kʼubuɾi santʼimɛtʼɾi")]
    [InlineData("1 კმ²-ზე", "ɛɾtʰi kʼvadɾatʼul kʼilɔmɛtʼɾzɛ")]  // the attributive truncates too
    [InlineData("120 კმ/სთ", "as ɔt͡sʰi kʼilɔmɛtʼɾi saatʰʃi")]
    [InlineData("1000 კვტ/სთ", "atʰasi kʼilɔvatʼ saatʰi")]      // a kilowatt-HOUR is not a rate (trap 44)
    [InlineData("15 ათ.", "tʰχutʰmɛtʼi atʰasi")]                // the abbreviation's own dot is consumed
    [InlineData("5 km", "χutʰi kʼilɔmɛtʼɾi")]                   // the Latin spelling, robustness
    [InlineData("5 km²", "χutʰi kʼvadɾatʼuli kʼilɔmɛtʼɾi")]
    // Currency is postposed after the magnitude.
    [InlineData("$25 მილიონი", "ɔt͡sʰdaχutʰi miliɔni dɔlaɾi")]
    [InlineData("860 $", "ɾvaas samɔt͡sʰi dɔlaɾi")]              // the postposed sign
    // Era markers and dotted abbreviations.
    [InlineData("ძვ. წ. 480", "d͡zvɛli t͡sʼɛltʰaʁɾit͡sʰχvitʰ ɔtʰχas ɔtʰχmɔt͡sʰi")]
    [InlineData("ე. წ. სახელი", "ɛɡɾɛtʰ t͡sʼɔdɛbuli saχɛli")]
    [InlineData("სხვ.", "sχva .")]                              // clause-final: the dot becomes the pause
    // The clock needs a CONTEXT, and the hour noun is said once.
    [InlineData("15:00 საათზე", "tʰχutʰmɛtʼi saatʰzɛ")]
    [InlineData("03:14:08-ზე", "sami saatʰi , tʰɔtʰχmɛtʼi t͡sʼutʰi da ɾva t͡sʼamzɛ")]
    // Fractions.
    [InlineData("1/3", "ɛɾtʰi mɛsamɛdi")]                       // was *ɛɾtʰi sami*
    // The ordinal circumfix, both halves.
    [InlineData("20-ე საუკუნე", "mɛɔt͡sʰɛ saukʼunɛ")]
    public void TheWholePipeline(string input, string expected) => Assert.Equal(expected, Say(input));

    [Theory]
    // ⚠ THE NEGATIVE RESULT: a numeral used ATTRIBUTIVELY before a noun does not decline — the noun carries
    // the case — so the corpus's most common numeric shape needs NO rule and must be left alone.
    [InlineData("1995 წლებში", "1995 წლებში")]
    [InlineData("0,3 %", "ნული სამი პროცენტი")]                  // a leading `0,` is a DECIMAL, not a group
    [InlineData("8:04", "8:04")]                                 // a track length, not a time — no context
    [InlineData("$5 მილიარდი დოლარის დახმარება", "ხუთი მილიარდი დოლარის დახმარება")] // not said twice
    [InlineData("დაახლ.ძვ.წ. 480", "დაახლოებით ძველი წელთაღრიცხვით 480")]
    [InlineData("21/22 მარტი", "21/22 მარტი")]                   // a date, not a fraction
    [InlineData("180/190", "180/190")]                           // numerator ≥ denominator
    [InlineData("1900/400", "1900/400")]                         // out of the fraction's range
    [InlineData("4.52", "4 52")]                                 // no decimal WORD is sourced — a space
    [InlineData("1,5", "1 5")]
    [InlineData("ISBN 3-900052-04-2", "ISBN 3-900052-04-2")]     // the minus must not claim an ISBN
    public void TheNormalizerAndItsRefusals(string input, string expected) => Assert.Equal(expected, Norm(input));

    [Fact]
    public void TheMinusRuleClaimsASignAndDeclinesARange()
    {
        Assert.Contains("მინუს", Norm("(-28 მ)"));
        Assert.Contains("მინუს", Norm("−500"));                  // U+2212 is unambiguous
        Assert.DoesNotContain("მინუს", Norm("(23-28 °C)"));      // a RANGE, digit-preceded
        Assert.DoesNotContain("მინუს", Norm("მაქსიმუმი – 760 მმ")); // a value-introducing dash
        Assert.DoesNotContain("მინუს", Norm("(1627 –1628)"));    // a year range, spaced on the left
        Assert.DoesNotContain("მინუს", Norm("(1885-–1889)"));    // …and the doubled-dash typo
        Assert.Contains("უდრის", Norm("1900/400 = 4"));
        Assert.DoesNotContain("უდრის", Norm("Lingua Latina = ლათინური ენა")); // a title equivalence
    }

    /** ⚠ A CENTURY IS AN ORDINAL, not a cardinal — 63 artifact instances, and the Roman half arrives through
     *  the shared roman pass in the registry, so these go through Phonemize rather than the raw engine. */
    [Theory]
    [InlineData("XVIII საუკუნეში", "mɛtʰvɾamɛtʼɛ saukʼunɛʃi")]   // was *tʰvɾamɛtʼi …*
    [InlineData("V საუკუნეში", "mɛχutʰɛ saukʼunɛʃi")]
    [InlineData("X საუკუნის", "mɛatʰɛ saukʼunis")]
    [InlineData("C საუკუნე", "sˈiː saukʼunɛ")]                   // ⟨C⟩ is the Celsius letter ×75
    [InlineData("V ნაწილი", "vˈiː nat͡sʼili")]                    // no century noun — untouched
    public void ACenturyIsAnOrdinal(string input, string expected) => Assert.Equal(expected, Full(input));
}
