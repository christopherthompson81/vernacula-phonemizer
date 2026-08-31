/**
 * The portable half of test/latvian.test.ts — Latvian (lv, latviešu), Baltic, sister of Lithuanian but a
 * SEPARATE engine. Latvian WRITES what Lithuanian leaves implicit: palatalization ⟨ģ ķ ļ ņ⟩ → ɟ c ʎ ɲ and
 * vowel length (macrons → ː), and stress is FIXED on the first syllable. So the g2p is a mostly-direct
 * grapheme→IPA scan plus the native ⟨o⟩→[uɔ̯] diphthong, the falling-diphthong offglides, ⟨v⟩→[w] in the
 * coda, and REGRESSIVE devoicing only.
 *
 * The normalization pre-pass carries the language's largest class: the ORDINAL PERIOD, whose case is read
 * off the noun the writer already inflected rather than guessed.
 *
 * Every expected value here is the TypeScript engine's own output, extracted mechanically from its suite.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Xunit;
using LvEngine = Vernacula.Phonemizer.Languages.Latvian.LatvianPhonemizer;
using LvNumbers = Vernacula.Phonemizer.Languages.Latvian.Numbers;

namespace Vernacula.Phonemizer.Tests;

public class LatvianTests
{
    private static readonly JsRe WS = JsRegex.Compile("\\s+", "gu");
    private static string Word(string s) => LvEngine.PhonemizeWord(s);
    private static string Say(string s) => Js.Trim(WS.Replace(Phonemizer.Phonemize(s, "lv"), " "));
    /** The normalization layer alone — pure text→text, for the rules whose point is what they do NOT read. */
    private static string N(string s) => Vernacula.Phonemizer.Languages.Latvian.Normalize.NormalizeLatvian(s);
    private static string[] Toks(string s) => Split(Say(s));
    private static string[] Split(string s) => s.Split(' ', StringSplitOptions.RemoveEmptyEntries);

    /** The written palatals, the native ⟨o⟩, the diphthongs and offglides, length, and first-syllable stress. */
    [Theory]
    [InlineData("ģimene", "ɟˈimɛnɛ")]
    [InlineData("kaķis", "kˈacis")]
    [InlineData("ļauns", "ʎˈauns")]
    [InlineData("ceļš", "t͡sˈɛʎʃ")]
    [InlineData("loks", "lˈuɔ̯ks")]
    [InlineData("roka", "rˈuɔ̯ka")]
    [InlineData("dievs", "dˈiɛws")]
    [InlineData("Valmiera", "vˈalmiɛra")]
    [InlineData("maize", "mˈaizɛ")]
    [InlineData("neuzmanība", "nˈɛuzmaniːba")]
    [InlineData("Jūrmala", "jˈuːrmala")]
    [InlineData("Latvija", "lˈatvija")]
    [InlineData("akustiķe", "ˈakusticɛ")]
    [InlineData("draugs", "drˈauks")]
    [InlineData("zvaigzne", "zvˈaiɡznɛ")]
    public void ThePhonemizer(string word, string want) => Assert.Equal(want, Word(word));

    /** Cardinals: the -padsmit teens, last-digit-1 agreement, and hundreds inside thousands. */
    [Theory]
    [InlineData("15", "pˈiɛt͡spatsmit")]
    [InlineData("21", "dˈiwdɛsmit vˈiɛns")]
    [InlineData("234", "dˈivi sˈimti trˈiːsdɛsmit t͡ʃˈɛtri")]
    [InlineData("21000", "dˈiwdɛsmit vˈiɛns tˈuːkstuɔ̯tis")]
    [InlineData("100000", "sˈimts tˈuːkstuɔ̯ʃi")]
    [InlineData("1000000", "vˈiɛns mˈiljuɔ̯ns")]
    [InlineData("Labdien, Latvija!", "lˈabdiɛn , lˈatvija !")]
    public void TheCardinalsAndClauseAssembly(string text, string want) => Assert.Equal(want, Say(text));

    /**
     * ⚠ THE ORDINAL PERIOD IS THE LANGUAGE'S LARGEST NORMALIZATION CLASS. Before it, `1885. gada` read as a
     * CARDINAL and the period was taken for a full stop, so a sentence break landed inside the date. The
     * case is not guessed — it is read off the following noun, which is why these rows differ only in the
     * FOLLOWER. (The year's thousand is `tūkstoš`, not the noun `tūkstotis`.)
     */
    [Theory]
    [InlineData("1885. gada", "tˈuːkstuɔ̯ʃ ˈastuɔ̯ɲi sˈimti ˈastuɔ̯ɲdɛsmit pˈiɛktaː ɡˈada")]
    [InlineData("2024. gadā", "dˈivi tˈuːkstuɔ̯ʃi dˈiwdɛsmit t͡sˈɛturtajaː ɡˈadaː")]
    [InlineData("15. jūlijs", "pˈiɛt͡spatsmitais jˈuːlijs")]
    [InlineData("20. gados", "dˈiwdɛsmitajuɔ̯s ɡˈaduɔ̯s")]
    // ⚠ A last-two-digits value of exactly 10 KEEPS ITS NUMERAL. A `>= 11` bound sent 10 to the round-tens
    // arm, which indexes TEN[1] — the empty string — so the numeral vanished and the ending was emitted
    // alone: 10. → *ais*, 2010. → *divi tūkstoši ā*.
    [InlineData("10. gadsimtā", "dˈɛsmitajaː ɡˈatsimtaː")]
    [InlineData("2010. gada", "dˈivi tˈuːkstuɔ̯ʃi dˈɛsmitaː ɡˈada")]
    // ⚠ BOTH figures in a range agree with the ONE noun that follows.
    [InlineData("18.—20. gadsimtā", "ˈastuɔ̯ɲpatsmitajaː lˈiːd͡z dˈiwdɛsmitajaː ɡˈatsimtaː")]
    [InlineData("60.—70. gados", "sˈɛʃdɛsmitajuɔ̯s lˈiːd͡z sˈɛptiɲdɛsmitajuɔ̯s ɡˈaduɔ̯s")]
    public void TheOrdinalPeriodTakesItsCaseFromTheFollowingNoun(string text, string want) =>
        Assert.Equal(want, Say(text));

    /**
     * ⚠ THE HALF-MEASURE, PINNED DELIBERATELY. With no tabulated head noun the case is underivable, so the
     * figure stays a CARDINAL — which is wrong — but the PERIOD IS STILL REMOVED, because a Latvian sentence
     * does not continue in lower case and a spurious clause boundary corrupts everything after it. This pins
     * the trade, not a bug: if the ordinal ever becomes derivable here, this is the assertion that changes.
     */
    [Fact]
    public void AnUntabulatedFollowerLosesTheFalseBreakButKeepsTheCardinal()
    {
        Assert.Equal("pˈiɛt͡si pˈakaːpɛ", Say("5. pakāpe"));
        Assert.DoesNotContain(".", Toks("5. pakāpe"));
        // a round hundred is refused outright — but the period is not a full stop either way
        Assert.DoesNotContain(".", Toks("1900. gadā"));
    }

    /**
     * ⚠ A REFUSAL THE NEXT STEP CAN UNDO IS NOT A REFUSAL. Returning the match untouched let the single-
     * ordinal step claim the SECOND figure alone: `3100.–1550. gadam` → one half ordinalised, the other left
     * holding its period. The refusal now consumes both periods and falls back to the standing half-measure.
     */
    [Fact]
    public void ARefusedRangeRefusesBothHalvesAndStillDropsBothPeriods()
    {
        var roundHundred = Say("3100.–1550. gadam");
        Assert.DoesNotContain(".", Split(roundHundred));
        Assert.Contains("lˈiːd͡z", roundHundred);
        Assert.DoesNotContain("pˈiɛt͡sdɛsmitajam", roundHundred);
        // `gs.` hides its noun's case and is deliberately NOT expanded, so this range is refused too — and
        // its OWN trailing period legitimately survives, because nothing in this layer claims it. What must
        // go are the two periods belonging to the RANGE.
        var century = Toks("10.—12. gs.");
        Assert.Single(century, t => t == ".");
        Assert.Equal(".", century[^1]);
        Assert.Contains("lˈiːd͡z", century);
    }

    /**
     * ⚠ A DEFECT THAT PRODUCES A READING, not garbage. `°C` dropped its sign and left ⟨C⟩ to the g2p, which
     * read it as Latvian /t͡s/ — a plausible syllable that no leak class, no DROP and no referee can see.
     */
    [Fact]
    public void TheDegreeSignAndItsScaleName()
    {
        Assert.Equal("dˈiwpatsmit lˈiːd͡z ˈastuɔ̯ɲpatsmit t͡sˈɛlsija ɡrˈaːdi", Say("12—18 °C"));
        Assert.Equal("pˈiɛt͡sdɛsmit sˈɛʃi kˈuɔ̯mats t͡ʃˈɛtri ɡrˈaːdi", Say("56,4°"));
        // a figure with a fraction takes the PLURAL whatever its integer part — 21,5 is not a count of one
        Assert.Contains("ɡrˈaːdi", Say("21,5 °C"));
        Assert.Contains("ɡrˈaːts", Say("21 °C")); // ...but a bare 21 does take the singular
        // ⚠ the whitespace after ° was consumed even when no scale letter was taken: *6 grādivirs nulles*
        Assert.Equal("sˈɛʃi ɡrˈaːdi vˈirs nˈullɛs", Say("6° virs nulles"));
        // no space to inherit at all — separate, so the unread ⟨K⟩ stays visible to the RAW-LATIN gate
        Assert.Contains("k", Toks("6500°K"));
        // the scale letter needs a letter boundary, or it eats the ⟨C⟩ of *Celsija* and leaves *elsija*
        Assert.Equal("dˈiwdɛsmit ɡrˈaːdi t͡sˈɛlsija skˈalaː", Say("20° Celsija skalā"));
    }

    /**
     * ⚠ THE VALUE ITSELF WAS BEING DESTROYED. Latvian groups digits with a SPACE, so `29 660` read as two
     * numbers and `$230 000` came out as *divi simti trīsdesmit nulle*. De-grouping runs first for that
     * reason. And EVERY LEADING ZERO IN A FRACTION IS SPOKEN: reading the fraction as a NUMBER makes `5,09`
     * and `5,9` byte-identical, so the quantity is wrong by a factor of ten in well-formed text.
     */
    [Fact]
    public void GroupedFiguresKeepTheirValueAndFractionsKeepTheirLeadingZeros()
    {
        Assert.Equal("dˈiwdɛsmit dˈɛviɲi tˈuːkstuɔ̯ʃi sˈɛʃi sˈimti sˈɛʃdɛsmit kvˈadraːtkiluɔ̯mɛtri", Say("29 660 km²"));
        Assert.Equal("dˈivi sˈimti trˈiːsdɛsmit tˈuːkstuɔ̯ʃi dˈuɔ̯laːri", Say("$230 000"));
        Assert.NotEqual(Say("5,9"), Say("5,09"));
        Assert.Equal("pˈiɛt͡si kˈuɔ̯mats nˈullɛ dˈɛviɲi", Say("5,09"));
        Assert.Equal("pˈiɛt͡si kˈuɔ̯mats dˈɛviɲi", Say("5,9"));
        // nominative-only magnitudes left *miljardi dolāri EM* — the tier matched with no trailing boundary
        Assert.DoesNotContain("ˈɛm", Toks("$17.37 miljardiem"));
    }

    /** Units, rates and agreement — and the rate's denominator is a LOCATIVE, not a preposition. */
    [Theory]
    [InlineData("1 km", "vˈiɛns kˈiluɔ̯mɛtrs")]
    [InlineData("11 km", "vˈiɛnpatsmit kˈiluɔ̯mɛtri")] // ...11 is NOT singular
    [InlineData("21 %", "dˈiwdɛsmit vˈiɛns prˈuɔ̯t͡sɛnts")]
    [InlineData("120 km/h", "sˈimts dˈiwdɛsmit kˈiluɔ̯mɛtri stˈundaː")]
    [InlineData("54—57%", "pˈiɛt͡sdɛsmit t͡ʃˈɛtri lˈiːd͡z pˈiɛt͡sdɛsmit sˈɛptiɲi prˈuɔ̯t͡sɛnti")]
    [InlineData("+5", "plˈus pˈiɛt͡si")]
    [InlineData("-5", "mˈiːnuss pˈiɛt͡si")] // the ASCII hyphen IS a minus before a figure
    public void UnitsRatesAndSigns(string text, string want) => Assert.Equal(want, Say(text));

    /**
     * ⚠ A CODE OPERATOR IS NOT AN EQUATION. The first cut replaced every `=` unconditionally and produced
     * `a==b` → *a vienāds  vienāds b* — the word twice AND a double space. Both halves are readings, so no
     * gate could see it.
     */
    [Fact]
    public void OperatorsAreReadOnlyWhenOperandFlanked()
    {
        Assert.Contains("vˈiɛnaːts", Say("x = y"));
        Assert.DoesNotContain("vˈiɛnaːts", Say("a==b"));
        Assert.DoesNotContain("mˈazaːks", Say("5 <= 6"));
        Assert.Contains("mˈazaːks", Say("5 < 6"));
        Assert.Contains("lˈiːd͡z", Say("1841-1846")); // a hyphen BETWEEN figures is a range
    }

    /**
     * ⚠ A DOTTED ABBREVIATION IS NOT A SENTENCE, AND `p.m.ē.` WAS FOUR OF THEM — it read as *p . m . ēː .*,
     * three letter-fragments and four clause breaks inside one three-word phrase. Every fragment is a legal
     * Latvian sound, so nothing could see it. ⚠ THE MIRROR DEFECT is just as bad: an abbreviation's final
     * period is also the SENTENCE's, and swallowing it welds two sentences together.
     */
    [Fact]
    public void DottedAbbreviationsExpandWithoutEatingTheSentence()
    {
        // the trailing `.` is KEPT because it ends the input, and therefore a sentence
        Assert.Equal("pˈiɛt͡si sˈimti ɡˈats pˈirms mˈuːsu ˈɛːras .", Say("500. gads p.m.ē."));
        Assert.Equal("ˈun t͡sˈiti .", Say("u.c."));
        Assert.Equal("tˈas ˈir , nˈɛtiɛk", Say("t.i., netiek"));
        Assert.DoesNotContain(".", Toks("t.i., netiek")); // ...mid-clause, no break at all
        Assert.Contains(".", Toks("Tas ir dārgi u.c. Nākamais teikums."));
        Assert.Contains("ˈɛːras .", Say("500. gads p.m.ē. Tas bija sen."));
        // a COUNTED abbreviation takes the agreement rule; the corpus writes it with no trailing dot
        Assert.Equal("sˈimts sˈɛʃdɛsmit lˈappusɛs", Say("160 lpp"));
        Assert.Equal("nˈumurs ˈastuɔ̯ɲi sˈimti pˈiɛt͡sdɛsmit dˈɛviɲi", Say("nr. 859"));
        // ⚠ `№` IS THE SAME WORD AND WAS SILENTLY DELETED (#1209). It is not a letter, so the tokenizer
        // never emitted it — `2MV-4 №3` read as *…divi trīs* with the "number" simply gone, while `nr. 3`
        // two words away read *numurs trīs*. Nothing was left over, so no leak class could see it.
        Assert.Equal("2MV-4 numurs 3", N("2MV-4 №3"));
        Assert.Equal("numurs 3", N("№3"));   // the gap is SUPPLIED, or the noun fuses onto the digits
        Assert.Equal("numurs 3", N("№ 3"));
        Assert.Equal("№", N("№"));           // a bare sign with no operand is metalinguistic, and refused
        // ⚠ PERSONAL INITIALS ARE NOT ABBREVIATIONS — matching case-insensitively made `T.I. Ivanovs`, an
        // initial pair lv.wikipedia writes, introduce a surname with *tas ir*. Latvian writes these lower case.
        Assert.DoesNotContain("tˈas ˈir", Say("T.I. Ivanovs bija"));
    }

    /**
     * ⚠ `ReadDigits` ITERATES CODE UNITS, NOT CODE POINTS — the TS spells it `digits.split("")`, which
     * splits an astral pair into its two halves, and each half is then spaced out on its own. Iterating code
     * POINTS here would be a divergence, not a fix.
     *
     * ⚠ AND THE STRINGS ARE BUILT IN THE BODY, NOT PASSED AS `InlineData`. xUnit serializes theory
     * arguments and a LONE SURROGATE does not survive that round trip — it returns as U+FFFD, so the rows
     * silently stop testing what they claim while still reporting green.
     */
    [Fact]
    public void ReadDigitsIteratesCodeUnitsNotCodePoints()
    {
        const string hi = "\ud83d", lo = "\ude00";
        Assert.Equal($"viens {hi} {lo} divi", LvNumbers.ReadDigits($"1{hi}{lo}2"));
        Assert.Equal($"{hi} {lo}", LvNumbers.ReadDigits($"{hi}{lo}"));
        Assert.Equal("a b c", LvNumbers.ReadDigits("abc"));
        Assert.Equal("", LvNumbers.ReadDigits(""));
    }

    /** ⚠ A LONE SURROGATE MUST NOT THROW — `PhonemizeWord` normalizes the raw word, which is #1199's shape.
     *  Built in the body for the same reason as above. The stranded half is simply dropped. */
    [Fact]
    public void ALoneSurrogateDoesNotThrow()
    {
        const string hi = "\ud83d";
        Assert.Equal("", Word(hi));
        Assert.Equal("ˈa", Word($"a{hi}"));
        Assert.Equal("ˈab", Word($"a{hi}b"));
    }

    /**
     * #1209 — `‰` AND `§` ARE REFUSED, MEASURED RATHER THAN OVERLOOKED. espeak supplies both
     * (`‰ pRomiles_!`, `§ sektsija`) and `promiles` is attested 5/2, so vocabulary is not the obstacle —
     * the instances are. BOTH `‰` in the retained text are METALINGUISTIC and carry no operand
     * ("Promili apzīmē ar promiles zīmi, ko pieraksta ‰", "sāļumu mēra promilēs (‰)"), so a `NUM ‰` rule
     * fires on neither and reading the bare sign would say the word a SECOND time in a sentence that
     * already writes it — trap 12, a silent drop traded for a stutter. `§` is ×0 in the retained text, and
     * espeak's *sekcija* is one unverified tier for a sense Latvian legal writing spells *paragrāfs*.
     */
    [Theory]
    [InlineData("sāļumu mēra promilēs (‰)", "sāļumu mēra promilēs (‰)")]
    [InlineData("5 ‰", "5 ‰")]
    [InlineData("§ 5", "§ 5")]
    [InlineData("5 §", "5 §")]
    public void ThePermilleAndSectionSignsStaySilent(string text, string want) => Assert.Equal(want, N(text));

    /** The thousand is a MASCULINE noun that keeps its numeral, unlike Latgalian's feminine `tyukstūša`. */
    [Theory]
    [InlineData(1000, "tūkstotis")]
    [InlineData(21000, "divdesmit viens tūkstotis")]
    [InlineData(100000, "simts tūkstoši")]
    [InlineData(1000000, "viens miljons")]
    [InlineData(0, "nulle")]
    [InlineData(21, "divdesmit viens")]
    [InlineData(11, "vienpadsmit")]
    public void TheNumberTable(double n, string want) => Assert.Equal(want, LvNumbers.NumberToWords(n));
}
