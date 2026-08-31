/**
 * The portable half of test/irish.test.ts — Irish Gaelic (ga), Standard/Connacht-leaning. The defining axis
 * is BROAD (velarized ˠ, next to a/o/u) vs SLENDER (palatalized ʲ, next to e/i), determined by the flanking
 * vowel LETTERS ("caol le caol"); slender velars are the palatal stops c/ɟ and slender ⟨s⟩ is ʃ. First-
 * syllable stress, marked even on monosyllables; unstressed short vowels reduce to ə.
 *
 * Every expected value here is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Irish;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class IrishTests
{
    private static string Word(string s) => IrishPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "ga").Trim();
    private static string Norm(string s) => Normalize.NormalizeIrish(s);

    [Theory]
    // Broad consonants: velarized ˠ, and the DENTAL l̪ˠ/n̪ˠ/d̪ˠ/t̪ˠ.
    [InlineData("mór", "mˠˈoːɾˠ")]
    [InlineData("cat", "kˈat̪ˠ")]           // broad k (velar), dental broad t
    [InlineData("madra", "mˠˈad̪ˠɾˠə")]     // final a → ə (unstressed reduction)
    [InlineData("lá", "l̪ˠˈɑː")]            // dark dental broad l
    [InlineData("carr", "kˈaɾˠ")]           // rr → a single broad ɾˠ
    [InlineData("focal", "fˠˈɔkəl̪ˠ")]
    public void BroadConsonants(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Slender consonants: palatalized ʲ; velars → the palatal c/ɟ; ⟨s⟩ → ʃ.
    [InlineData("bí", "bʲˈiː")]
    [InlineData("fir", "fʲˈɪɾʲ")]
    [InlineData("tír", "tʲˈiːɾʲ")]
    [InlineData("teach", "tʲˈax")]          // slender t → tʲ, ch → x (broad)
    [InlineData("súil", "sˠˈuːlʲ")]
    [InlineData("duine", "d̪ˠˈɪnʲə")]
    public void SlenderConsonants(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Both qualities in one word, and the word-initial ⟨r⟩ that is broad whatever follows it.
    [InlineData("fear", "fʲˈaɾˠ")]          // slender f (e), broad r (a)
    [InlineData("bean", "bʲˈan̪ˠ")]
    [InlineData("rí", "ɾˠˈiː")]             // word-initial r broad even before i
    [InlineData("baile", "bˠˈalʲə")]
    public void CaolLeCaol(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Lenition (séimhiú) and the silent -dh/-gh endings.
    [InlineData("bhí", "vʲˈiː")]            // bh → vʲ (slender)
    [InlineData("oíche", "ˈiːçə")]          // ch → ç (slender)
    [InlineData("deoch", "dʲˈɔx")]          // the lexicon pins the semi-lexical eo split
    [InlineData("chéadaigh", "çˈeːd̪ˠə")]   // ch→ç, final -aigh: gh silent, ai→ə
    [InlineData("airigh", "ˈaɾʲə")]
    public void LenitionAndSilentEndings(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Eclipsis (urú), the s-cluster's broad ⟨s⟩, coda quality, native ⟨ng⟩ → ŋ, and ⟨oi⟩ → ɔ.
    [InlineData("gcat", "ɡˈat̪ˠ")]          // eclipsis gc → ɡ (c silent)
    [InlineData("mbád", "mˠˈɑːd̪ˠ")]        // mb → mˠ
    [InlineData("ngaeilge", "ŋˈeːəlʲɟə")]   // ng → ŋ; unstressed i reduces to ə (referee-backed)
    [InlineData("bhfuil", "wˈɪlʲ")]         // bhf → w (f silent)
    [InlineData("spéir", "sˠpʲˈeːɾʲ")]      // ⟨s⟩ stays BROAD in the cluster; only p palatalizes
    [InlineData("ainm", "ˈanʲmˠ")]          // final m broad (no adjacent slender vowel)
    [InlineData("long", "l̪ˠˈɔŋ")]          // native ng → ŋ, the final ɡ absorbed
    [InlineData("scoil", "sˠkˈɔlʲ")]        // oi → ɔ (not ɛ)
    public void EclipsisClustersAndNasalAssimilation(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // The i-offglide (long back V + slender consonant) and svarabhakti epenthesis.
    [InlineData("áit", "ˈɑːⁱtʲ")]           // ɑː + slender coda t → i-offglide
    [InlineData("cóir", "kˈoːⁱɾʲ")]
    [InlineData("súil", "sˠˈuːlʲ")]         // uː gets NO offglide
    [InlineData("baile", "bˠˈalʲə")]        // pre-vocalic slender l → no offglide
    [InlineData("gorm", "ɡˈɔɾˠəmˠ")]        // r + coda m → epenthetic ə
    [InlineData("bolg", "bˠˈɔl̪ˠəɡ")]       // l + coda ɡ → ə
    [InlineData("gairm", "ɡˈaɾʲəmˠ")]       // r-epenthesis; short a → no offglide
    [InlineData("ainm", "ˈanʲmˠ")]          // ⚠ /n/ does NOT trigger epenthesis
    public void OffglideAndSvarabhakti(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // The ia/ua diphthongs, the offglide before a slender ONSET, ⟨eo⟩'s built-in glide, lexicon overrides.
    [InlineData("iad", "ˈiəd̪ˠ")]           // ia → iə (short first element; referee-confirmed)
    [InlineData("ciall", "cˈiəl̪ˠ")]
    [InlineData("nuair", "n̪ˠˈuəɾʲ")]       // ua → uə
    [InlineData("áirithe", "ˈɑːⁱɾʲəhə")]    // offglide before a slender ONSET, not just a coda
    [InlineData("ceoil", "cˈoːlʲ")]         // ⟨eo⟩ carries its glide → no i-offglide
    [InlineData("féidir", "fʲˈeːdʲəɾʲ")]    // unstressed i reduces to ə (referee), NOT the oracle's ɪ
    public void DiphthongsAndLexicon(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("bó", "bˠˈoː")]
    [InlineData("fada", "fˠˈad̪ˠə")]
    [InlineData("cara", "kˈaɾˠə")]
    [InlineData("obair", "ˈɔbˠəɾʲ")]        // stress the first syllable; the 2nd (ai) → ə
    public void FadaAndFirstSyllableStress(string word, string want) => Assert.Equal(want, Word(word));

    // ── NUMBERS ──────────────────────────────────────────────────────────────────────────────────────
    // Two numeral series (counting ceathair vs attributive ceithre), the `a` particle, the h-prefix on the
    // vowel-initial counting forms, and initial mutation of the magnitude word (2–6 lenite, 7–10 eclipse).

    [Theory]
    [InlineData(0, "náid")]                         // a bare zero takes no particle
    [InlineData(1, "a haon")]                       // h-prefix on the vowel-initial counting form
    [InlineData(4, "a ceathair")]                   // the COUNTING series (not attributive ceithre)
    [InlineData(8, "a hocht")]
    [InlineData(11, "a haon déag")]
    [InlineData(12, "a dó dhéag")]                  // déag lenites after dó ONLY
    [InlineData(13, "a trí déag")]
    [InlineData(20, "fiche")]
    [InlineData(25, "fiche a cúig")]
    [InlineData(40, "daichead")]
    [InlineData(98, "nócha a hocht")]
    [InlineData(100, "céad")]                       // bare magnitude — no "aon"
    [InlineData(101, "céad a haon")]
    [InlineData(200, "dhá chéad")]                  // 2–6 LENITE: céad → chéad
    [InlineData(400, "ceithre chéad")]              // the ATTRIBUTIVE series before a magnitude
    [InlineData(700, "seacht gcéad")]               // 7–10 ECLIPSE: céad → gcéad
    [InlineData(1000, "míle")]
    [InlineData(2000, "dhá mhíle")]
    [InlineData(7000, "seacht míle")]               // ⟨m⟩ has no eclipsed form → bare
    [InlineData(1998, "míle naoi gcéad nócha a hocht")]
    [InlineData(999999, "naoi gcéad nócha a naoi míle naoi gcéad nócha a naoi")] // a 3-digit magnitude count
    public void NumberToWords(double n, string want) => Assert.Equal(want, Numbers.NumberToWords(n));

    /** No digit-by-digit fallback and no gaps across 0…20,000 — the TS test, walked identically. */
    [Fact]
    public void EveryNumberBelowTwentyThousandComposes()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var w = Numbers.NumberToWords(n);
            Assert.DoesNotContain("undefined", w, StringComparison.Ordinal);
            Assert.DoesNotContain("NaN", w, StringComparison.Ordinal);
            Assert.False(w.Any(char.IsAsciiDigit), $"n={n} → {w}");
        }
    }

    [Fact]
    public void TheNumeralIsPhonemizedNotSpelledDigitwise()
    {
        Assert.Equal("fʲˈɪçə ˈa kˈuːɟ", Say("25"));        // fiche a cúig
        Assert.Contains("ɟˈeːd̪ˠ", Say("1998"));           // gcéad — the ECLIPSED hundred
    }

    // ── TEXT NORMALIZATION ───────────────────────────────────────────────────────────────────────────

    [Fact]
    public void TheNuOrdinalReadsTheIrishOrdinalWord()
    {
        // NO ARTICLE from the layer: 27 of the corpus's 36 `Nú` instances already carry one, and a table
        // carrying "an" read them twice. The NOUN goes inside a compound ("an naoú haois déag").
        Assert.Equal("cúigiú déag", Norm("15ú"));
        Assert.Equal("an cúigiú haois déag", Norm("an 15ú haois"));
        Assert.Equal("sa deichiú haois", Norm("sa 10ú haois"));
        Assert.Equal("an seachtú tír is tríocha", Norm("an 37ú tír"));
        Assert.Equal("an céad nóchadú áit", Norm("an 190ú áit"));
        Assert.Equal("an t-ochtú lá", Norm("an 8ú lá"));   // the t- prefix after a bare "an"
        Assert.Equal("aonú déag", Normalize.OrdinalWords(11)); // eleven is aonú, never chéad
        Assert.Equal("ochtú déag", Norm("18ú"));
        Assert.Equal("fichiú", Norm("20ú"));
        Assert.Equal("ʃˈaxt̪ˠuː", Say("7ú"));               // seachtú
        Assert.Equal("cˈeːd̪ˠ n̪ˠˈoːxəd̪ˠuː", Say("190ú")); // céad nóchadú, the article left to the text
    }

    [Fact]
    public void CommaThousandsStayGroupedAndTheDotIsADecimal()
    {
        Assert.Equal("mʲˈiːlʲə cˈɛhɾʲə çˈeːd̪ˠ", Say("1,400"));
        Assert.Equal("cˈɛhɾʲə çˈeːd̪ˠ mʲˈiːlʲə", Say("400,000"));
        Assert.Equal("ˈa hˈeːn̪ˠ pˠˈɔnʲtʲə ˈa kˈuːɟ mʲˈɪlʲən̪ˠ", Say("1.5 million"));
        Assert.Equal("ˈa d̪ˠˈoː jˈeːɡ pˠˈɔnʲtʲə ˈa hˈɔxt̪ˠ cˈɪlʲəmʲeːd̪ˠəɾˠ", Say("12.8 km"));
        // trap pins: the haon-ending compound ordinal (21ú) and the decimal-percent (3.5%)
        Assert.Equal("ˈeːn̪ˠuː ˈɪʃ fʲˈɪçə", Say("21ú"));   // aonú is fiche — the unit first, the tens last
        Assert.Equal("ˈa tʲɾʲˈiː pˠˈɔnʲtʲə ˈa kˈuːɟ fˠˈiːnʲ ɟˈeːd̪ˠ", Say("3.5%")); // faoin gcéad after it
    }

    [Theory]
    [InlineData("11:35 i.n.", "ˈa hˈeːn̪ˠ dʲˈeːɡ tʲɾʲˈiːxə ˈa kˈuːɟ ˈiəɾˠn̪ˠoːⁱnʲ")]
    [InlineData("8:30 p.m.", "ˈa hˈɔxt̪ˠ tʲɾʲˈiːxə ˈiəɾˠn̪ˠoːⁱnʲ")]
    [InlineData("1:15 r.n.", "ˈa hˈeːn̪ˠ ˈa kˈuːɟ dʲˈeːɡ ɾˠˈeːwn̪ˠoːⁱnʲ")]
    public void ClocksReadHourMinuteWithIarnoinAndReamhnoin(string text, string want) =>
        Assert.Equal(want, Say(text));

    [Theory]
    [InlineData("400 A.D.", "cˈɛhɾʲə çˈeːd̪ˠ t̪ˠˈaɾˠ ˈeːʃ çɾʲˈiːsˠt̪ˠ")]   // tar éis Chríost
    [InlineData("1000 R.C.", "mʲˈiːlʲə ɾˠˈɪvʲ çɾʲˈiːsˠt̪ˠ")]              // roimh Chríost
    [InlineData("35-40 msu", "tʲɾʲˈiːxə ˈa kˈuːɟ ɡˈɔ dʲˈiː d̪ˠˈaçəd̪ˠ mʲˈiːlʲə sˠˈan̪ˠ ˈuəɾʲ")]
    [InlineData("160km/h", "cˈeːd̪ˠ ʃˈasˠkə cˈɪlʲəmʲeːd̪ˠəɾˠ sˠˈan̪ˠ ˈuəɾʲ")]
    public void ErasRangesAndRates(string text, string want) => Assert.Equal(want, Say(text));

    [Theory]
    [InlineData("30°C", "tʲɾʲˈiːxə cˈeːmʲ cˈɛlʲʃʊsˠ")]
    [InlineData("35°W", "tʲɾʲˈiːxə ˈa kˈuːɟ cˈeːmʲ ʃˈiəɾˠ")]            // céim siar — a longitude
    [InlineData("1/5 orlach", "ˈan̪ˠ kˈuːɟuː ˈɔɾˠl̪ˠəx")]               // an cúigiú orlach
    [InlineData("B&Banna", "bʲˈeː ˈaɡəsˠ bʲˈeːn̪ˠə")]                   // bé agus béanna
    [InlineData("US$14.7", "d̪ˠˈɔl̪ˠəɾˠ n̪ˠˈə sˠt̪ˠˈɑːt̪ˠ ˈeːn̪ˠt̪ˠəhə ˈa cˈahəɾʲ dʲˈeːɡ pˠˈɔnʲtʲə ˈa ʃˈaxt̪ˠ")]
    public void DegreesFractionsAmpersandAndCurrency(string text, string want) => Assert.Equal(want, Say(text));

    [Theory]
    [InlineData("S.A.", "sˠt̪ˠˈɑːⁱtʲ ˈeːn̪ˠt̪ˠəhə")]                     // Stáit Aontaithe
    [InlineData("N.A.", "n̪ˠˈɑːⁱʃuːənʲ ˈeːn̪ˠt̪ˠəhə")]                   // Náisiúin Aontaithe
    [InlineData("H5N1", "hˈeːʃ ˈa kˈuːɟ ˈɛnʲ ˈa hˈeːn̪ˠ")]               // héis a cúig ein a haon
    public void InitialismsExpandOrLetterSpell(string text, string want) => Assert.Equal(want, Say(text));

    /** Bare `m` had to be declared for the cube to have a head noun at all, and every digit-adjacent `m`
     *  in this corpus is a metre — the one-letter-key hazard checked rather than assumed. */
    [Fact]
    public void TheSquaredCubedMeasureWord()
    {
        Assert.Contains("mʲˈeːd̪ˠəɾˠ cˈuːbˠəx", Say("120 m³"));
        Assert.Contains("mʲˈeːd̪ˠəɾˠ ˈaɡəsˠ", Say("100m agus 200m"));
    }

    /** `srl.` is *agus araile*; FLEURS strips the dot, so both spellings must reach it. */
    [Theory]
    [InlineData("iompar ar thalamh srl")]
    [InlineData("iompar ar thalamh, srl.")]
    public void SrlIsAgusAraile(string text) => Assert.Contains("ˈaɡəsˠ əɾˠˈalʲə", Say(text));

    /** ⚠ A COMMA BEFORE A MINUS IS NOT A RANGE. Each range operand must END on a digit, or in `1, -2` the
     *  left operand matches `1,` — the sentence comma — and a RANGE is read where the text has a negative. */
    [Fact]
    public void ACommaBeforeAMinusIsNotARange()
    {
        Assert.DoesNotContain("ɡˈɔ dʲˈiː", Say("1, -2"));
        Assert.Contains("ɡˈɔ dʲˈiː", Say("1-2"));
        Assert.Contains("ɡˈɔ dʲˈiː", Say("1,234-5,678"));
    }

    /** ⚠ A TIMEZONE-OFFSET HYPHEN IS A SIGN, NOT A WORD HYPHEN. The clock rule turns the digits into WORDS,
     *  after which the hyphen sits between two letter runs — indistinguishable from a compound joint — and
     *  the g2p strips it and fuses them. Settled before the clock rule, since the initialism pass runs last. */
    [Fact]
    public void ATimezoneOffsetHyphenDoesNotFuseTheInitialismIntoTheClock()
    {
        var glued = Say("mae'r amser yn GMT-00:43 heddiw");
        Assert.Contains("tʲˈeː n̪ˠˈɑːⁱdʲ", glued);
        Assert.Equal(Say("mae'r amser yn GMT -00:43 heddiw"), glued);
        Assert.Contains("tʲˈeː", Say("mae'r amser yn UTC-08:00 heddiw"));
        Assert.Contains("tʲˈeː", Say("mae'r amser yn GMT-5 heddiw"));
    }

    /**
     * ⚠ THE DECIMAL-UNIT MISS BRANCH IS REACHABLE, and before the fix the TypeScript spoke the word
     * "undefined". The alternation is built from the unit table's own keys but the pattern carries `i`+`u`,
     * so JS's fold widens it — `ſ`→`s` reaches `msu` — and a near-miss matches while `mſu` is absent from
     * the table. Measured before the fix: `1.5 mſu` normalized to *1 pointe a cúig undefined*. Both engines
     * now refuse the whole match, as gl/#1122 does.
     */
    [Theory]
    [InlineData("1.5 msu", "1 pointe a cúig míle san uair")]
    [InlineData("1.5 mſu", "1 pointe a cúig mſu")]
    public void ADecimalUnitNearMissIsRefusedNotSpokenAsUndefined(string text, string want) =>
        Assert.Equal(want, Norm(text));

    /**
     * #1197 — A DECIMAL OPERAND BEFORE A RATE IS REFUSED WHOLE. The rule used to claim the NUMERATOR and
     * leave the denominator raw: `12.8 km/u` read *12 pointe a hocht ciliméadar/u*, and the stranded `/u`
     * is then dropped by the g2p — a silently lost "per hour", strictly worse than the raw letters it
     * replaced.
     *
     * ⚠ AND `km\/u` WAS DELETED FROM THE ALTERNATION RATHER THAN REORDERED IN FRONT OF `km`. It could never
     * match — ordered alternation, `km` wins, and the old trailing guard was satisfied by the `/` — and
     * promoting it would have made the decimal rate readable, which the corpus does not ask for: over 4,480
     * ga texts decimal-plus-`km/u` and decimal-plus-`km/h` are each ×0, while the INTEGER forms (×7, ×9)
     * are step 10's and already read.
     *
     * ⚠ THE GLUED FORM MUST NOT FUSE. Declining the match outright looked right and was not: DECIMAL_PLAIN
     * then claimed `12.8` alone and emitted no trailing space, giving *12 pointe a hochtkm/u* — one token,
     * the merge defect. The unit is re-emitted raw AND SPACED.
     */
    [Theory]
    [InlineData("12.8 km/u", "12 pointe a hocht km/u")]
    [InlineData("12.8km/u", "12 pointe a hocht km/u")]
    [InlineData("1.5 km/h", "1 pointe a cúig km/h")]
    [InlineData("1.5 m/s", "1 pointe a cúig m/s")]
    // …and every non-rate reading is unchanged, with the INTEGER rate still read by step 10.
    [InlineData("12.8 km", "12 pointe a hocht ciliméadar")]
    [InlineData("12.8 msu", "12 pointe a hocht míle san uair")]
    [InlineData("160km/u", "céad seasca ciliméadar san uair")]
    [InlineData("70km/h", "seachtó ciliméadar san uair")]
    public void ADecimalRateIsRefusedWholeAndItsUnitIsSpaced(string text, string want) =>
        Assert.Equal(want, Norm(text));

    /** ⚠ The compass letter is upper-cased before the lookup, and `ſ` matches `[NSEW]` under `i`+`u`. JS
     *  `"ſ".toUpperCase()` is "S" and .NET's `ToUpperInvariant` agrees (measured, not assumed), so the fold
     *  resolves to the same word on both sides rather than missing the table. */
    [Theory]
    [InlineData("35°W", "35 céim siar")]
    [InlineData("35°ſ", "35 céim ó dheas")]
    public void TheCompassLetterFoldsToTheSameWordOnBothSides(string text, string want) =>
        Assert.Equal(want, Norm(text));

    [Fact]
    public void TheRegistryRoutesGaToIrish() => Assert.Equal("mˠˈoːɾˠ", Say("mór"));
}
