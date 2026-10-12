/**
 * Czech, Slovak, Belarusian, Bulgarian and Macedonian defects the Rust port found (#1535), fixed TS-first. Ported
 * from test/slavic-port-findings.test.ts; probe text is synthetic, and the expectations are the TS engine's output.
 */
using Xunit;
using Cs = Vernacula.Phonemizer.Languages.Czech.Normalize;
using Sk = Vernacula.Phonemizer.Languages.Slovak.Normalize;
using Be = Vernacula.Phonemizer.Languages.Belarusian.Normalize;
using Bg = Vernacula.Phonemizer.Languages.Bulgarian.Normalize;
using Mk = Vernacula.Phonemizer.Languages.Macedonian.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class SlavicPortFindingsTests
{
    private static string P(string text, string lang) => Phonemizer.Phonemize(text, lang);

    // ── Czech ────────────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public void CsAnInflectedOrdinalOutOfRangeIsLeftAsWritten()
    {
        Assert.Equal("Ve 1000. století.", Cs.NormalizeCzech("Ve 1000. století."));
        Assert.Equal("V 0. letech", Cs.NormalizeCzech("V 0. letech"));
        Assert.Equal("1000. září", Cs.NormalizeCzech("1000. září"));
        Assert.Equal("na 1000. místě", Cs.NormalizeCzech("na 1000. místě"));
        Assert.Equal("po 1000. hodině", Cs.NormalizeCzech("po 1000. hodině"));
        Assert.Equal("na 1000. a pátém místě", Cs.NormalizeCzech("na 1000. a 5. místě"));
        Assert.Equal("Ve dvanáctém a 1000. století", Cs.NormalizeCzech("Ve 12. a 1000. století"));
    }

    [Fact]
    public void CsTheRegnalRuleSkipsASentencesFirstWord()
    {
        Assert.Equal("Mám 3 psy", Cs.NormalizeCzech("Mám 3 psy"));
        Assert.Equal("Je to Karel čtvrtý a jeho", Cs.NormalizeCzech("Je to Karel 4 a jeho"));
    }

    [Fact]
    public void CsTheDateKeepsASentenceFinalPeriod()
    {
        Assert.Equal("Bylo to dne pátého pátého.", Cs.NormalizeCzech("Bylo to dne 5. 5."));
        Assert.Matches(" \\.$", P("Bylo to dne 5. 5.", "cs"));
    }

    [Fact]
    public void CsAClosingAbbreviationBeforeACapitalKeepsItsDot()
    {
        Assert.Equal("slovo a tak dále. Potom.", Cs.NormalizeCzech("slovo atd. Potom."));
        Assert.Equal("a tak dále potom", Cs.NormalizeCzech("atd. potom"));
        Assert.Equal("doktor Novák", Cs.NormalizeCzech("Dr. Novák"));
        Assert.Equal("stojí 50 milionů Kč", Cs.NormalizeCzech("stojí 50 mil. Kč"));
    }

    [Fact]
    public void CsTheCenturyLocativeNeedsThePreposition()
    {
        Assert.Equal("Město Kyjev dvanáctého století", Cs.NormalizeCzech("Město Kyjev 12. století"));
        Assert.Equal("ve dvanáctém století", Cs.NormalizeCzech("ve 12. století"));
    }

    [Fact]
    public void CsAFractionWithAnyNumeratorIsRead()
    {
        Assert.Equal("dvě třetí a čtyři páté a pět osmých a dvacetjedna stých", Cs.NormalizeCzech("2/3 a 4/5 a 5/8 a 21/100"));
        Assert.Equal("jedna pátá", Cs.NormalizeCzech("1/5"));
        Assert.Contains("krˈaːt", P("29¾ x 24½", "cs"));
    }

    [Fact]
    public void CsDecomposedInputReadsLikeComposed()
    {
        Assert.Equal(P("děti", "cs"), P("děti", "cs"));
        Assert.Equal(P("Něco", "cs"), P("Něco", "cs"));
        Assert.Equal("ɟˈɛcɪ", P("děti", "cs"));
    }

    // ── Slovak ───────────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public void SkAnOutOfRangeListItemKeepsOneComma() =>
        Assert.Equal("V 1000., piatom storočí.", Sk.NormalizeSlovak("V 1000., 5. storočí."));

    [Fact]
    public void SkAClosingAbbreviationBeforeACapitalKeepsItsDot()
    {
        Assert.Equal("a tak ďalej. Potom.", Sk.NormalizeSlovak("Atď. Potom."));
        Assert.Equal("a tak ďalej potom", Sk.NormalizeSlovak("atď. potom"));
        Assert.Equal("doktor Novák", Sk.NormalizeSlovak("Dr. Novák"));
    }

    [Fact]
    public void SkDecomposedInputReadsLikeComposed()
    {
        Assert.Equal(P("ľad", "sk"), P("ľad", "sk"));
        Assert.Equal("ʎˈat", P("ľad", "sk"));
    }

    // ── Belarusian ───────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public void BeAFoldedNearMissIsLeftAloneInAllThreeArms()
    {
        Assert.Equal("гэта ᲃт. слова", Be.NormalizeBelarusian("гэта ᲃт. слова"));
        Assert.Equal("гэта ᲃт., слова", Be.NormalizeBelarusian("гэта ᲃт., слова"));
        Assert.Equal("гэта ᲃт.", Be.NormalizeBelarusian("гэта ᲃт."));
        Assert.DoesNotContain("ˌʌndɪfˈaᶦnd", P("гэта ᲃт. слова", "be"));
    }

    [Fact]
    public void BeAFractionBeforeAFullStopOrACommaIsRead()
    {
        Assert.Equal("адна другая.", Be.NormalizeBelarusian("1/2."));
        Assert.Equal("пяць восьмых, і", Be.NormalizeBelarusian("5/8, і"));
        Assert.Equal("29/30.10.1937", Be.NormalizeBelarusian("29/30.10.1937"));
    }

    [Fact]
    public void BeAListClosingAbbreviationBeforeACapitalKeepsItsDot()
    {
        Assert.Equal("кнігі і іншае. Потым", Be.NormalizeBelarusian("кнігі і інш. Потым"));
        Assert.Equal("кнігі і гэтак далей. Потым", Be.NormalizeBelarusian("кнігі і г.д. Потым"));
        Assert.Equal("глядзі Потым", Be.NormalizeBelarusian("Гл. Потым"));
        Assert.Equal("у 1990 года Потым", Be.NormalizeBelarusian("у 1990 г. Потым"));
    }

    // ── Bulgarian ────────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public void BgGraveLettersAreRead()
    {
        Assert.Equal("i i kaza", P("и ѝ каза", "bg"));
        Assert.Equal("iɛ", P("ЍЀ", "bg"));
    }

    [Fact]
    public void BgMagnitudeAbbreviationsAreExpanded()
    {
        Assert.Equal("1 цяло и 5 милиона души", Bg.NormalizeBulgarian("1,5 млн. души"));
        Assert.Equal("340000000 до 500", Bg.NormalizeBulgarian("340 млн. до 500"));
        Assert.Equal("общо 2000000000.", Bg.NormalizeBulgarian("общо 2 млрд."));
    }

    [Fact]
    public void BgTheOrdinalSuffixPicksTheFormEndingWithIt()
    {
        Assert.Equal("първи, втори, трети, четвърто, пета, седми, петнайсето, трийсет и седмата, сто и деветдесето, двайсет и първи, единайсети, първия",
            Bg.NormalizeBulgarian("1-ви, 2-ри, 3-ти, 4-о, 5-та, 7-ми, 15-то, 37-ата, 190-то, 21-ви, 11-и, 1-вия"));
        Assert.Equal("pɤrvi kɫas", P("1-ви клас", "bg"));
        Assert.Equal("50-те години", Bg.NormalizeBulgarian("50-те години"));
        Assert.Equal("28-годишен", Bg.NormalizeBulgarian("28-годишен"));
    }

    [Fact]
    public void BgTheHourAbbreviationAfterAClockIsRead()
    {
        Assert.Equal("в 12 05 часа.", Bg.NormalizeBulgarian("в 12:05 ч."));
        Assert.Equal("в 12 00 часа GMT", Bg.NormalizeBulgarian("в 12:00 ч. GMT"));
        Assert.Equal("в 10 00 часа сутринта", Bg.NormalizeBulgarian("в 10:00 ч.сутринта"));
    }

    // ── Macedonian ───────────────────────────────────────────────────────────────────────────────────
    [Fact]
    public void MkARussianSpelledNameIsReadWhole()
    {
        Assert.Equal(P("Јуриј Гагарин", "mk"), P("Юрий Гагарин", "mk"));
        Assert.Equal("jˈurij ɡˈaɡarin", P("Юрий Гагарин", "mk"));
        Assert.Equal("ʃtˈukin , nˈatalja , jˈɔɫkin", P("Щукин, Наталья, Ёлкин", "mk"));
    }

    [Fact]
    public void MkItnBeforeACapitalKeepsItsDot()
    {
        Assert.Equal("и така натаму. Потоа", Mk.NormalizeMacedonian("итн. Потоа"));
        Assert.Equal("и така натаму потоа", Mk.NormalizeMacedonian("итн. потоа"));
    }

    [Fact]
    public void MkAFractionWithAnyNumeratorIsRead()
    {
        Assert.Equal("две третини од нив", Mk.NormalizeMacedonian("2/3 од нив"));
        Assert.Equal("една петтина и дваесет и една половина и единаесет третини", Mk.NormalizeMacedonian("1/5 и 21/2 и 11/3"));
    }

    [Fact]
    public void MkTheRegnalRuleSkipsASentencesFirstWord()
    {
        Assert.Equal("Македонија 2.", Mk.NormalizeMacedonian("Македонија 2."));
        Assert.Equal("главатар Лиалофи трети.", Mk.NormalizeMacedonian("главатар Лиалофи 3."));
    }
}
