/**
 * The portable half of test/chuvash.test.ts — Chuvash (chv), the SOLE surviving Oghur (Bulgaric) Turkic,
 * CYRILLIC. Two signatures: (1) ALLOPHONIC VOICING — the voiceless letters voice between vowels or after a
 * nasal/glide (and a liquid before a full vowel), and a GEMINATE blocks it → single long [Cː]; (2)
 * REDUCED-VOWEL STRESS — the reduced vowels ⟨ӑ⟩→[ə], ⟨ӗ⟩→[ɘ] cannot bear stress.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Chuvash;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ChuvashTests
{
    private static string Word(string s) => ChuvashPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "chv").Trim();
    private static string Norm(string s) => Normalize.NormalizeChuvash(s);
    private static string? Ord(double n) => Normalize.OrdinalOf(n);
    private static string Fold(string s) => Unicode.FoldCyrillicConfusables(s, true);

    [Theory]
    // HALLMARK 1 — allophonic intervocalic / post-nasal / post-liquid VOICING.
    [InlineData("апат", "aˈbat")]                 // ⟨п⟩→[b] between vowels; final ⟨т⟩ stays [t]
    [InlineData("ача", "aˈd͡ʑa")]                  // ⟨ч⟩→[d͡ʑ] intervocalic
    [InlineData("вӑкӑр", "ˈʋəɡər")]               // ⟨к⟩→[ɡ] intervocalic
    [InlineData("эпир", "eˈbir")]
    [InlineData("манпа", "manˈba")]               // ⟨п⟩→[b] AFTER A NASAL (not just intervocalic)
    [InlineData("чухӑнлӑх", "ˈt͡ɕuɣənləχ")]       // ⟨х⟩→[ɣ] intervocalic; final ⟨х⟩ stays [χ]
    [InlineData("вӑлсем", "ʋəlˈzem")]             // ⟨с⟩→[z] after a LIQUID before a FULL vowel
    [InlineData("чӗрпӗк", "ˈt͡ɕɘrpɘk")]           // ⟨п⟩ stays [p] after a liquid before a REDUCED vowel
    public void AllophonicVoicing(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Gemination BLOCKS voicing → single long voiceless [Cː].
    [InlineData("иккӗ", "ˈikːɘ")]
    [InlineData("саккӑр", "ˈsakːər")]
    public void GeminationBlocksVoicing(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // HALLMARK 2 — reduced ⟨ӑ⟩→ə, ⟨ӗ⟩→ɘ never bear stress.
    [InlineData("чӑваш", "t͡ɕəˈʋaʂ")]             // stress the FULL ⟨а⟩, not the reduced ⟨ӑ⟩
    [InlineData("сӑмах", "səˈmaχ")]               // stress the last full ⟨а⟩ (⟨ӑ⟩ reduced)
    [InlineData("вӑтӑр", "ˈʋədər")]               // ALL vowels reduced → stress the FIRST
    [InlineData("мӗн", "ˈmɘn")]
    [InlineData("кӗҫнерникун", "kɘɕnerniˈɡun")]
    public void ReducedVowelsNeverStressed(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Onset consonants + vowels + iotation.
    [InlineData("чул", "ˈt͡ɕul")]
    [InlineData("хула", "χuˈla")]
    [InlineData("шыв", "ˈʂɯʋ")]
    [InlineData("ҫил", "ˈɕil")]
    public void OnsetConsonants(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨ь⟩ PALATALIZES — the soft sign is not silent in Chuvash, and ⟨ъ⟩ keeps the glide.
    [InlineData("выльӑх", "ˈʋɯlʲəχ")]             // the referee's own row, exactly
    [InlineData("тӑрать", "təˈratʲ")]              // palatalized final ⟨т⟩ against a bare stem
    [InlineData("январь", "janˈʋarʲ")]
    [InlineData("Перечень", "pereˈd͡ʑenʲ")]        // the voicing table still sees a bare segment
    [InlineData("объектов", "objekˈtoʋ")]          // ⟨ъ⟩ before ⟨е⟩ is a separating sign
    [InlineData("съезде", "sjezˈde")]
    public void SoftSignPalatalizes(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // THE OGHUR system: two series per unit + unit-times-ten 80/90.
    [InlineData("7", "ˈɕit͡ɕːɘ")]                  // ҫиччӗ — the FULL (counting) form
    [InlineData("11", "ˈʋun pɘˈrːe")]              // вун пӗрре — short ten + the full unit
    [InlineData("25", "ˈɕirɘm ˈpilːɘk")]
    [InlineData("100", "ˈɕɘr")]                    // ҫӗр — no multiplier for 1
    [InlineData("138", "ˈɕɘr ˈʋədər ˈsakːər")]     // verbatim the source's own example
    [InlineData("555", "ˈpilɘk ˈɕɘr ˈalːə ˈpilːɘk")] // SHORT пилӗк before ҫӗр, FULL пиллӗк at the end
    [InlineData("1984", "ˈpin ˈtəɣər ˈɕɘr saɡərˈʋunːə təˈʋatːə")] // 80 = 8×10
    [InlineData("12345", "ˈʋun ˈik ˈpin ˈʋiɕ ˈɕɘr ˈχɘrɘχ ˈpilːɘk")]
    [InlineData("1000000", "ˈpɘr milːiˈon")]
    public void TheOghurNumbers(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // THE LATIN LOOK-ALIKE CODEPOINTS — the defect that had to be fixed before anything else.
    [InlineData("вăтам", "вӑтам")]
    [InlineData("Чăваш", "Чӑваш")]
    [InlineData("пĕрремĕш", "пӗрремӗш")]
    [InlineData("çĕр", "ҫӗр")]
    [InlineData("ĕмĕр", "ӗмӗр")]
    [InlineData("ăшă", "ӑшӑ")]
    [InlineData("çĕнĕ", "ҫӗнӗ")]
    public void TheLatinLookalikeFoldsToCyrillic(string latin, string cyrillic) =>
        Assert.Equal(Say(cyrillic), Say(latin));

    [Fact]
    public void TheLookalikeFoldReachesTheG2p()
    {
        // `çĕр` is the case the MAJORITY rule could not reach — two Latin letters against one Cyrillic.
        Assert.Equal("ˈɕɘr", Say("çĕр"));
        // AND A GENUINELY FOREIGN WORD IS STILL UNTOUCHED — no Cyrillic letter at all.
        Assert.Contains("München", Fold("Ку München хула"));
        Assert.Equal("für", Fold("für"));
    }

    [Theory]
    // THE ATTRIBUTIVE NUMERAL — the second series the engine never asked for.
    [InlineData("1 км", "ˈpɘr kiloˈmetr")]         // пӗр, not пӗрре
    [InlineData("5 км", "ˈpilɘk kiloˈmetr")]       // пилӗк, not пиллӗк
    [InlineData("21 км", "ˈɕirɘm ˈpɘr kiloˈmetr")]
    [InlineData("5", "ˈpilːɘk")]                   // a digit run standing alone KEEPS the counting form
    [InlineData("1", "pɘˈrːe")]
    public void TheAttributiveNumeral(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    public void TheOrdinalIsAnInvariantSuffix()
    {
        // ba needs four allomorphs chosen by harmony and rounding, tt two; Chuvash needs none.
        Assert.Equal("пӗрремӗш", Ord(1));
        Assert.Equal("тӑваттӑмӗш", Ord(4));
        Assert.Equal("ҫирӗммӗш", Ord(20));
        Assert.Equal("ҫӗрмӗш", Ord(100));
        Assert.Equal("пинмӗш", Ord(1000));
        // THE STEM IS THE FULL SERIES — тӑваттӑ, not тӑват.
        Assert.NotEqual("тӑватмӗш", Ord(4));
    }

    [Theory]
    // The written suffix may run past the ordinal's own tail; splice on the overlap.
    [InlineData("22-мĕшĕнче", "ˈɕirɘm ikːɘmɘʐɘnˈd͡ʑe")] // ҫирӗм иккӗмӗшӗнче
    [InlineData("3-мĕш космонавчĕ", "ˈʋiɕːɘmɘʂ kosmoˈnaʋt͡ɕɘ")]
    public void TheWrittenOrdinalSuffix(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    public void TheOrdinalRange()
    {
        // Three hyphens in one token, two of which open a range and one introduces a suffix.
        Assert.Equal("pɘˈrːemɘʂ , ˈpilːɘkmɘʂ klazɘzenˈd͡ʑe", Say("1-5-мӗш класӗсенче"));
    }

    [Theory]
    // DEGREES ARE TEMPERATURES HERE — and the scale letter has three encodings.
    [InlineData("−19 °C", "miˈnus ˈʋun ˈtəɣər t͡selʲˈzi ɡraˈduzɘ")]
    [InlineData("-13°С", "miˈnus ˈʋun ˈʋiɕ t͡selʲˈzi ɡraˈduzɘ")] // Cyrillic ⟨С⟩
    [InlineData("+20°с", "plˈjus ˈɕirɘm t͡selʲˈzi ɡraˈduzɘ")]    // lowercase Cyrillic ⟨с⟩
    public void TheDegreesAreTemperatures(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // THE FRACTION, claimed only where `пай` follows.
    [InlineData("4/5 пайĕ", "təˈʋatːə ˈpilːɘkmɘʂ ˈpajɘ")]
    [InlineData("1/2 пайĕн", "pɘˈrːe ˈikːɘmɘʂ ˈpajɘn")]
    public void TheFraction(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // …and six of the nine slashes in this corpus are something else entirely.
    [InlineData("1608/09 çулхи")]
    [InlineData("57/1 ҫурт")]
    [InlineData("3/14")]
    public void TheBareSlashIsDeclined(string input) => Assert.Equal(input, Norm(input));

    [Theory]
    // ROMAN CENTURIES — through the registry seam, and in the encoding the writer used.
    [InlineData("XVIII ĕмĕр", "ˈʋun ˈsakːərmɘʂ ˈɘmɘr")]
    [InlineData("XVIII ӗмӗр", "ˈʋun ˈsakːərmɘʂ ˈɘmɘr")]
    [InlineData("Екатерина II", "jeɡaderiˈna ˈikːɘ")] // a regnal number is a cardinal
    public void TheRomanCenturies(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    public void TheClock()
    {
        // THE SECONDS FIELD REACHES 60 — one of the three clocks IS the leap second.
        Assert.Equal("ˈɕirɘm ˈʋiɕːɘ ˈalːə ˈtəχːər ˈutməl", Say("23:59:60"));
    }

    [Fact]
    public void TheEraMarkerAndYearAbbrev()
    {
        Assert.Equal("пирӗн эраччен 2040", Norm("п. эрч. 2040"));
        Assert.Equal("530 ҫул", Norm("530 ҫ."));
    }

    [Theory]
    [InlineData("1 032 343 çын", "ˈpɘr milːiˈon ˈʋədər ˈik ˈpin ˈʋiɕ ˈɕɘr ˈχɘrɘχ ˈʋiɕ ˈɕɯn")]
    [InlineData("12,5", "ˈʋun ˈikːɘ χyreʂˈke ˈpilːɘk")] // хӳрешке — the comma's own name
    public void TheGroupingAndDecimalComma(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    public void TheRangesPause()
    {
        // NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — a citation ends this way, and both
        // endpoints keep the COUNTING form, because no noun follows either.
        Assert.Equal("s . ˈutməl pɘˈrːe , ˈutməl ˈʋiɕːɘ .", Say("С. 61-63."));
    }

    [Theory]
    // THE SYMBOL TIER: percent, currency, the squared unit and the rate.
    [InlineData("84%", "saɡərˈʋunːə təˈʋat proˈt͡sent")] // 80 is сакӑрвуннӑ, ONE word (8×10)
    [InlineData("$10 000", "ˈʋun ˈpin doˈlːar")]
    [InlineData("8 413 km²", "ˈsaɡər ˈpin təˈʋat ˈɕɘr ˈʋun ˈʋiɕ təʋatˈkal kiloˈmetr")]
    [InlineData("2,8 м/ç", "ˈikːɘ χyreʂˈke ˈsakːər ˈmetr ɕekːuntˈra")] // the denominator in the LATIN ⟨ç⟩
    public void TheSymbolTier(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // INITIALISMS — the caps runs that reached the g2p as consonant clusters.
    [InlineData("ЧР", "ˈt͡ɕe ˈer")]
    [InlineData("АПШ", "ˈa ˈpe ˈʂa")] // the USA
    public void TheInitialisms(string input, string want) => Assert.Equal(want, Say(input));
}
