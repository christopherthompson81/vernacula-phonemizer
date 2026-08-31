/**
 * The portable half of test/tatar.test.ts — Standard Tatar (tt), Татар теле, Kipchak Turkic, CYRILLIC.
 * Signature: VOWEL-HARMONY backing of ⟨к г⟩ — [q]/[ʁ] next to a BACK vowel (ак→ɑq) but [k]/[ɡ] next to a
 * FRONT one (мәктәп→mæktæp); the special letters ⟨ә⟩→[æ], ⟨ө⟩→[ø], ⟨ү⟩→[y], ⟨ы⟩→[ɨ], ⟨җ⟩→[ʑ], ⟨ң⟩→[ŋ];
 * ⟨а⟩ fronts to [a] in a front-harmony word. Word-final (oxytone) stress.
 * Referee: THIN single-source (kaikki, 69) — validated on the native subset.
 *
 * ⚠ ROMAN NUMERALS ARE TESTED THROUGH `Phonemize`, NOT a constructed engine: Core/Roman.cs runs in the
 * Registry WRAPPING `Text()`, so a test on `CreateTatar()` never exercises the policy at all (trap 16).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Tatar;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TatarTests
{
    private static string Word(string s) => TatarPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "tt");
    private static string Norm(string s) => Normalize.NormalizeTatar(s);

    [Theory]
    // vowel-harmony backing of ⟨к г⟩: [q ʁ] (back) vs [k ɡ] (front).
    [InlineData("ак", "ˈɑq")]           // 'white' — BACK word: ⟨а⟩→ɑ, ⟨к⟩→q
    [InlineData("мәктәп", "mækˈtæp")]   // 'school' — FRONT word (⟨ә⟩): ⟨к⟩→k
    [InlineData("балык", "bɑˈlɨq")]     // 'fish' — BACK: ⟨ы⟩→ɨ, ⟨к⟩→q
    [InlineData("көз", "ˈkøz")]         // 'autumn' — FRONT: ⟨ө⟩→ø, ⟨к⟩→k
    public void HarmonyBackingOfKG(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // the special letters ⟨ә ө ү җ ң⟩ + iotated ⟨я⟩.
    [InlineData("дүшәмбе", "dyʃæmˈbe")] // 'Monday' — ⟨ү⟩→y, ⟨ә⟩→æ
    [InlineData("вөҗдан", "vøʑˈdan")]   // 'conscience' — ⟨ө⟩→ø, ⟨җ⟩→ʑ, ⟨а⟩→a (front word)
    [InlineData("якшәмбе", "jɑqʃæmˈbe")] // 'Sunday' — ⟨я⟩→jɑ, ⟨к⟩→q (local, next to я)
    [InlineData("шимбә", "ʃimˈbæ")]     // 'Saturday' — ⟨ә⟩→æ
    public void TheSpecialLetters(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // harmony of ⟨а⟩: back [ɑ] vs front-word [a].
    [InlineData("татар", "tɑˈtɑr")]     // 'Tatar' — BACK word: ⟨а⟩→ɑ
    [InlineData("ана", "ɑˈnɑ")]         // 'mother' — BACK
    [InlineData("китап", "kiˈtap")]     // 'book' — FRONT word (⟨и⟩): ⟨а⟩→a, ⟨к⟩→k
    public void HarmonyOfA(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨ч⟩→[ɕ] (Kazan deaffrication), ⟨г⟩ with neutral ⟨а⟩, initial ⟨е⟩→[je], loan-cluster stress.
    [InlineData("чәч", "ˈɕæɕ")]         // 'hair' — ⟨ч⟩ is the fricative [ɕ], like ⟨җ⟩→ʑ
    [InlineData("гаилә", "ɡaiˈlæ")]     // 'family' — front word: ⟨г⟩→ɡ (⟨а⟩ is harmony-neutral for backing)
    [InlineData("елга", "jelˈɡa")]      // 'river' — word-initial ⟨е⟩→[je]
    [InlineData("спорт", "ˈsport")]     // loan — ˈ before the whole ⟨sp⟩ onset (max-onset)
    public void DeaffricationIotationAndLoanStress(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // NUMBERS — the Turkic decimal with Tatar's FUSED teens.
    [InlineData("7", "ʑiˈde")]                                  // җиде — a bare unit
    [InlineData("11", "unˈber")]                                // унбер — ONE word (one stress domain)
    [InlineData("25", "jeɡerˈme ˈbiʃ")]                         // егерме биш — 21-99 stay TWO words
    [InlineData("100", "ˈjøz")]                                 // йөз — the multiplier "бер" is dropped
    [InlineData("555", "ˈbiʃ ˈjøz ilˈle ˈbiʃ")]
    [InlineData("1984", "ˈmeŋ tuˈʁɨz ˈjøz sikˈsæn ˈdyrt")]
    [InlineData("12345", "uniˈke ˈmeŋ ˈøɕ ˈjøz qɨˈrɨq ˈbiʃ")]   // fused teen as a thousands multiplier
    [InlineData("1000000", "ˈber milliˈon")]                    // бер миллион — the leading "бер" IS kept
    public void CardinalNumbers(string n, string want) => Assert.Equal(want, Say(n));

    [Fact]
    // THE ORDINAL SUFFIX IN ALL THREE ATTACHMENTS — the class this language is defined by.
    public void TheOrdinalSuffixInAllThreeAttachments()
    {
        // HYPHENATED, the shape Bashkir writes and the only one a ported ba rule would have caught.
        Assert.Equal("øɕenˈɕe", Say("3-нче"));                                        // өченче
        Assert.Equal("iˈke ˈmeŋ tuʁɨzɨnˈɕɨ jelˈdan", Say("2009-нчы елдан"));
        // The LONG form, with the linking vowel typed out.
        Assert.Equal("untuʁɨzɨnˈɕɨ ʁɑsɨrˈdɑ", Say("19-ынчы гасырда"));
        // SPACED — read before this layer as the bare fragment *нче*.
        Assert.Equal("ˈmeŋ tuˈʁɨz ˈjøz unʑidenˈɕe jelˈda", Say("1917 нче елда"));
        Assert.Equal("berenˈɕe prezidenˈtɨ", Say("1 нче президенты"));
        // GLUED, and carrying a GENITIVE past the ordinal's own tail — spliced on the overlap, not
        // matched with `EndsWith`, or *ике мең бишенче* + *нең* comes out doubled.
        Assert.Equal("iˈke ˈmeŋ biʃenɕeˈneŋ mɑrtɨnˈdɑ", Say("2005нченең мартында"));
    }

    [Fact]
    // the CASE suffix is a CLOSED SET — which is what makes the spaced attachment safe.
    public void TheCaseSuffixIsAClosedSet()
    {
        // A genuine case ending glues to the spelled cardinal: the writer already chose the allomorph.
        Assert.Equal("iˈke meŋˈɡæ jɑˈqɨn", Say("2000-гә якын"));
        // ⚠ AND A FIGURE NUMBER MUST SURVIVE — `рәс. 12.1а` is a chapter.figure reference with a Cyrillic
        // enumerator glued to it. An OPEN suffix alternation (ba's `SFX{1,5}`) would read every one as a
        // declined numeral.
        Assert.Equal("рәс. 12.1а", Norm("рәс. 12.1а"));
        Assert.Equal("(рәс. 12.2в, г)", Norm("(рәс. 12.2в, г)"));
        // Russian `-е` is excluded: this corpus carries Russian bibliography, and `4-е изд.` is not Tatar.
        Assert.Equal("4-е изд.", Norm("4-е изд."));
    }

    [Theory]
    // the ordinal is DERIVED, and ⚠ TATAR HAS NO LABIAL HARMONY WHERE BASHKIR DOES: ba rounds after
    // ⟨ө о⟩ (өс → өсөнсө), and porting that across gives *өчөнчө* and *йөзөнчө*.
    [InlineData(3, "өченче")]
    [InlineData(100, "йөзенче")]
    [InlineData(6, "алтынчы")]      // vowel-final back stem drops the linking vowel
    [InlineData(9, "тугызынчы")]
    // ⚠ ONE STEM LENITES — `кырык` → *кырыгынчы*, which tt.wikipedia's own century-article title
    // confirms: "XL (кырыгынчы) гасыр".
    [InlineData(40, "кырыгынчы")]
    [InlineData(41, "кырык беренче")] // …and only when the suffix actually follows it
    public void TheOrdinalIsDerived(int n, string want) => Assert.Equal(want, Normalize.OrdinalOf(n));

    [Fact]
    // ROMAN CENTURIES take the ordinal — through the registry seam, not the constructor.
    public void RomanCenturiesTakeTheOrdinal()
    {
        Assert.Equal("jeɡermenˈɕe ʁɑˈsɨr", Say("XX гасыр"));
        Assert.Equal("qɨrɨʁɨnˈɕɨ ʁɑˈsɨr", Say("XL гасыр"));      // the corpus's own gloss
        Assert.Equal("dyrtenˈɕe ʁɑsɨrˈdɑn", Say("IV гасырдан")); // the noun keeps the writer's case
        // A REGNAL number is a cardinal — no trigger noun, so the shared pass reads it plainly.
        Assert.Equal("alekˈsandr ˈøɕ", Say("Александр III"));
    }

    [Fact]
    // CLOCK, including the three-field timestamp and the suffix on its last field.
    public void TheClockAndItsSuffix()
    {
        Assert.Equal("jeɡerˈme iˈke utɨzˈʁɑ", Say("22:30-га")); // the suffix goes on the spoken MINUTE
        Assert.Equal("uˈnøɕ jeɡerˈme ˈøɕ ilˈle siɡezˈdæ", Say("13:23:58дә"));
        Assert.Equal("jeɡerˈme ˈber sæɡatˈtæ", Say("21: 00 сәгатьтә")); // the corpus's own spacing
    }

    [Fact]
    // DEGREES ARE COORDINATES HERE — not one of this corpus's ten `°` is a temperature, and `градус`'s
    // own article says the sign is "почмакның" — of an ANGLE.
    public void DegreesAreCoordinates()
    {
        Assert.Equal("tuqˈsɑn ʁrɑˈdus æjlænderelˈɡæn", Say("90° әйләндерелгән"));
        Assert.Equal("ɑltˈmɨʃ ɑlˈtɨ ʁrɑˈdus uˈtɨz miˈnut", Say("66°30'"));
        // ⚠ AND THE CASE SUFFIX SITS ON THE PRIME — the locative must be GLUED to *минут*, not left
        // standing as a bound morpheme read aloud as a word (trap 56).
        Assert.Equal("qɨˈrɨq ˈber ʁrɑˈdus unˈber minutɨnˈda", Say("41°11'ында"));
    }

    [Fact]
    // ERA MARKERS — the corpus glosses all four expansions in one sentence.
    public void EraMarkers()
    {
        Assert.Equal("bezˈneŋ eraˈɡa kaˈdær ˈøɕ ˈjøz uˈtɨz ˈdyrt jelˈda", Say("Б.э.к. 334 елда"));
        Assert.Equal("яңа эрага кадәр.", Norm("я. э. к."));
        Assert.Equal("һәм башкалар.", Norm("һ.б."));
        Assert.Equal("8 миллион т", Norm("8 млн. т"));
    }

    [Fact]
    // space GROUPING, the decimal COMMA, and the range's pause.
    public void GroupingDecimalsAndRanges()
    {
        Assert.Equal("ˈjøz qɨˈrɨq iˈke ˈmeŋ tuˈʁɨz ˈjøz unˈdyrt ˈmeŋ keˈʃe", Say("142 914 мең кеше"));
        Assert.Equal("ˈnul øˈter ɑlˈtɨ kiloˈmetr", Say("0,6 км")); // the comma was a clause pause
        Assert.Equal("ˈmeŋ iˈke ˈjøz uˈtɨz ɑlˈtɨ , ˈmeŋ iˈke ˈjøz uˈtɨz ʑiˈde jellarˈda",
            Say("1236—1237 елларда"));
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — a citation ends this way.
        Assert.Equal("s . uˈtɨz ˈdyrt , uˈtɨz ʑiˈde .", Say("С. 34-37."));
    }

    [Fact]
    // the SYMBOL tier, and the rate whose numerator carries an exponent.
    public void TheSymbolTier()
    {
        Assert.Equal("unˈber øˈter ˈbiʃ proˈt͡sent", Say("11,5%"));
        Assert.Equal("ˈjøz milliˈon dolˈlɑr", Say("$100 миллион"));
        Assert.Equal("unˈber ˈmeŋ ˈbiʃ ˈjøz qvɑˈdrɑt kiloˈmetr", Say("11 500 км²"));
        // ⚠ `м³/с` — the river-discharge shape. Tatar does not say "A per B": the denominator takes the
        // possessive-dative and stands alone, so `UnitPer` is "" and the inflected form is the entry.
        Assert.Equal("tuˈʁɨz øˈter ˈdyrt ˈdyrt ˈqub ˈmetr sekundɨˈna", Say("9,44 м³/с"));
        Assert.Equal("noˈmer ˈbiʃ", Say("№ 5"));
    }

    [Fact]
    // what is REFUSED, and why the refusal is the finding.
    public void TheRefusals()
    {
        // `=` is a GLOSS SEPARATOR in 12 of this corpus's 13 instances, so the rule is DIGIT-GATED.
        Assert.Equal("aba=«ölkän ir tuğan»", Norm("aba=«ölkän ir tuğan»"));
        Assert.Equal("5 тигез 5", Norm("5 = 5"));
        // No fraction rule: every `\d+/\d+` here is a document number, an address or an academic year.
        Assert.Equal("ПБУ 19/02", Norm("ПБУ 19/02"));
        Assert.Equal("2010/11 уку елында", Norm("2010/11 уку елында"));
        // No dot-decimal fold: 17 of the 18 dot-separated pairs in the Cyrillic text are figure
        // references or a date, and only `−2.88` is a number.
        Assert.Equal("08.10.07", Norm("08.10.07"));
    }

    [Theory]
    // INITIALISMS — the caps runs that reached the g2p as consonant clusters.
    [InlineData("ТР", "ˈte ˈer")]                   // was [tr]
    [InlineData("АКШ", "ˈɑ ˈqɑ ˈʃɑ")]               // the USA
    [InlineData("СССР", "ˈes ˈes ˈes ˈer")]
    public void Initialisms(string run, string want) => Assert.Equal(want, Say(run));
}
