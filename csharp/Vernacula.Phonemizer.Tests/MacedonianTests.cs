/**
 * The portable half of test/macedonian.test.ts — Macedonian (mk, македонски), South Slavic, Cyrillic,
 * fully phonemic with NO vowel reduction. A left-to-right grapheme scan plus the shared South-Slavic
 * phonotactics (dark-l, final devoicing, regressive voicing, n→ŋ). Two Macedonian specifics: the palatals
 * are DISTINCT LETTERS (ѓ ќ љ њ ѕ џ ј → ɟ c ʎ ɲ d͡z d͡ʒ j — no ь/я/ю), and STRESS is FIXED on the ANTEPENULT
 * syllable, so it is predictable and emitted.
 *
 * Every expected value here is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Xunit;
using MkEngine = Vernacula.Phonemizer.Languages.Macedonian.MacedonianPhonemizer;
using MkNormalize = Vernacula.Phonemizer.Languages.Macedonian.Normalize;
using MkNumbers = Vernacula.Phonemizer.Languages.Macedonian.Numbers;

namespace Vernacula.Phonemizer.Tests;

public class MacedonianTests
{
    private static readonly JsRe WS = JsRegex.Compile("\\s+", "gu");
    private static string Word(string s) => MkEngine.PhonemizeWord(s);
    /** The normalizer alone — pure text→text, asserted where the point is the WORDS. */
    private static string N(string s) => MkNormalize.NormalizeMacedonian(s);
    /** Through the ENGINE object. */
    private static string Say(string s) => Js.Trim(WS.Replace(new MkEngine().Text(s), " "));
    /** Through the REGISTRY — the shared Roman→digit and foreign routers run there, so regnal ordinals
     *  and the Latin version-dot suffix resolve as in production. */
    private static string Ph(string s) => Js.Trim(WS.Replace(Phonemizer.Phonemize(s, "mk"), " "));

    /** The distinct palatal LETTERS, dark-l, syllabic ⟨р⟩, final devoicing, and antepenult stress. */
    [Theory]
    [InlineData("ѓавол", "ɟˈavɔɫ")]
    [InlineData("куќа", "kˈuca")]
    [InlineData("љубов", "ʎˈubɔf")]      // ⟨љ⟩ → ʎ, final ⟨в⟩ → f
    [InlineData("коњ", "kˈɔɲ")]
    [InlineData("ѕид", "d͡zˈit")]        // ⟨ѕ⟩ → d͡z, final ⟨д⟩ → t
    [InlineData("џамија", "d͡ʒˈamija")]
    [InlineData("волк", "vˈɔɫk")]        // dark ⟨л⟩ before a consonant
    [InlineData("леб", "lˈɛp")]          // light ⟨л⟩ before ɛ, final ⟨б⟩ → p
    [InlineData("прст", "pˈr̩st")]        // syllabic ⟨р⟩
    [InlineData("срце", "sˈr̩t͡sɛ")]      // the syllabic ⟨р⟩ bears the stress
    [InlineData("град", "ɡrˈat")]
    [InlineData("Македонија", "makɛdˈɔnija")] // 5 syllables → antepenult
    [InlineData("планина", "pɫˈanina")]       // 3 syllables → antepenult
    [InlineData("ноќ", "nˈɔc")]               // monosyllable
    public void ThePhonemizer(string word, string want) => Assert.Equal(want, Word(word));

    /** Cardinals: the "и" connector, the FEMININE две илјади, and the masculine million. */
    [Theory]
    [InlineData("15", "pɛtnˈaɛsɛt")]
    [InlineData("21", "dvˈaɛsɛt ˈi ˈɛdɛn")]
    [InlineData("234", "dvˈɛstɛ trˈiɛsɛt ˈi t͡ʃˈɛtiri")]
    [InlineData("2000", "dvˈɛ ˈiljadi")]        // ДВЕ илјади — илјада is feminine, so not "два"
    [InlineData("1000000", "mˈiliɔn")]
    [InlineData("2000000", "dvˈa milˈiɔni")]    // два милиони — милион is masculine
    [InlineData("Добар ден, Македонија!", "dˈɔbar dˈɛn , makɛdˈɔnija !")]
    public void TheCardinalsAndClauseAssembly(string text, string want) => Assert.Equal(want, Say(text));

    /** Period/space group thousands; the comma is BOTH grouping and decimal, told apart by block length. */
    [Theory]
    [InlineData("400.000 познати случаи", "400000 познати случаи")]
    [InlineData("5.000.000 уникатни", "5000000 уникатни")]   // two passes
    [InlineData("40 000 луѓе", "40000 луѓе")]
    public void TheDeGrouping(string text, string want) => Assert.Equal(want, N(text));

    [Theory]
    [InlineData("Од 1,400 луѓе", "ˈɔt ˈiljada ˈi t͡ʃɛtiristˈɔtini ɫˈuɟɛ")]  // 3-digit comma = grouping
    [InlineData("6,5 степени", "ʃˈɛst zˈapirka pˈɛt stˈɛpɛni")]            // 1-digit comma = decimal
    [InlineData("12,8 km", "dvanˈaɛsɛt zˈapirka ˈɔsum kiɫˈɔmɛtri")]
    [InlineData("2,243", "dvˈɛ ˈiljadi dvˈɛstɛ t͡ʃɛtirˈiɛsɛt ˈi trˈi")]     // 3-digit block read whole
    public void TheCommaIsToldApartByBlockLength(string text, string want) => Assert.Equal(want, Ph(text));

    /**
     * THE SUFFIX ORDINAL, the largest class in the layer. The written suffix is the LAST letters of the
     * spoken form and encodes GENDER + DEFINITENESS, not case. Only the LAST element of a compound
     * ordinalizes. ⚠ `-та` on a ROUND THOUSAND is the feminine INDEFINITE (илјадита, not илјадитата),
     * because the corpus's `1.000-та поштенска марка` carries its definiteness on the preceding possessive.
     */
    [Theory]
    [InlineData("17-ти век", "седумнаесетти век")]                    // -ти  masc indefinite
    [InlineData("18-тиот век", "осумнаесеттиот век")]                 // -тиот masc definite
    [InlineData("18-от век", "осумнаесеттиот век")]                   // -от, contracted
    [InlineData("7-миот", "седмиот")]
    [InlineData("21-ви", "дваесет и први")]
    [InlineData("37-ма земја", "триесет и седма земја")]              // -ма feminine indefinite
    [InlineData("1-та и 3-та дивизија", "првата и третата дивизија")] // -та feminine definite
    [InlineData("1.000-та марка", "илјадита марка")]                  // round thousand → indefinite
    [InlineData("116-те напреварувачи", "сто и шеснаесетте напреварувачи")] // "the 116"
    [InlineData("40-тина", "четириесетина")]                          // "some forty"
    [InlineData("190ти", "сто и деведесетти")]                        // no hyphen at all
    [InlineData("60-ти", "шеесетти")]
    [InlineData("1970-тите години", "илјада деветстотини и седумдесеттите години")]
    [InlineData("1850-те години", "илјада осумстотини и педесеттите години")]
    [InlineData("1920- тите години", "илјада деветстотини и дваесеттите години")] // a SPACE inside
    [InlineData("100-200 милји/час", "100 до 200 милји на час")]
    public void TheSuffixOrdinal(string text, string want) => Assert.Equal(want, N(text));

    /** Century and date ordinals: bare `N век`, `N <month>`, and the Germanic `N.` remnant. */
    [Theory]
    [InlineData("меѓу 10 и 11 век и 14 век", "меѓу десетти и единаесетти век и четиринаесетти век")]
    [InlineData("на 6 октомври 1789", "на шести октомври 1789")]
    [InlineData("24 август - 5 септември 2021", "дваесет и четврти август до петти септември 2021")]
    [InlineData("4. јули 1776", "четврти јули 1776")]
    // Era markers and the year abbreviation — multi-dot BEFORE the single-dot rule, or the interior dots
    // reach clausePunctuation as sentence breaks.
    [InlineData("356 г. п.н.е.", "356 година пред нашата ера")]
    [InlineData("400 г. н.е.", "400 година од нашата ера")]
    [InlineData("1978 г.", "1978 година")]   // a year → година
    [InlineData("25 г.", "25 години")]       // an age → години
    public void CenturiesDatesAndEras(string text, string want) => Assert.Equal(want, N(text));

    /** Clock: hour "и" minute, `:00` drops the minutes, and the trailing `ч` becomes часот. */
    [Theory]
    [InlineData("меѓу 06:30 и 07:30 часот", "mˈɛɟu ʃˈɛst ˈi trˈiɛsɛt ˈi sˈɛdum ˈi trˈiɛsɛt t͡ʃˈasɔt")]
    [InlineData("во 10:00 часот", "vˈɔ dˈɛsɛt t͡ʃˈasɔt")]
    [InlineData("до 23:35 ч.", "dˈɔ dvˈaɛsɛt ˈi trˈi ˈi trˈiɛsɛt ˈi pˈɛt t͡ʃˈasɔt")]
    // ⚠ The range rule runs BEFORE the clock, so `22:00-23:00` is "22:00 до 23:00" by the time it looks.
    [InlineData("Помеѓу 22:00-23:00 часот", "pˈɔmɛɟu dvˈaɛsɛt ˈi dvˈa dˈɔ dvˈaɛsɛt ˈi trˈi t͡ʃˈasɔt")]
    public void TheClock(string text, string want) => Assert.Equal(want, Ph(text));

    /** Rates, units, squared units and percent through the shared symbol tier. */
    [Theory]
    [InlineData("83 km/h", "ɔsˈumdɛsɛt ˈi trˈi kiɫˈɔmɛtri nˈa t͡ʃˈas")]
    [InlineData("165 км/ч", "stˈɔ ʃˈɛɛsɛt ˈi pˈɛt kiɫˈɔmɛtri nˈa t͡ʃˈas")]
    [InlineData("3.850 км²", "trˈi ˈiljadi ɔsumstˈɔtini ˈi pˈɛdɛsɛt kvˈadratni kiɫˈɔmɛtri")]
    // ⚠ The Cyrillic `мм2` is a LOCAL rule: the shared tier's exponent lookbehind is ASCII-only.
    [InlineData("3136 мм2", "trˈi ˈiljadi stˈɔ trˈiɛsɛt ˈi ʃˈɛst kvˈadratni milˈimɛtri")]
    [InlineData("4892 м", "t͡ʃˈɛtiri ˈiljadi ɔsumstˈɔtini dɛvˈɛdɛsɛt ˈi dvˈa mˈɛtri")]
    [InlineData("88 %", "ɔsˈumdɛsɛt ˈi ˈɔsum prˈɔt͡sɛnti")]
    [InlineData("600 Mbit/s", "ʃɛstˈɔtini mɛɡˈabiti nˈa sˈɛkunda")]
    public void RatesUnitsAndPercent(string text, string want) => Assert.Equal(want, Ph(text));

    /**
     * Signs. ⚠ Фаренхајт MUST use Cyrillic ⟨ј⟩ U+0458, not Latin ⟨j⟩ U+006A. They are indistinguishable on
     * screen, but a Latin j is outside the Cyrillic token class, so the word would split in three and the j
     * would be handed to the foreign reader as the ENGLISH LETTER NAME. Nothing is dropped and nothing raw
     * survives, so no leak gate could see it.
     */
    [Theory]
    [InlineData("90°F", "dɛvˈɛdɛsɛt stˈɛpɛni pˈɔ fˈarɛnxajt")]
    [InlineData("35° W", "trˈiɛsɛt ˈi pˈɛt stˈɛpɛni zˈapat")]
    [InlineData("над +30 степени целзиусови", "nˈat pɫˈus trˈiɛsɛt stˈɛpɛni t͡sɛɫziˈusɔvi")]
    [InlineData("Б&Б", "p ˈi p")]   // the ampersand → и; it was dropped outright before
    public void TheSigns(string text, string want) => Assert.Equal(want, Ph(text));

    /** Initialisms: vowel-less runs letter-spell, САД is read as a word, Д-р/Г-дин expand. */
    [Theory]
    [InlineData("ФБИ", "ˈɛf bˈɛ ˈi")]
    [InlineData("ДНК", "dˈɛ ˈɛn kˈa")]
    [InlineData("СССР", "ˈɛs ˈɛs ˈɛs ˈɛr")]
    [InlineData("САД", "sˈat")]      // pronounced as the word [sat], not letter-spelled
    [InlineData("ОН", "ˈɔ ˈɛn")]     // letter-spelled: он = "he" would be wrong
    [InlineData("GPS", "ɡˈɛ pˈɛ ˈɛs")] // embedded Latin, Macedonian letter names
    [InlineData("Д-р Малар", "dˈɔktɔr mˈaɫar")]
    [InlineData("Г-дин Рид", "ɡˈɔspɔdin rˈit")]
    [InlineData("НАСА, Н. Вејн", "nˈasa , ˈɛn vˈɛjn")]
    [InlineData("Џорџ В. Буш", "d͡ʒˈɔrt͡ʃ vˈɛ bˈuʃ")]
    public void TheInitialisms(string text, string want) => Assert.Equal(want, Ph(text));

    /** Regnal ordinals after the shared Roman→digit pass: feminine after a name in -а, 2–39 only. */
    [Theory]
    [InlineData("Лиалофи III", "liˈaɫɔfi trˈɛti")]
    [InlineData("Кралица Елизабета II", "krˈalit͡sa ɛlizˈabɛta ftˈɔra")]  // Втора, feminine
    [InlineData("Луј XVI", "ɫˈuj ʃɛsnaˈɛsɛtti")]
    [InlineData("во Формула 1.", "vˈɔ fˈɔrmuɫa ˈɛdɛn .")]                // Formula ONE — a cardinal
    public void TheRegnalOrdinals(string text, string want) => Assert.Equal(want, Ph(text));

    /** Fractions — mk is in the registry's VULGAR_FOLD_OPT_OUT because it reads them better than the shared
     *  fold can, with the "и" that joins a mixed number. And the version dot reads "точка". */
    [Theory]
    [InlineData("29¾ инчи на 24½ инчи",
        "dvˈaɛsɛt ˈi dˈɛvɛt ˈi trˈi t͡ʃɛtvˈr̩tini ˈint͡ʃi nˈa dvˈaɛsɛt ˈi t͡ʃˈɛtiri ˈi pɔɫˈɔvina ˈint͡ʃi")]
    [InlineData("5 мм (1/5 инчи)", "pˈɛt milˈimɛtri ˈɛdna pˈɛttina ˈint͡ʃi")]
    [InlineData("802.11n", "ɔsumstˈɔtini ˈi dvˈa tˈɔt͡ʃka ɛdinˈaɛsɛt ˈɛn")]
    public void FractionsAndVersionDots(string text, string want) => Assert.Equal(want, Ph(text));

    /**
     * ⚠ THE ORDINAL IS NULL OUTSIDE 1–9999, and that boundary is what keeps the suffix rule from claiming a
     * figure it cannot compose — the rule returns the match untouched when `MkOrdinal` declines.
     */
    [Theory]
    [InlineData(1, "први")]
    [InlineData(190, "сто и деведесетти")]
    [InlineData(1970, "илјада деветстотини и седумдесетти")]
    [InlineData(1000, "илјадити")]
    [InlineData(9999, "девет илјади деветстотини деведесет и деветти")]
    [InlineData(2000, "два илјадити")]
    [InlineData(100, "стоти")]
    public void TheOrdinalComposition(double n, string want) => Assert.Equal(want, MkNumbers.MkOrdinal(n));

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(10000)]
    [InlineData(1.5)]
    public void TheOrdinalDeclinesOutsideItsRange(double n) => Assert.Null(MkNumbers.MkOrdinal(n));
}
