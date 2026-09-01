/**
 * The portable half of test/welsh.test.ts — Welsh / Cymraeg (cy), Northern-leaning canonical IPA. The core is
 * the highly-phonemic g2p (digraphs ch→χ dd→ð ll→ɬ rh→r̥ th→θ, diphthongs with a superscript offglide) +
 * PENULTIMATE stress + the vowel-length rule (long in a monosyllable open/before a single voiced coda; a
 * penult keeps its short LAX quality). The y-vowel: obscure ə (non-final) vs clear ɨ (final syllable).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Welsh;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class WelshTests
{
    private static string Word(string s) => WelshPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "cy").Trim();
    private static string Norm(string s) => Normalize.NormalizeWelsh(s);

    [Theory]
    [InlineData("chwech", "χwˈeːχ")]      // ch → χ
    [InlineData("oedd", "ˈoːᶤð")]         // dd → ð
    [InlineData("llaw", "ɬˈaːᶷ")]         // ll → ɬ (voiceless lateral)
    [InlineData("rhaid", "r̥ˈaᶦd")]        // rh → r̥ (voiceless r)
    [InlineData("traeth", "trˈaːᶤθ")]     // th → θ
    [InlineData("gwlad", "ɡwlˈaːd")]      // c/g always hard; gw- onset w stays consonant
    public void ConsonantDigraphsAndAlwaysHardCg(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("gwaith", "ɡwˈaᶦθ")]          // ai → aᶦ
    [InlineData("traeth", "trˈaːᶤθ")]        // ae → aᶤ
    [InlineData("mewn", "mˈɛᶷn")]            // ew → ɛᶷ (short; referee: mɛun)
    [InlineData("llaw", "ɬˈaːᶷ")]            // aw → aᶷ
    [InlineData("oedd", "ˈoːᶤð")]            // oe → ɔᶤ
    [InlineData("eglwys", "ˈɛɡlʊᶤs")]        // wy diphthong → ʊᶤ (referee: ɛɡlʊɨs)
    [InlineData("cymdeithas", "kəmdˈeᶦθas")] // ei → eᶦ (referee-backed)
    public void DiphthongsCarryASuperscriptOffglide(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("cymru", "kˈəmrɨ")]      // 1st y (non-final) → ə, u → ɨ
    [InlineData("ysgol", "ˈəsɡɔl")]      // obscure y → ə
    [InlineData("blwyddyn", "blˈʊᶤðɨn")] // wy → ʊᶤ; final y → clear ɨ (referee: blʊɨðɨn)
    [InlineData("lladin", "ɬˈadin")]     // unstressed i stays FRONT (referee-backed; N Welsh centralizes only u/y)
    [InlineData("dim", "dˈɪm")]          // stressed short i stays front (referee: dɪm, not the oracle ɨ)
    [InlineData("dinas", "dˈɪnas")]      // stressed short i in an OPEN syllable stays front
    public void TheYVowelObscureVersusClear(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("cymru", "kˈəmrɨ")]           // penult
    [InlineData("prifysgol", "privˈəsɡɔl")]   // penult (3 syllables, no secondary)
    [InlineData("gorffennaf", "ɡɔrfˈɛnav")]   // nn degeminates → n (referee: ɡɔrfɛna); penult
    [InlineData("llywodraeth", "ɬəwˈɔdraᶤθ")] // penult
    public void PenultimateStress(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("mis", "mˈiːs")]        // long before s
    [InlineData("tad", "tˈaːd")]        // long before d
    [InlineData("nos", "nˈoːs")]        // long before s
    [InlineData("braf", "brˈaːv")]     // long before f→v
    [InlineData("nesaf", "nˈɛsav")]     // penult stays LAX ɛ (referee-backed)
    [InlineData("pobol", "pˈɔbɔl")]     // penult stays LAX ɔ (referee: pɔbɔl)
    [InlineData("bore", "bˈɔrɛ")]       // lax ɔ before r (a deferred n/r/l lengthener)
    [InlineData("papur", "pˈapɨr")]     // lax a before p (voiceless)
    public void VowelLength(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("nhw", "n̥ˈuː")]            // word-initial nh → n̥ (nasal mutation)
    [InlineData("nghymru", "ŋ̥ˈəmrɨ")]      // ngh → ŋ̥
    [InlineData("enghraifft", "ˈɛŋ̊raᶦfd")] // MEDIAL ngh is ŋ+h, not the mutation
    [InlineData("dechrau", "dˈɛχra")]      // NW final unstressed -au → [a] (referee: dɛχra)
    [InlineData("i", "ˈiː")]               // the word ⟨i⟩ → front iː (referee-backed; an oracle ɨ here is an artifact)
    [InlineData("bod", "bˈɔd")]            // irregular: short ɔ, not the regular oː
    [InlineData("heb", "hˈɛb")]            // irregular: lax ɛ
    [InlineData("un", "ˈɨːn")]             // irregular: long ɨː before n
    [InlineData("o'r", "ˈoːr")]            // enclitic: stem ⟨o⟩ stays open (oː) + r
    [InlineData("hi'n", "hˈiːn")]          // enclitic: stem ⟨hi⟩ open (hiː) + n
    public void NasalMutationIrregularWordsAndEnclitics(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("wal", "wˈal")]          // word-initial w + vowel → consonant /w/ (not vowel ʊ)
    [InlineData("teithio", "tˈeᶦθjɔ")]   // ei → eᶦ (referee-backed); i+vowel → /j/
    [InlineData("bara", "bˈara")]        // plain
    public void WIAsConsonantsBeforeAVowel(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void TheNfedOrdinalReadsTheVigesimalForm()
    {
        // table
        Assert.Equal("seithfed", Norm("7fed"));
        Assert.Equal("chweched", Norm("6ed"));
        Assert.Equal("cyntaf", Norm("1af"));
        // the 20s composition: 37 = 17 on 20
        Assert.Equal("ail ar bymtheg ar hugain", Norm("37fed"));
        Assert.Equal("ˈaᶦl ˈar bˈəmθɛɡ ˈar hˈɪɡaᶦn", Say("37fed"));
        // the round tens, and the corpus's only >100 ordinal
        Assert.Equal("trigainfed", Norm("60fed"));
        Assert.Equal("degfed a naw ugain", Norm("190fed"));
        Assert.Equal("milfed", Norm("1,000fed"));
    }

    [Fact]
    public void CommaThousandsStayGroupedAndTheDotIsADecimal()
    {
        Assert.Equal("mˈiːl pˈɛdwar kˈant ˈoː bˈɔbl", Say("1,400 o bobl"));
        Assert.Equal("pˈɛdwar kˈant mˈiːl", Say("400,000"));
        Assert.Equal("dˈaᶤ pˈuːᶤnt pˈɛdwar ɡiɡˈahɛrtz", Say("2.4Ghz"));
        Assert.Equal("ˈɨːn pˈuːᶤnt pˈɨmp mˈɪljʊn", Say("1.5 miliwn"));
        Assert.Equal("ˈuːᶤθ kˈant dˈaᶤ pˈuːᶤnt ˈɨːn ˈɨːn n", Say("802.11n")); // version letter spelled
        Assert.Equal("ˈɨːn pˈuːᶤnt dˈaᶤ trˈiː pˈɛdwar", Say("1.234")); // digit-by-digit fraction
        // a comma-decimal (European notation, corpus-absent) reads pwynt, not a comma pause
        Assert.Equal("ˈɨːn dˈeːɡ dˈaᶤ pˈuːᶤnt pˈɨmp", Say("12,5"));
        // but a 3-digit comma group stays thousands
        Assert.Equal("mˈiːl pˈɛdwar kˈant", Say("1,400"));
    }

    [Fact]
    public void AClocksAmMarkerNeedsABoundaryAndTheTwentyOrdinalExists()
    {
        Assert.Equal("un deg un amser", Norm("11:00 amser")); // was *un deg un y bore ser*
        Assert.Equal("deg y bore", Norm("10:00am")); // the glued undotted form still reads
        Assert.Equal("saith un deg naw y bore", Norm("07:19 a.m."));
        Assert.Equal("ugeinfed", Normalize.OrdinalWords(20)); // the branch boundary: `low` is 0 in the 21-39 arm
    }

    [Fact]
    public void RangesAndScoresReadWithIAndALeadingMinusStaysMinws()
    {
        Assert.Equal("χwˈeːχ ˈiː χwˈeːχ", Say("6-6"));
        // `i` MUTATES what follows it: mil → fil, tri → dri, dau → ddau. chwech does not mutate (ch).
        Assert.Equal(
            "mˈiːl ˈuːᶤθ kˈant nˈaːᶷ dˈeːɡ pˈɛdwar ˈiː vˈiːl ˈuːᶤθ kˈant nˈaːᶷ dˈeːɡ pˈɨmp",
            Say("1894-1895"));
        Assert.Equal("pˈɨmp ˈiː drˈiː washˈiŋtɔn", Say("5-3 Washington"));
        Assert.Equal("kˈant ˈiː ðˈaᶤ ɡˈant mˈiɬtir", Say("100-200 milltir"));
        Assert.Equal("dˈaᶤ ˈiː drˈiː kilˈɔmɛtr ˈoː jˈaː", Say("2-3 km o iâ")); // the unit survives the rewrite
        Assert.Equal("chwech", Normalize.Soften("chwech")); // the digraph does not mutate
        Assert.Equal("lath", Normalize.Soften("llath"));
        // the operand must END in a digit: `[\d,]*` also matches a trailing CLAUSE comma, and re-emitting
        // the operand as words then ate it — the corpus's `ers 1995-96, pan …` lost its pause.
        Assert.Equal("ers 1995 i naw deg chwech, pan gyrhaeddodd", Norm("ers 1995-96, pan gyrhaeddodd"));
        Assert.Equal("1,400 i fil pum cant o bobl", Norm("1,400-1,500 o bobl"));
        Assert.Equal("dˈeːɡ ˈiː ˈɨːn dˈeːɡ ˈɨːn ˈər hˈuːᶤr", Say("10:00-11:00 yr hwyr"));
        Assert.Equal("mˈinʊs pˈɨmp ɡrˈaːð", Say("-5 gradd"));
    }

    [Fact]
    public void ClocksReadHourMinuteWithPmAmAsYPrinhawnYBore()
    {
        Assert.Equal("ˈɨːn dˈeːɡ ˈɨːn trˈiː dˈeːɡ pˈɨmp ˈə prˈənhaᶷn", Say("11:35 p.m."));
        Assert.Equal("sˈaᶦθ ˈɨːn dˈeːɡ nˈaːᶷ ˈə bˈɔrɛ", Say("07:19 a.m."));
        Assert.Equal("ˈɨːn dˈeːɡ pˈɨmp ˈɨː tˈiː ˈɛk", Say("15.00 UTC"));
    }

    [Fact]
    public void EraMarkersExpandDecadesDropTheAuAndFractionsUseTheNounOrdinal()
    {
        Assert.Equal("pˈɛdwar kˈant ˈoːᶤd krˈist", Say("400 O.C."));
        Assert.Equal("mˈiːl kˈɨn krˈist", Say("1000 C.C."));
        Assert.Equal("mˈiːl nˈaːᶷ kˈant sˈaᶦθ dˈeːɡ", Say("1970au"));
        Assert.Equal("ˈɨːn pˈɨmɛd mˈɔdvɛð", Say("1/5 modfedd")); // un pumed
        // 3 and 4 are NOUNS (traean/chwarter), not the ordinals trydydd/pedwerydd.
        Assert.Equal("dˈaᶤ trˈeᶤan", Say("2/3")); // dau draean
        Assert.Equal("trˈiː χwˈartar", Say("3/4")); // tri chwarter
    }

    [Fact]
    public void TheClockRangeHyphenIsIAndPmAmDoNotGlueTheFollowingWord()
    {
        Assert.Equal("dˈeːɡ ˈiː ˈɨːn dˈeːɡ ˈɨːn ˈər hˈuːᶤr", Say("10:00-11:00 yr hwyr"));
        Assert.Equal("ˈuːᶤθ trˈiː dˈeːɡ ˈə prˈənhaᶷn ˈamsar", Say("8:30 p.m. amser"));
    }

    [Fact]
    public void RatesUnitsAndDegreesReadTheirWelshWords()
    {
        Assert.Equal("pˈɛdwar kˈant ˈuːᶤθ dˈeːɡ kilˈɔmɛdr ˈər ˈaᶷr", Say("480 cilomedr/awr"));
        Assert.Equal("kˈant ɬˈaːθ nˈeᶤ vˈɛtr", Say("100 llath/metr"));
        Assert.Equal("pˈɛdaᶦr mˈiːl ˈuːᶤθ kˈant nˈaːᶷ dˈeːɡ dˈaᶤ mˈɛtr", Say("4892 m"));
        Assert.Equal("plˈuːs trˈiː dˈeːɡ ɡrˈaːð kˈɛlʃɨs", Say("+30°C"));
    }

    [Fact]
    public void CurrencyPrefixesAbbreviationsAndInitialismsReadTheirWordsOrLetters()
    {
        Assert.Equal("dˈɔlɛr aᶷstrˈalja pˈɛdwar dˈeːɡ pˈɨmp mˈɪljʊn", Say("AUD$45 miliwn"));
        Assert.Equal("dˈɔlɛr ˈər ˈɨnɔl dalˈeᶦθja ˈɨːn dˈeːɡ ˈɨːn mˈiːl", Say("US$11,000"));
        Assert.Equal("ˈə dˈeᶤrnas ɨnˈɛdɪɡ", Say("y DU")); // the UK, not "du"
        Assert.Equal("ˈə mˈoːr dˈɨː", Say("y Môr Du")); // the Black Sea keeps "du"
        Assert.Equal("ˈak ˈən ˈə blˈaːᶤn .", Say("ayb.")); // ac yn y blaen
        Assert.Equal("ɡɛˈɔrɡɛ ˈuː bˈɨsh", Say("George W. Bush"));
        Assert.Equal("ˈɛn ˈaᶦtsh ˈɛk", Say("NHK")); // en aitsh ec
        Assert.Equal("ˈɨː ˈɛk ˈɛl ˈa", Say("UCLA"));
    }

    /** `cilomedr`, NOT `cilometr` — the corpus writes `cilomedr` and the corpus's own squared reading is
     *  `cilomedr sgwâr`, so the head noun has to be that word or the tier composes half an attested
     *  collocation. */
    [Fact]
    public void TheUnitNounIsTheCorpussSpelling()
    {
        Assert.Contains("kilˈɔmɛdr", Say("5 km"));
        Assert.Contains("kilˈɔmɛdr sɡwˈaːr", Say("5 km²")); // = the corpus's own phrase
        Assert.Contains("mˈɛtr", Say("5 m"));               // the FREE word is metr
    }

    /** ⚠ THE RANGE/SORE RULE'S RIGHT GUARD REJECTS A DIGIT AND A DOT-BEFORE-A-DIGIT, NOT A BARE DOT — a
     *  bare-dot guard suppressed exactly the reading this rule exists to produce (the `i` joiner and its
     *  soft mutation). */
    [Fact]
    public void AScoreThatEndsTheSentenceIsStillAScore()
    {
        Assert.Equal("χwˈeːχ ˈiː χwˈeːχ .", Say("6-6."));
        Assert.Equal("sˈaᶦθ ˈiː ðˈaᶤ .", Say("7-2.")); // dau → ddau, the soft mutation
        Assert.Equal("pˈɨmp ˈiː drˈiː", Say("5-3")); // unchanged without the stop
    }

    [Fact]
    public void ADecimalRightOperandIsStillDeclined()
    {
        // ⚠ TESTED AS A TOKEN, NOT A SUBSTRING — `trˈiː` ("three") contains `ˈiː`, so a substring check
        // passes or fails for the wrong reason. `5-3.5` correctly reads *pump tri pwynt pump* with no
        // joiner between the operands.
        Assert.DoesNotContain("ˈiː", Say("5-3.5").Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    [Fact]
    public void ATimezoneOffsetHyphenIsASignNotAWordHyphen()
    {
        // The clock rule turns the digits into WORDS, after which the hyphen sits between two letter runs —
        // indistinguishable from a compound joint — and the g2p strips it and fuses them.
        var glued = Phonemizer.Phonemize("mae'r amser yn GMT-00:43 heddiw", "cy");
        Assert.Contains("tˈiː dˈɪm", glued);
        Assert.Equal(Phonemizer.Phonemize("mae'r amser yn GMT -00:43 heddiw", "cy"), glued);
        // a real corpus shape, and the plain offset is unaffected
        Assert.Contains("tˈiː", Phonemizer.Phonemize("mae'r amser yn UTC-08:00 heddiw", "cy"));
        Assert.Contains("tˈiː", Phonemizer.Phonemize("mae'r amser yn GMT-5 heddiw", "cy"));
    }

    [Fact]
    public void RegistryWiring() => Assert.Equal("χwˈeːχ", Phonemizer.Phonemize("chwech", "cy").Trim());
}
