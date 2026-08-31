/**
 * The portable half of test/lithuanian.test.ts — Lithuanian (lt), Baltic, Latin script. A RULE-based g2p:
 * a left-to-right scan + the hard/soft PALATALIZATION contrast (Cʲ before front vowels / the softening ⟨i⟩,
 * spreading leftward through clusters) + regressive VOICING assimilation + n→ŋ before velars. Stress is
 * lexical and pitch-accented → not marked, which is where this engine parts company with sibling Latvian.
 *
 * ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). Almost every rule in the
 * normalization layer is a table-plus-composition shape — `Agree` has THREE arms and the corpus exercises
 * them very unevenly — so each arm gets a case, and where the corpus does not contain one the case is
 * chosen anyway.
 *
 * Every expected value here is the TypeScript engine's own output, extracted mechanically from its suite.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Xunit;
using LtEngine = Vernacula.Phonemizer.Languages.Lithuanian.LithuanianPhonemizer;
using LtNormalize = Vernacula.Phonemizer.Languages.Lithuanian.Normalize;
using LtNumbers = Vernacula.Phonemizer.Languages.Lithuanian.Numbers;

namespace Vernacula.Phonemizer.Tests;

public class LithuanianTests
{
    private static readonly JsRe WS = JsRegex.Compile("\\s+", "gu");
    private static string Word(string s) => LtEngine.PhonemizeWord(s);
    /** The normalizer is pure text→text — assert on its output, not on IPA. */
    private static string N(string s) => LtNormalize.NormalizeLithuanian(s);
    private static string NT(string s) => Js.Trim(N(s));
    private static string Init(string s) => LtNormalize.NormalizeLithuanianInitialisms(s);
    /** Through the ENGINE object — this does NOT include the shared Roman pass. */
    private static string Say(string s) => Js.Trim(WS.Replace(new LtEngine().Text(s), " "));
    /** Through the REAL phonemizer — this DOES include the shared Roman pass. */
    private static string Full(string s) => Js.Trim(WS.Replace(Phonemizer.Phonemize(s, "lt"), " "));

    /** Palatalization, the velar spread refusal, the softening ⟨i⟩, the rising diphthongs, and voicing. */
    [Theory]
    [InlineData("katinas", "kɐtʲɪnɐs")]     // ⟨t⟩ soft before ⟨i⟩; ⟨k n⟩ hard before ⟨a⟩ (referee-verified)
    [InlineData("penki", "pʲɛŋʲkʲɪ")]       // ⟨p⟩ soft before ⟨e⟩, ⟨k⟩ soft before ⟨i⟩, ⟨n⟩→ŋʲ
    [InlineData("šeši", "ʃʲɛʃʲɪ")]
    [InlineData("medis", "mʲɛdʲɪs")]
    [InlineData("knyga", "knʲiːɡɐ")]        // ⟨k⟩ HARD before soft ⟨nʲ⟩ — velars take no leftward spread
    [InlineData("naktis", "nɐktʲɪs")]       // ⟨k⟩ HARD before soft ⟨tʲ⟩ (referee-verified)
    [InlineData("čia", "t͡ʃʲɛ")]            // the softening ⟨i⟩ is silent; ⟨a⟩ then fronts to ɛ
    [InlineData("ačiū", "ɐt͡ʃʲuː")]
    [InlineData("Dievas", "dʲiɛʋɐs")]       // ⟨ie⟩ opens on a front [i] and palatalises
    [InlineData("lietuva", "lʲiɛtʊʋɐ")]
    [InlineData("aštuoni", "ɐʃtuɔnʲɪ")]     // ⟨uo⟩ opens on the back [u] and does NOT
    [InlineData("dirbti", "dʲɪrʲpʲtʲɪ")]    // ⟨b⟩→[p] before voiceless ⟨t⟩, keeping softness
    [InlineData("žmogus", "ʒmoːɡʊs")]
    [InlineData("kalba", "kɐlbɐ")]
    public void ThePhonemizer(string word, string want) => Assert.Equal(want, Word(word));

    /** Cardinals: the -lika teens and the Baltic three-way counted-noun concord. */
    [Theory]
    [InlineData("Labas, Lietuva!", "lɐbɐs , lʲiɛtʊʋɐ !")]
    [InlineData("7", "sʲɛpʲtʲiːnʲɪ")]
    [InlineData("15", "pʲɛŋʲkʲoːlʲɪkɐ")]
    [InlineData("21", "dʲʋʲɪdʲɛʃʲɪmt ʋʲiɛnɐs")]
    [InlineData("101", "ʃʲɪmtɐs ʋʲiɛnɐs")]
    [InlineData("555", "pʲɛŋʲkʲɪ ʃʲɪmtɐɪ pʲɛŋʲkʲɛzʲdʲɛʃʲɪmt pʲɛŋʲkʲɪ")]
    [InlineData("1000", "tuːkstɐnʲtʲɪs")]   // the numeral *vienas* is dropped
    [InlineData("2000", "dʊ tuːkstɐnʲt͡ʃʲɛɪ")]                       // …2–9 ⇒ NOM PL
    [InlineData("10000", "dʲɛʃʲɪmt tuːkstɐnʲt͡ʃʲuː")]                // …0 ⇒ GEN PL
    [InlineData("21000", "dʲʋʲɪdʲɛʃʲɪmt ʋʲiɛnɐs tuːkstɐnʲtʲɪs")]     // …1 ⇒ NOM SG
    [InlineData("100000", "ʃʲɪmtɐs tuːkstɐnʲt͡ʃʲuː")]
    [InlineData("1000000", "ʋʲiɛnɐs mʲɪlʲɪjoːnɐs")]                  // keeps the numeral, unlike tūkstantis
    [InlineData("1000000000", "ʋʲiɛnɐs mʲɪlʲɪjɛrdɐs")]
    public void TheCardinalsAndClauseAssembly(string text, string want) => Assert.Equal(want, Say(text));

    /**
     * THE THREE-WAY CONCORD, which is the reason this language cannot use Core/NormalizeSymbols.cs: the
     * shared tier holds one invariant string per unit and none of these three is it (trap 14). The corpus
     * writes mostly round tens, so the sg and pl arms are largely NOT corpus instances.
     */
    [Theory]
    [InlineData("1 %", "vienas procentas")]                     // …1 ⇒ nom SG
    [InlineData("2 %", "du procentai")]                         // …2–9 ⇒ nom PL
    [InlineData("10 %", "dešimt procentų")]                     // …0 ⇒ GEN PL
    [InlineData("11 %", "vienuolika procentų")]                 // the TEEN exception ⇒ GEN PL
    [InlineData("21 %", "dvidešimt vienas procentas")]
    [InlineData("101 %", "šimtas vienas procentas")]
    [InlineData("1 km", "vienas kilometras")]
    [InlineData("2 km", "du kilometrai")]
    [InlineData("100 km", "šimtas kilometrų")]
    [InlineData("1 °C", "vienas laipsnis Celsijaus")]
    [InlineData("17 °C", "septyniolika laipsnių Celsijaus")]
    // The SQUARED modifier agrees with the noun it precedes, so it has the same three arms.
    [InlineData("1 km²", "vienas kvadratinis kilometras")]
    [InlineData("2 km²", "du kvadratiniai kilometrai")]
    [InlineData("100 km²", "šimtas kvadratinių kilometrų")]
    public void TheCountedNounConcord(string text, string want) => Assert.Equal(want, N(text));

    /** ⚠ `km2` must not leave the `2` behind as a NUMBER — trap 53's Igbo defect ("790 kilometres two"),
     *  invisible to every leak class because an ASCII digit in the reading looks like a quantity. */
    [Fact]
    public void TheAsciiSquaredFormIsClaimedToo() =>
        Assert.Equal("vienas milijonas du šimtai šešiasdešimt septyni tūkstančiai kvadratinių kilometrų",
            N("1 267 000 km2"));

    /** GENDER. `NumberToWords` emits the MASCULINE 1–9 (correct for a bare numeral, which has nothing to
     *  agree with); a feminine counted noun needs the other set, on the final unit word only. */
    [Theory]
    [InlineData("4 val.", "keturios valandos")]          // not *keturi valandos
    [InlineData("21 val.", "dvidešimt viena valanda")]   // the swap is on the LAST word
    [InlineData("15 val.", "penkiolika valandų")]        // a teen is gender-invariant
    [InlineData("25 min.", "dvidešimt penkios minutės")]
    [InlineData("1 min.", "viena minutė")]
    // *diena* is feminine and the numeral was not — 40 of the 57 `d.` end in a gender-marked 1–9.
    [InlineData("balandžio 7 d.", "balandžio septynios dieną")]
    [InlineData("sausio 1 d.", "sausio viena dieną")]
    [InlineData("liepos 24 d.", "liepos dvidešimt keturios dieną")]
    [InlineData("vasario 15 d.", "vasario penkiolika dieną")]
    public void AFeminineCountedNounTakesTheFeminineNumeral(string text, string want) =>
        Assert.Equal(want, NT(text));

    /**
     * ⚠ THE MEASUREMENT THIS LAYER TURNS ON. `m.` with a dot is the YEAR (×347 in the retained text); bare
     * `m` is the METRE (×18). Both branches are pinned, and so are BOTH RESIDUALS — the corpus contains one
     * counter-example each way and NEITHER is separable from the string. They are pinned as they read, not
     * as they ought to read, so the exposure stays visible.
     */
    [Theory]
    [InlineData("1802 m.", "tūkstantis aštuoni šimtai du metais")]
    [InlineData("8850 m aukštis", "aštuoni tūkstančiai aštuoni šimtai penkiasdešimt metrų aukštis")]
    // RESIDUAL: a METRE read as a year — one instance in 347, and no feature of the string separates it.
    [InlineData("aukštis 174 m. Liūčių", "aukštis šimtas septyniasdešimt keturi metais Liūčių")]
    // RESIDUAL: a YEAR read as metres — the writer used a comma for the abbreviation dot.
    [InlineData("2003 m, atitinkamai", "du tūkstančiai trys metrai, atitinkamai")]
    // Adding `,` to the metre rule's right guard would fix the second and break this, which is why it is
    // not added: two genuine metres for one year is the wrong trade.
    [InlineData("(8850 m, Himalajuose)",
        "(aštuoni tūkstančiai aštuoni šimtai penkiasdešimt metrų, Himalajuose)")]
    public void TheYearMetreSplitAndItsTwoResiduals(string text, string want) => Assert.Equal(want, NT(text));

    /** ⚠ A capital `M.` is a PERSONAL INITIAL in this corpus (all 6), never a year — so that rule is
     *  deliberately case-SENSITIVE, which inverts trap 7's usual demand. */
    [Fact]
    public void ACapitalEmIsAPersonalInitialNotAYear() => Assert.Equal("2000 M.", N("2000 M."));

    /** The date frame, tabulated from the corpus's own spelled-out text ("1936 METŲ liepos 24 DIENĄ"). */
    [Theory]
    [InlineData("1930 m. balandžio 25 d.",
        "tūkstantis devyni šimtai trisdešimt metų balandžio dvidešimt penkios dieną")]
    [InlineData("1997 m. jis", "tūkstantis devyni šimtai devyniasdešimt septyni metais jis")]
    // A SMALL or decimal operand is a QUANTITY of years, not a date — a life expectancy takes the genitive.
    [InlineData("83,4 m.", "aštuoniasdešimt trys kablelis keturi metų")]
    [InlineData("13 m. sūnų", "trylika metų sūnų")]
    // ORDERING: in `pr. m. e.` the `m.` is *mūsų*, not *metai*, so the era phrase must be consumed first.
    // This is the one ordering constraint in the file that produces a wrong WORD rather than a wrong pause.
    [InlineData("1200 m. pr. m. e.", "tūkstantis du šimtai metais prieš mūsų erą")]
    [InlineData("nuo maždaug m. e. pradžios", "nuo maždaug mūsų eros pradžios")]
    public void TheYearsCaseIsChosenByTheFrame(string text, string want) => Assert.Equal(want, NT(text));

    /**
     * ⚠ THROUGH THE REAL PHONEMIZER, because what is pinned is an ordering that is not in this language's
     * files at all: lt is not in the registry's ROMAN_NATIVE, so the shared Roman pass wraps `Text` and a
     * Roman numeral is DIGITS before either lt pass runs. Asserted through the engine object instead, this
     * fails with the initialism pass spelling `XV` out — which is precisely the defect trap 16 says to pin
     * end-to-end rather than in the layer.
     */
    [Fact]
    public void RomanNumeralsAreResolvedAboveThisLayer()
    {
        Assert.Equal(Word("penkiolika"), Full("XV"));
        Assert.Equal($"{Word("Louis")} {Word("keturiolika")}", Full("Louis XIV"));
        Assert.Equal($"{Word("devyniolika")} {Word("amžiaus")}", Full("XIX a."));
    }

    /** De-grouping runs above everything that reads a number, and to a FIXED POINT — a `for` capped at four
     *  passes is a ceiling, not a reason. Without it the trailing `000` becomes the WORD *nulis*, a silent
     *  1000× error of trap 56's tg class rather than a visible leak. */
    [Theory]
    [InlineData("64 000 Lt", "šešiasdešimt keturi tūkstančiai litų")]
    [InlineData("5 230 330 gyventojų", "5230330 gyventojų")]
    [InlineData("1 385 000 000 gyventojų", "1385000000 gyventojų")]
    [InlineData("1 234 567 890 123 x", "1234567890123 x")]
    // ⚠ A GROUP MAY BE FOLLOWED BY A DECIMAL COMMA — a right guard that rejected one split `18 550,72 €`
    // into "18" and "550,72", two numbers where the writer wrote one.
    [InlineData("18 550,72 €",
        "aštuoniolika tūkstančių penki šimtai penkiasdešimt kablelis septyni du eurų")]
    public void DeGroupingRunsToAFixedPoint(string text, string want) => Assert.Equal(want, NT(text));

    /** The range joiner is a PREPOSITION in a correlative frame, not an infix — all six numeral-flanked
     *  `iki` in the retained text have `nuo` in front of them, so the rule emits both halves. */
    [Theory]
    [InlineData("1890–1906", "nuo 1890 iki 1906")]
    [InlineData("nuo 467 000 iki 114 000", "nuo 467000 iki 114000")]     // no second `nuo`
    [InlineData("NUO 5-10 km", "NUO 5 iki dešimt kilometrų")]            // the guard is case-insensitive
    // Any preposition, not only `nuo` — stacking one gave *prieš NUO 50 iki 65*.
    [InlineData("prieš 50 –65 tūkst. metų", "prieš 50 iki šešiasdešimt penki tūkstančių metų")]
    // A TEMPORAL span takes the joiner alone: "nuo 1997 iki 1998 metais" would put a genitive-governing
    // preposition in front of an instrumental. The CENTURY is temporal too, and was not in that list.
    [InlineData("1997–1998 metais", "1997 iki 1998 metais")]
    [InlineData("14–13 a. sandūroje", "14 iki trylika amžiaus sandūroje")]
    [InlineData("veikė 1918–1926 metais", "veikė 1918 iki 1926 metais")]
    // ⚠ A preceding `iki` refuses the span OUTRIGHT — suppressing half the correlative is not enough when
    // the preposition already standing there IS the other half: *iki septyni IKI aštuoni*.
    [InlineData("Iki 7–8, o vietomis", "Iki 7–8, o vietomis")]
    [InlineData("nuo 1952-1967", "nuo 1952 iki 1967")]
    // The range re-emits its LEFT operand as digits, so no later rule can make it agree — audible only in
    // front of a feminine noun, which the unit rule feminises on the right operand and not on the left.
    [InlineData("truko 2–3 val.", "truko nuo dvi iki trys valandos")]
    [InlineData("2–3 km", "nuo 2 iki trys kilometrai")]                  // masculine: unchanged
    public void RangesEmitTheCorrelativeWithoutDoublingAPreposition(string text, string want) =>
        Assert.Equal(want, NT(text));

    /** ⚠ A CENTURY SPAN through the real phonemizer, because the corpus writes it as a Roman numeral. */
    [Fact]
    public void ACenturySpanTakesTheJoinerAlone() =>
        Assert.Equal($"{Word("keturiolika")} {Word("iki")} {Word("trylika")} {Word("amžiaus")}",
            Full("XIV–XIII a."));

    /** Signs. Omitting a plus is lossless; omitting a MINUS inverts, and this corpus has both. */
    [Theory]
    [InlineData("-5 °C", "minus penki laipsniai Celsijaus")]
    [InlineData("(-1,1 %)", "(minus vienas kablelis vienas procentų)")]
    [InlineData("iki +40 °C", "iki plius keturiasdešimt laipsnių Celsijaus")]
    [InlineData("15-16 °C", "nuo 15 iki šešiolika laipsnių Celsijaus")]  // a RANGE, not a negative
    [InlineData("Kaunas-Vilnius", "Kaunas-Vilnius")]                     // a compound hyphen
    [InlineData("MiG-29", "MiG-29")]                                     // a designation
    public void ASignIsReadOnlyWhenItOpensTheToken(string text, string want) => Assert.Equal(want, N(text));

    /** Currency is POSTPOSED and must claim whatever stands between the figure and the noun. */
    [Theory]
    [InlineData("5713 $", "penki tūkstančiai septyni šimtai trylika dolerių")]
    [InlineData("€151 mln.", "šimtas penkiasdešimt vienas milijonas eurų")]
    // A SPELLED magnitude is re-emitted verbatim and the currency follows it (trap 10). Without this the
    // noun wedged between the count and its magnitude: *dvidešimt keturi DOLERIAI milijonus*.
    [InlineData("$24 milijonus kasmet", "dvidešimt keturi milijonus dolerių kasmet")]
    // ⚠ A CLAUSE-FINAL FIGURE MUST STILL BE CLAIMED — a right guard treating any following comma as a
    // decimal declined this outright and left the sign unread.
    [InlineData("$4000, nugalėtojui", "keturi tūkstančiai dolerių , nugalėtojui")]
    [InlineData("už $800.", "už aštuoni šimtai dolerių .")]
    [InlineData("net 25 %.", "net dvidešimt penki procentai.")]
    // DON'T SAY IT TWICE (trap 12) — word-bounded and case-insensitive, so `eur` cannot match inside
    // *Europos* and a sentence-initial capital cannot escape the guard and double the reading.
    [InlineData("$90 milijonų dolerių", "devyniasdešimt milijonų dolerių")]
    [InlineData("Europos €500", "Europos penki šimtai eurų")]
    // ⚠ AND THE GUARD REACHES TWO WORDS, NOT THIRTY CHARACTERS — thirty reached a noun belonging to a
    // DIFFERENT figure and deleted this `$` entirely.
    [InlineData("kaina 5 $ ir dešimt dolerių", "kaina penki doleriai ir dešimt dolerių")]
    [InlineData("9 986 mlrd. JAV dolerių",
        "devyni tūkstančiai devyni šimtai aštuoniasdešimt šeši milijardų JAV dolerių")]
    public void CurrencyIsPostposedAndClaimsAnInterveningMagnitude(string text, string want) =>
        Assert.Equal(want, NT(text));

    /** A magnitude between the figure and its unit — the "one declaration, two consumers" case. The
     *  magnitude step words-ifies the figure and destroys the adjacency the unit step matches on, so the
     *  unit step has to claim both or the unit is orphaned into the phoneme stream raw. */
    [Theory]
    [InlineData("65,3 tūkst. km²", "šešiasdešimt penki kablelis trys tūkstančių kvadratinių kilometrų")]
    [InlineData("3 mln. km²", "trys milijonai kvadratinių kilometrų")]
    [InlineData("19 tūkst. hektarų", "devyniolika tūkstančių hektarų")]
    [InlineData("20 tūkst.", "dvidešimt tūkstančių")]
    // A magnitude may stand between the figure and a ONE-LETTER key too — `m`/`t`/`g` lacked it.
    [InlineData("50 tūkst. t durpių", "penkiasdešimt tūkstančių tonų durpių")]
    [InlineData("2 mlrd. JAV dolerių", "du milijardų JAV dolerių")]
    // ⚠ ORDERING COUPLING THIS LAYER CREATED: step 1 inserts *prieš mūsų erą*, and step 9's "a letter
    // follows ⇒ this magnitude governs a noun" lookahead then fired on the layer's OWN insertion.
    [InlineData("2 tūkst. pr. m. e.", "du tūkstančiai prieš mūsų erą")]
    [InlineData("3 tūkst. m. e.", "trys tūkstančiai mūsų eros")]
    // ⚠ AND THE KEY IS WORD-BOUNDED, which it was not: `tūkst` is five characters inside the spelled-out
    // *tūkstančius*, so `apie 3 tūkstančius upių` was rewritten as *trys tūkstančių ANČIUS*.
    [InlineData("apie 3 tūkstančius upių", "apie 3 tūkstančius upių")]
    [InlineData("37 tūkstančių hektarų", "37 tūkstančių hektarų")]
    // A magnitude whose FIGURE this layer declined is still expanded, or it goes to the g2p raw.
    // ⚠ AND SO IS THE CURRENCY SIGN, SINCE #1211. This row used to end `milijardų €`, which recorded the
    // magnitude half of the mop-up and left the other half unargued: the `€` was not leaked but DELETED,
    // because it is not a letter and the tokenizer never emitted it.
    [InlineData("55.89 mlrd €", "55.89 milijardų eurų")]
    public void AMagnitudeBetweenTheFigureAndItsUnitIsClaimed(string text, string want) =>
        Assert.Equal(want, NT(text));

    /** ⚠ The era exclusion through the real phonemizer, because the corpus writes the operand as a Roman
     *  numeral and that pass is not in this file at all. */
    [Fact]
    public void TheMagnitudeGenitiveLookaheadDoesNotFireOnTheEraPhrase() =>
        Assert.Equal(string.Join(" ",
                new[] { "keturi", "tūkstančiai", "prieš", "mūsų", "erą", "pabaigoje" }.Select(Word)),
            Full("IV tūkst. pr. m. e. pabaigoje"));

    /**
     * GUARDS THAT MUST REJECT. Each is a shape the rule would damage, and each was probed rather than
     * assumed — trap 8: zero corpus instances is not evidence of correctness, and trap 52: a lookbehind
     * rejects a POSITION, so the operand is anchored on BOTH edges.
     */
    [Theory]
    [InlineData("802.11m", "802.11m")]                       // not "802.11 metres"
    [InlineData("802.11g", "802.11g")]
    [InlineData("12.5km", "12.5km")]
    [InlineData("44.111.333.12", "44.111.333.12")]
    // ⚠ A RATE IS REFUSED WHOLE. Without the trailing-slash guard `500 m/s` read as *penki šimtai METRŲ/s*
    // — the numerator claimed, the denominator raw, which is worse than the two raw letters it replaced.
    [InlineData("500 m/s", "500 m/s")]
    [InlineData("140–160 kcal/cm²", "nuo 140 iki 160 kcal/cm²")]   // `kcal` is unnamable, so refused whole
    [InlineData("12,5 mg/kg", "12 kablelis 5 mg/kg")]
    // …but a CLAUSE-FINAL unit is not a designation and must still read.
    [InlineData("neviršija 600 km.", "neviršija šeši šimtai kilometrų.")]
    [InlineData("12,367.7 km²", "12,367.7 km²")]
    // A CATALOGUE NUMBER is a chain of hyphen-joined digit groups; with a hyphen admitted on both edges the
    // range rule asserted a `nuo`/`iki` frame over one, and chained inside it.
    [InlineData("ISBN 978-83-01-14342-8", "ISBN 978-83-01-14342-8")]
    [InlineData("ISBN 84-87863-63-9", "ISBN 84-87863-63-9")]
    [InlineData("x86-64, PowerPC", "x86-64, PowerPC")]
    [InlineData("Airbus A300-600ST", "Airbus A300-600ST")]
    [InlineData("Vilnius 1996-2005.", "Vilnius nuo 1996 iki 2005.")]
    public void DesignationsVersionsAndRatesAreRefusedWhole(string text, string want) =>
        Assert.Equal(want, N(text));

    /** A SCORE IS A PAIR, NOT A SPAN — *nuo vienas iki vienas* is a confident misreading rather than a
     *  rough one, so the whole match is refused on the corpus's own score words. ⚠ AND THE LIST NAMES THE
     *  RESULT, NEVER THE TEAM: `komandai` suppressed an ordinary year span 25 characters on. */
    [Theory]
    [InlineData("Rezultatas buvo lygus (1-1)", "Rezultatas buvo lygus (1-1)")]
    [InlineData("pergalę rezultatu 2-1.", "pergalę rezultatu 2-1.")]
    [InlineData("pralaimėjo komandai 155–157.", "pralaimėjo komandai 155–157.")]
    [InlineData("Notts County komandai. 1997–1998 metais", "Notts County komandai. 1997 iki 1998 metais")]
    public void ASportsScoreIsRefusedAndReadAsTwoCardinals(string text, string want) =>
        Assert.Equal(want, N(text));

    /** The classes this layer deliberately declines. Pinned as INVARIANTS about the language rather than as
     *  "not done yet", which would be an assertion about the schedule and has a shelf life (trap 5). */
    [Theory]
    [InlineData("2:15:16", "2:15:16")]                        // every N:NN here is a duration or a timestamp
    [InlineData("2/3 visų", "2/3 visų")]                      // needs the ordinal series, not sourced
    [InlineData("γράφω = graphō", "γράφω = graphō")]          // `=` means "means" in a gloss
    // A bare `°` is a COORDINATE here; reading it while `′` stayed silent would fuse the two numbers.
    [InlineData("54° 54′ šiaurės platumos", "54° 54′ šiaurės platumos")]
    // The `×` sign was silent and the ASCII stand-in was READ, as /z/ — one refusal spelled two ways.
    [InlineData("x1, x2 ir x3", "x1, x2 ir x3")]              // a multiplier PREFIX, untouched
    [InlineData("x86, PowerPC", "x86, PowerPC")]
    public void TheDeclinedClassesAreLeftAlone(string text, string want) => Assert.Equal(want, N(text));

    [Fact]
    public void ADigitFlankedAsciiCrossIsFoldedToSilence() =>
        Assert.Equal("110 46 dvidešimt vienas milimetras", NT("110 x 46 x 21 mm"));

    /** ⚠ `t` IS THE TONNE ONLY WITHOUT A FOLLOWING HYPHEN. `t-metis` is *tūkstantmetis*, the MILLENNIUM,
     *  ×4 against ONE genuine tonne — the counter-example outnumbers the true positive 3:1, and the layer
     *  read all four as *tonos*. The suffix is re-emitted verbatim with the case the writer chose. */
    [Theory]
    [InlineData("III t - mečio", "III tūkstantmečio")]
    [InlineData("2 t-metis", "2 tūkstantmetis")]
    [InlineData("II-I t - metyje", "II-I tūkstantmetyje")]
    [InlineData("sveria 90 g,", "sveria devyniasdešimt gramų,")]
    [InlineData("1 g", "vienas gramas")]
    [InlineData("25 mg sorbatų", "dvidešimt penki miligramai sorbatų")]
    public void TheOneLetterKeysAndTheirDiscriminators(string text, string want) => Assert.Equal(want, NT(text));

    /** Case- and spelling-narrow keys. `Nr.` was already tolerant, so the convention was known; the others
     *  matched a form this corpus does not write — `psl.` matched NOTHING at all here. */
    [Theory]
    [InlineData("Pvz., vanduo", "pavyzdžiui , vanduo")]        // sentence-initial
    [InlineData("Psl 47", "puslapis 47")]                      // capital AND no dot
    [InlineData("21,2 proc;", "dvidešimt vienas kablelis du procentų;")]
    [InlineData("52 proc.", "penkiasdešimt du procentai")]
    [InlineData("psl. 143–145, 149.", "puslapis nuo 143 iki 145, 149.")]
    public void TheDottedAbbreviationsTolerateACapitalAndAMissingDot(string text, string want) =>
        Assert.Equal(want, NT(text));

    /** The word boundary, not the dot, is what keeps `proc` off the words that begin with it. */
    [Theory]
    [InlineData("20 procentų", "20 procentų")]
    [InlineData("2 procesoriai", "2 procesoriai")]
    public void TheWordBoundaryNotTheDotIdentifiesProc(string text, string want) => Assert.Equal(want, N(text));

    /**
     * #1102 — THE MARKED CLOCK. The refusal read "11 `N:NN` in the retained text and NOT ONE is a time of
     * day"; over `lt_lt` there are 16 true clocks and 12 carry `val.`. ⚠ The refusal had already SEEN the
     * discriminator and read it backwards — it cites `19:11 val.` as a reason NOT to read, because the hour
     * noun is already there. It is, which is what makes it a marker no counter-example carries.
     * ⚠ NO WORD IS EMITTED: `valandų` always came from `val.`; what is gone is the clause pause.
     */
    [Theory]
    [InlineData("Vos po 11:00 val. protestuotojai", "Vos po 11 nulis valandų protestuotojai")]
    [InlineData("Šiandien 12.00 val (GMT laiku)", "Šiandien 12 00 val (GMT laiku)")]
    [InlineData("(19:11 val. UTC)", "(19 vienuolika valandų UTC)")]
    [InlineData("apie 19:11 val.", "apie 19 vienuolika valandų")]
    // ⚠ AND THE SPAN IS STILL HALF-CLAIMED, deliberately: taking the first operand too let the range rule
    // read `00 - 19` as *nuo 00 iki 19*, which is worse than the pause it would have removed.
    [InlineData("8:00 - 19:00 val.", "8:00 - 19 nulis valandų")]
    // A RATE still blocks it, or the denominator would be read while the numerator stays raw.
    [InlineData("515,3 km/val.", "515 kablelis 3 km/val.")]
    public void AMarkedClockKeepsItsPauseOff(string text, string want) => Assert.Equal(want, NT(text));

    /** ⚠ EVERY COUNTER-EXAMPLE THE REFUSAL NAMES IS STILL DECLINED, because none carries the marker. */
    [Theory]
    [InlineData("19:14:07 GMT", "19:14:07 GMT")]                        // a timestamp
    [InlineData("802.11n sparta", "802.11n sparta")]                    // Wi-Fi
    [InlineData("tarp 06:30 ir 07:30.", "tarp 06:30 ir 07:30.")]        // an unmarked range
    // ⚠ `a.m.`/`p.m.` ARE NOT IN THE MARKER SET, and that is a MEASURED RETREAT: adding them fixed both
    // instances while BREAKING them, because with the colon gone step 6 reads `19 a.` as *devyniolika
    // amžiaus*. A pause traded for a wrong WORD is the wrong side of trap 53.
    [InlineData("07:19 a.m. vietos laiku", "07:19 a.m. vietos laiku")]
    public void TheUnmarkedClocksAreStillDeclined(string text, string want) => Assert.Equal(want, N(text));

    [Fact]
    public void ASkiResultKeepsItsFigure() => Assert.Contains("4:41.30", N("laikas 4:41.30"));

    /** The initialism seam. `LetterName` is derived from espeak's letter block and validated by
     *  round-tripping through this engine's own g2p; the OOV arm spells only what cannot be syllabified. */
    [Theory]
    [InlineData("TSRS", "tė es er es")]                  // no vowel at all
    [InlineData("BVP", "bė vė pė")]
    [InlineData("IBM", "i bė em")]                       // has a vowel, illegal coda
    [InlineData("JAV", "jot a vė")]                      // readable, but LEXICALLY spelled
    [InlineData("DOS", "DOS")]                           // readable and read as a word
    [InlineData("G. R. Treviranas", "gė er Treviranas")] // personal initials
    // An all-caps DOCUMENT carries no signal and must not be spelled out letter by letter.
    [InlineData("VILNIUS YRA DIDELIS", "VILNIUS YRA DIDELIS")]
    public void TheInitialismSeam(string text, string want) => Assert.Equal(want, Init(text));

    /** The ampersand was DROPPED outright, which fused its neighbours into one token (traps 18/26). */
    [Fact]
    public void TheAmpersandIsSpacedOnBothSides() =>
        Assert.Equal("Stafecka, A. ir Mikuleniene, D.", N("Stafecka, A. & Mikuleniene, D."));

    /**
     * #1211 — THE MOP-UP WAS WRITTEN FOR `val.` AND THE MAGNITUDE BUT NOT FOR `min.` OR THE CURRENCY SIGN.
     * This layer twice decides in writing that refusing to read the NUMBER is not a reason to hand the
     * abbreviation back to the g2p; two members of that same class never got the line.
     *
     * `min.`'s own rule needs a claimable numeral, so a DURATION operand left the abbreviation exactly where
     * it started — *mʲɪn* plus a spurious sentence break, verbatim the defect the header records as the
     * reason `min.` was declared at all, while `val.` in the identical position was already mopped up.
     * ⚠ And a currency SIGN was deleted rather than leaked: `€` is not a letter, so the tokenizer never
     * emitted it and an amount was read with no currency at all, nothing left for any gate to see.
     */
    [Theory]
    [InlineData("2:11.60 min. lėčiau", "2:11.60 minučių lėčiau")]
    [InlineData("1:09.02 min.", "1:09.02 minučių")]
    [InlineData("12,367.7 €", "12,367.7 eurų")]
    // …and every CLAIMED case is untouched, including the say-it-twice guard.
    [InlineData("61,40 mlrd €", "šešiasdešimt vienas kablelis keturi nulis milijardų eurų")]
    [InlineData("$90 milijonų dolerių", "devyniasdešimt milijonų dolerių")]
    [InlineData("25 min.", "dvidešimt penkios minutės")]
    [InlineData("78 val. 25 min.", "septyniasdešimt aštuonios valandos dvidešimt penkios minutės")]
    // ⚠ A RATE STILL BLOCKS BOTH, or the denominator would be read while the numerator stays raw.
    [InlineData("515,3 km/val.", "515 kablelis 3 km/val.")]
    [InlineData("515,3 km/min.", "515 kablelis 3 km/min.")]
    // ⚠ THE SYMBOLS ONLY, NEVER `Lt` — two letters, and a bare-`Lt` mop-up would fire on any capitalised
    // abbreviation spelled that way. All four corpus `Lt` carry a claimable figure already.
    [InlineData("64 000 Lt", "šešiasdešimt keturi tūkstančiai litų")]
    public void ARefusedFigureNoLongerTakesItsUnitDownWithIt(string text, string want) =>
        Assert.Equal(want, NT(text));

    /**
     * ⚠ `ReadDigits` ITERATES CODE UNITS, NOT CODE POINTS — the TS spells it `digits.split("")`, which
     * splits an astral pair into its two halves, and each half is then spaced out on its own.
     *
     * ⚠ AND THE STRINGS ARE BUILT IN THE BODY, NOT PASSED AS `InlineData`. xUnit serializes theory
     * arguments and a LONE SURROGATE does not survive that round trip — it returns as U+FFFD, so the rows
     * silently stop testing what they claim while still reporting green.
     */
    [Fact]
    public void ReadDigitsIteratesCodeUnitsNotCodePoints()
    {
        const string hi = "\ud83d", lo = "\ude00";
        Assert.Equal($"vienas {hi} {lo} du", LtNumbers.ReadDigits($"1{hi}{lo}2"));
        Assert.Equal($"{hi} {lo}", LtNumbers.ReadDigits($"{hi}{lo}"));
        Assert.Equal("a b c", LtNumbers.ReadDigits("abc"));
        Assert.Equal("", LtNumbers.ReadDigits(""));
    }

    /** ⚠ A LONE SURROGATE MUST NOT THROW — the g2p tokenizer indexes CODE UNITS, so a stranded half is
     *  offered to the tables on its own and simply declines. Built in the body for the reason above. */
    [Fact]
    public void ALoneSurrogateDoesNotThrow()
    {
        const string hi = "\ud83d";
        Assert.Equal("", Word(hi));
        Assert.Equal("ɐ", Word($"a{hi}"));
        Assert.Equal("ɐb", Word($"a{hi}b"));
    }

    /** The magnitude table's `keepOne` split: 1000 is the bare noun, 1 000 000 keeps its numeral. */
    [Theory]
    [InlineData(1000, "tūkstantis")]
    [InlineData(2000, "du tūkstančiai")]
    [InlineData(1000000, "vienas milijonas")]
    [InlineData(1000000000, "vienas milijardas")]
    [InlineData(0, "nulis")]
    [InlineData(11, "vienuolika")]
    [InlineData(21, "dvidešimt vienas")]
    public void TheNumberTable(double n, string want) => Assert.Equal(want, LtNumbers.NumberToWords(n));
}
