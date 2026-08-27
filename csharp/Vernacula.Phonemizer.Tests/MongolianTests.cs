// The portable half of test/mongolian.test.ts — Mongolian (mn), Standard Khalkha over Cyrillic (and the
// Mongol-bichig front-end), a DEEP orthography whose non-initial short vowels reduce and whose word-final
// ones delete.
using Vernacula.Phonemizer;
using MnEngine = Vernacula.Phonemizer.Languages.Mongolian.MongolianPhonemizer;
using MnNormalize = Vernacula.Phonemizer.Languages.Mongolian.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class MongolianTests
{
    [Theory]
    // Consonants, back-harmony ⟨г⟩→ɢ / ⟨х⟩→χ, dark ⟨л⟩, final ⟨н⟩→ŋ.
    [InlineData("Монгол", "mɔŋɢʊɮ")]
    [InlineData("сайн", "saiŋ")]
    [InlineData("ном", "nɔm")]
    [InlineData("хот", "χɔtʰ")]
    [InlineData("улс", "ʊɮs")]
    // Front harmony, and the soft sign that FRONTS the preceding vowel and drops.
    [InlineData("хүн", "xuŋ")]
    [InlineData("өдөр", "ɵtɵr")]
    [InlineData("морь", "mœr")]
    // Long vowels, final ⟨в⟩ devoicing, and the reduction.
    [InlineData("сургууль", "sʊrɢuːɮ")]
    [InlineData("гурав", "ɢʊrəf")]
    [InlineData("байна", "pain")]           // the word-final short vowel DELETES
    // A loanword (mixed vowel harmony) keeps its non-initial vowels FULL.
    [InlineData("Герман", "ɡermaŋ")]
    // The traditional script: transliterate, contract, then the same Cyrillic pipeline.
    [InlineData("ᠮᠣᠩᠭᠣᠯ", "mɔŋɢʊɮ")]
    // ⟨ъ⟩ keeps the GLIDE of the following iotated letter — the only reason the hard sign is written.
    [InlineData("томъёоны", "tʰɔmjʊʊn")]
    [InlineData("Сахъяа", "saχjə")]
    public void TheKhalkhaReading(string word, string want) => Assert.Equal(want, MnEngine.PhonemizeWord(word));

    /** ⟨ї⟩ U+0457 is a legacy-codepage ⟨ү⟩, not a Ukrainian letter that wandered in. */
    [Theory]
    [InlineData("бїр", "бүр")]
    [InlineData("бїлэг", "бүлэг")]
    public void TheLegacyCodepageFold(string legacy, string modern) =>
        Assert.Equal(MnEngine.PhonemizeWord(modern), MnEngine.PhonemizeWord(legacy));

    [Fact]
    public void RegistryWiring() => Assert.Equal("saiŋ pain ʊː ?", Phonemizer.Phonemize("Сайн байна уу?", "mn").Trim());

    [Theory]
    // Cardinals: attributive for every word but the last (хорин тав), the place word bare for 1×.
    [InlineData("1", "neɡ")]
    [InlineData("10", "arəf")]
    [InlineData("25", "χɔrəŋ tʰaf")]
    [InlineData("100", "t͡sʊː")]
    [InlineData("2000", "χɔjʊr maŋəɢ")]
    public void TheCardinalComposer(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "mn").Trim());

    [Theory]
    // ORDINALS — the attested 1–10 table, the two forms the rule SUPPLIES, and the compositional path above ten.
    [InlineData("1-р сар", "нэгдүгээр сар")]
    [InlineData("3-р сарын", "гуравдугаар сарын")]
    [InlineData("8-р сар", "наймдугаар сар")]
    [InlineData("9-р сар", "есдүгээр сар")]
    [InlineData("13-р зуун", "арван гуравдугаар зуун")]
    [InlineData("21-р байранд", "хорин нэгдүгээр байранд")]
    [InlineData("20-р зуун", "хорьдугаар зуун")]
    [InlineData("9-рт", "есдүгээрт")]       // the trailing case suffix is re-emitted, not dropped
    [InlineData("1-Москва", "1-Москва")]    // a numbered list marker is not an ordinal
    // PERCENT — the bare sign, the two attested suffixes absorbed into the stem, and the refusal.
    [InlineData("29% нь", "29 хувь нь")]
    [InlineData("5 %", "5 хувь")]
    [InlineData("67%-ийг", "67 хувийг")]
    [InlineData("7.7%-иар", "7 цэг 7 хувиар")]
    [InlineData("5%-д", "5%-д")]            // any OTHER suffix is refused rather than stranded
    // UNITS — the measure word is PREPOSED, and a rate is refused whole.
    [InlineData("1300 м өндөртэй", "1300 метр өндөртэй")]
    [InlineData("10 кг", "10 килограмм")]
    [InlineData("69585 км²", "69585 квадрат километр")]
    [InlineData("5 м2", "5 квадрат метр")]  // the ASCII exponent — otherwise it reads as a NUMBER
    [InlineData("4205 м.", "4205 метр.")]   // ⚠ the right guard carries no `.` or `,`
    [InlineData("116 м³/с", "116 м³/с")]    // a key followed by `/` is refused whole
    [InlineData("3780km²", "3780 квадрат километр")]
    [InlineData("265 км-т", "265 километрт")]   // a glued suffix on a ⟨р⟩-final noun needs no morphology
    [InlineData("100 кг-н", "100 килограмм-н")] // …and stays where it was on any other
    // CURRENCY — postposed, magnitude-aware, redundancy-guarded.
    [InlineData("$45", "45 доллар")]
    [InlineData("$90.7 тэрбум", "90 цэг 7 тэрбум доллар")]
    [InlineData("$15 саяыг", "$15 саяыг")]  // a case-marked magnitude refuses the WHOLE match
    [InlineData("$2.5 тэрбум ам.доллар", "2 цэг 5 тэрбум ам доллар")] // the window is not cut by the decimal
    [InlineData("Төсөв 500 € Европт", "Төсөв 500 евро Европт")]       // `Европ` is not the currency word
    [InlineData("500 € еврогийн ханш", "500 еврогийн ханш")]
    // DEGREES and the MINUS.
    [InlineData("5°С", "5 хэм")]            // ⟨С⟩ is CYRILLIC here
    [InlineData("100 °C", "100 хэм")]
    [InlineData("212 °F", "212 °F")]        // no scale name is sourceable — refuse it whole
    [InlineData("5°f", "5°f")]              // …and the refusal is CASE-FOLDED
    [InlineData("47°49'", "47°49'")]        // a COORDINATE, not a temperature
    [InlineData("-25°С хүрдэг", "хасах 25 хэм хүрдэг")]
    [InlineData("(−154 м)", "(хасах 154 метр)")] // U+2212 needs no right context
    [InlineData("+41 хэм", "+41 хэм")]      // the plus is DELIBERATELY left
    [InlineData("1206-1635", "1206-1635")]  // no range rule — the ablative allomorph is not derivable here
    // SEPARATORS — the comma is both a group and a decimal, and a LIST is neither.
    [InlineData("1,208,544", "1208544")]
    [InlineData("105 000", "105000")]
    [InlineData("4,704.4 км²", "4704 цэг 4 квадрат километр")]
    [InlineData("1974,1977 онуудад", "1974,1977 онуудад")]
    [InlineData("2000.4.19", "2000.4.19")]  // a DATE, not a decimal
    [InlineData("350 000, 160 000.", "350000, 160000.")]
    [InlineData("1 234 567", "1234 567")]   // the left anchor's KNOWN cost, recorded rather than paid
    // DOTS AND INITIALS.
    [InlineData("ам.доллар", "ам доллар")]
    [InlineData("Ц.Элбэгдорж", "цэ Элбэгдорж")]
    [InlineData("Б.Б.Полынов", "бэ бэ Полынов")]
    [InlineData("Улс. Дараа нь", "Улс. Дараа нь")]
    // INITIALISMS — the seam spells what the deep orthography would otherwise EAT.
    [InlineData("ДНБ", "дэ эн бэ")]
    [InlineData("ХХК", "хэ хэ ка")]
    [InlineData("ЗХУ-ын", "зэ хэ у-ын")]
    [InlineData("АНУ", "а эн у")]           // phonotactically LEGAL — a lexical fact, not an OOV one
    [InlineData("НҮБ", "эн ү бэ")]
    [InlineData("МЭӨ 390 онд", "эм э ө 390 онд")]
    [InlineData("МУ-д оршин", "МУ-д оршин")] // …and what the admission criterion REFUSES
    [InlineData("МОНГОЛ", "МОНГОЛ")]         // an ordinary word in a shouted phrase
    public void TheNormalizer(string input, string want) => Assert.Equal(want, MnNormalize.NormalizeMongolian(input));

    [Theory]
    [InlineData("3-р сарын 29% нь", "ɢʊrəwtʊɢaːr sarəŋ χɔrəŋ jes χuw n")]
    [InlineData("Дундаж температур нь -25°С", "tʊntət͡ʃ tʰempʰeratʰʊr n χasəχ χɔrəŋ tʰaf xem")]
    [InlineData("АНУ", "a eŋ ʊ")]           // was [an] — the ⟨У⟩ silently gone
    [InlineData("ХДХВ", "xe te xe we")]
    public void TheWholePipeline(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "mn").Trim());

    /** No digit leak, sentinel or gap anywhere in the composer's dense range. */
    [Fact]
    public void NoLeakAcrossTheDenseRange()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var w = Languages.Mongolian.Numbers.NumberToWords(n);
            Assert.False(w.Contains("undefined") || w.Contains("NaN") || w.Any(char.IsAsciiDigit), $"n={n}");
        }
    }

    /** ⚠ ABOVE 2^53 the composer REFUSES and the caller must fall back to the digit reading — the number
     *  used to vanish from the sentence entirely. */
    [Fact]
    public void AboveTwoToTheFiftyThreeTheDigitsAreStillSpoken()
    {
        Assert.Equal("", Languages.Mongolian.Numbers.NumberToWords(1e20));
        Assert.NotEqual("", Phonemizer.Phonemize("10000000000000000000", "mn").Trim());
    }
}
