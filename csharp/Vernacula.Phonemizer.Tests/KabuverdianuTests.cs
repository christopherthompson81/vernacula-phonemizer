/**
 * The portable half of test/kabuverdianu.test.ts — Kabuverdianu / kriolu (kea), Cape Verdean Creole
 * (Portuguese-lexified), the ALUPEC/AK phonemic orthography, Santiago variety. A greedy ALUPEC scan
 * (digraphs dj/tx/nh/lh/rr) + Portuguese-creole nasalization + accent/penult-or-oxytone stress, anchored
 * on the 7 independent kaikki IPA words (the whole of the independent evidence).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Kabuverdianu;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KabuverdianuTests
{
    private static string Word(string s) => KabuverdianuPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "kea").Trim();
    private static string Norm(string s) => Normalize.NormalizeKabuverdianu(s);

    [Theory]
    // The 7 kaikki IPA anchor words — the whole of the independent evidence (segments verified; ˈ at the nucleus).
    [InlineData("kobra", "kˈobɾɐ")]
    [InlineData("kóbra", "kˈɔbɾɐ")]
    [InlineData("diskabresta", "diskɐbɾˈestɐ")]
    [InlineData("barkinu", "bɐɾkˈinu")]
    [InlineData("tabanka", "tɐbˈãŋkɐ")]
    [InlineData("talóti", "tɐlˈɔti")]
    [InlineData("sénpri", "sˈɛ̃pɾi")]
    public void TheSevenKaikkiAnchorWords(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ALUPEC digraphs: ⟨dj⟩→d͡ʒ, ⟨tx⟩→t͡ʃ, ⟨nh⟩→ɲ, ⟨lh⟩→ʎ; ⟨x⟩→ʃ, ⟨j⟩→ʒ.
    [InlineData("fidju", "fˈid͡ʒu")]
    [InlineData("txeu", "t͡ʃˈeu")]
    [InlineData("nha", "ɲˈɐ")]
    [InlineData("palha", "pˈɐʎɐ")]
    [InlineData("xinti", "ʃˈĩti")]
    public void AlupecDigraphs(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // A coda ⟨n/m⟩ nasalizes the vowel (bon→bõ, un→ũ) and is absorbed word-finally.
    [InlineData("bon", "bˈõ")]
    [InlineData("un", "ˈũ")]
    public void NasalizationAbsorbsWordFinal(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // OXYTONE when a word ends in a consonant (Ibero default); penult when it ends in a vowel/-s.
    [InlineData("mudjer", "mud͡ʒˈeɾ")]
    [InlineData("amor", "ɐmˈoɾ")]
    [InlineData("algen", "ɐlɡˈẽ")]
    [InlineData("mininu", "minˈinu")]
    public void StressIsPenultOrOxytone(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Falling diphthongs (oi/ou…): the offglide is not a stress-bearing nucleus.
    [InlineData("oitu", "ˈoitu")]
    [InlineData("noiti", "nˈoiti")]
    public void FallingDiphthongOffglidesAreNotNuclei(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void ClauseAssembly() => Assert.Equal("bˈõ dˈiɐ , kˈɐbu vˈeɾdi !", Say("Bon dia, Kabu Verdi!"));

    [Theory]
    // Cardinals — fully decimal; the tens JUXTAPOSE with their unit (no connector); 16–19 the analytic
    // Portuguese-style ⟨diza-⟩ series; 10⁹ = "mil milion" (Pt "mil milhões").
    [InlineData(7, "seti")]
    [InlineData(16, "dizasais")]
    [InlineData(21, "vinti un")]
    [InlineData(31, "trinta un")]
    [InlineData(100, "sen")]
    [InlineData(555, "kinhentus sinkuenta sinku")]
    [InlineData(12345, "duzi mil trezentus korenta sinku")]
    [InlineData(1000000, "un milion")]
    [InlineData(1000000000, "mil milion")]
    public void Cardinals(double n, string want) => Assert.Equal(want, Numbers.NumberToWords(n));

    [Theory]
    // Numbers read through the g2p (nasalization + accent-or-penult stress).
    [InlineData("21", "vˈĩti ˈũ")]
    [InlineData("100", "sˈẽ")]
    [InlineData("0", "zˈɛɾu")]
    public void NumbersReadThroughTheG2p(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // The grouping dot was read as a full stop — the defect that motivates the layer, invisible to DROP.
    [InlineData("Kes satélitis ta peza más di 1.000 libras", "mˈil lˈibɾɐs")]
    [InlineData("ta okupa 783.562 kilómitrus", "setisˈẽtus oitˈẽtɐ tɾˈes mˈil kiɲˈẽtus sɐsˈẽtɐ dˈos")]
    [InlineData("atrai 5.000.000 vizitantis", "sˈĩŋku miliˈõ")]
    public void TheGroupingDotIsNotAFullStop(string input, string want) => Assert.Contains(want, Say(input));

    [Theory]
    // BOTH marks group and BOTH decimate — the Papiamento finding reproduces, with the dominance inverted.
    [InlineData("Ku 17,000 ilhas pa skodje", "dizɐsˈeti mˈil ˈiʎɐs")]
    [InlineData("kintu y sestu ku 2,220 y 2,207 pontus", "dˈos mˈil duzˈẽtus vˈĩti")]
    [InlineData("un populason di serka di 3,7 milhon", "tɾˈes sˈeti miʎˈõ")]
    [InlineData("na frikuénsia di 2.4Ghz", "dˈos kuˈɐtu")]
    public void BothMarksGroupAndBothDecimate(string input, string want) => Assert.Contains(want, Say(input));

    [Theory]
    // No decimal word is sourceable, so the mark is spent on a space rather than spoken.
    [InlineData("14,7 mil milhon di dóla", "kɐtˈoɾzi sˈeti mˈil miʎˈõ dˈi dˈɔlɐ")]
    public void TheDecimalMarkIsSpentOnASpace(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // The percent word is `pur sentu`; `AUD$` needs its own key, and `£` is the pound.
    [InlineData("subi 8% konparadu ku 2008", "ˈoitu pˈuɾ sˈẽtu")]
    [InlineData("na dá más di AUD$45 milhon", "koɾˈẽtɐ sˈĩŋku miʎˈõ dˈi dˈɔlɐ")]
    [InlineData("pa un taxa di £27 milhon", "vˈĩti sˈeti miʎˈõ dˈi lˈibɾɐ")]
    public void PercentCurrencyAndTheAudComposite(string input, string want) => Assert.Contains(want, Say(input));

    [Theory]
    // The colon is a clock here, 17 of 20; the two-digit minute is the whole guard; trap 58 on the clock.
    [InlineData("JAS 39C Gripen kai pur volta di 9:30 óra lokal", "nˈovi tɾˈĩtɐ ˈɔɾɐ lokˈɐl")]
    [InlineData("ta sai entri 06:30 y 07:30", "sˈɐis tɾˈĩtɐ ˈi sˈeti tɾˈĩtɐ")]
    [InlineData("el konsigi un 2:2", "dˈos , dˈos")]
    [InlineData("11:20, pulísia pidi manifestantis", "ˈõzi vˈĩti , pulˈisiɐ")]
    public void TheColonIsAClock(string input, string want) => Assert.Contains(want, Say(input));

    [Theory]
    // `º` U+00BA is the ordinal indicator here — the opposite of the Aragonese/Asturian finding.
    [InlineData("dispunivel na 1º dia di mês", "pɾimˈɛɾu dˈiɐ")]
    [InlineData("tinha 1º y 3º rijimentus", "pɾimˈɛɾu ˈi teɾsˈeɾu ɾiʒimˈẽtus")]
    [InlineData("ku tenperatura na 90º.", "novˈẽtɐ ɡɾˈɐu")]
    public void TheOrdinalIndicator(string input, string want) => Assert.Contains(want, Say(input));

    [Theory]
    // The ordinal refusals, pinned: above 10 and the feminine `ª` are left exactly as they read before.
    [InlineData("ta faze del 37º país más grandi", "tɾˈĩtɐ sˈeti pɐˈis")]
    [InlineData("Se 1.000º selu foi magnífiku", "mˈil sˈelu")]
    [InlineData("ta tornai Japon 7ª maior ilha", "sˈeti mɐiˈoɾ ˈiʎɐ")]
    public void TheOrdinalRefusals(string input, string want) => Assert.Contains(want, Say(input));

    [Fact]
    public void TheOrdinalRefusalLeavesNoDegree() => Assert.DoesNotContain("ɡɾˈɐu", Say("ta faze del 37º país más grandi"));

    [Theory]
    // The degree word is `grau`, and BOTH the scale letter and the compass letter are deliberately left.
    [InlineData("tenperaturas riba di +30°C é kumun", "tɾˈĩtɐ ɡɾˈɐu")]
    [InlineData("gravadu na lesti di 35°W.", "tɾˈĩtɐ sˈĩŋku ɡɾˈɐu")]
    public void TheDegreeWord(string input, string want) => Assert.Contains(want, Say(input));

    [Theory]
    // The era marker, composed from attested pieces, and `E.D.C.` deliberately untouched.
    [InlineData("kel ténplu rikonstruidu na 323 a.C.", "ˈãtis dˈi kɾˈistu")]
    [InlineData("kumesa na serka di 400 D.C. y dura", "dipˈos dˈi kɾˈistu")]
    public void TheEraMarker(string input, string want) => Assert.Contains(want, Say(input));

    [Fact]
    public void TheDottedEraIsLeftWhole() => Assert.DoesNotContain("kɾˈistu", Say("ki txiga pur volta di 10.000 E.D.C."));

    [Theory]
    // Units read through the shared tier, and the incomplete table is the point (`mm`/`kg` refused).
    [InlineData("Krosta ten serka di 70 km di grosura", "setˈẽtɐ kilˈɔmitɾu")]
    [InlineData("un piku di 4892 m na Monti Vinson", "mˈɛtɾu")]
    [InlineData("Kel parki ten 19.500 km²", "dizɐnˈovi mˈil kiɲˈẽtus kilˈɔmitɾu kuɐdɾˈɐdu")]
    [InlineData("Kel formatu 35mm é meiu konfuzu", "tɾˈĩtɐ sˈĩŋku mm")]
    public void UnitsThroughTheSharedTier(string input, string want) => Assert.Contains(want, Say(input));

    [Theory]
    // The range mark is the ASCII hyphen and a doubled one, never an en dash; the dash is spent on a pause.
    [InlineData("kubertu pa 2-3 km di jélu", "dˈos , tɾˈes kilˈɔmitɾu")]
    [InlineData("Kel Luno tinha 120--160 métrus kúbikus", "sˈẽ vˈĩti , sˈẽ sɐsˈẽtɐ mˈɛtɾus")]
    [InlineData("bai ku sonu poku ténpu dipôs (10-60 minotu).", "dˈɛs , sɐsˈẽtɐ minˈotu")]
    public void TheRangeMark(string input, string want) => Assert.Contains(want, Say(input));

    [Fact]
    // The ampersand spends the corpus's own conjunction; the number sign gets its own word.
    public void AmpersandAndNumberSign()
    {
        Assert.Contains("b ˈi bs", Say("La di riba, B&Bs ta konpiti"));
        Assert.Contains("nˈumeɾu ˈõzi", Say("konxedu pa kosmonauta Nº 11"));
    }

    [Fact]
    // The invariant: a sentence with no figure in it is byte-identical through the normalizer, and the
    // ALUPEC ⟨y⟩ coordinator survives the ampersand rule untouched.
    public void NothingBitesAnOrdinarySentence()
    {
        const string plain = "Agu di tornera é perfetamenti siguru pa bébe, mas agu engarafadu é fasil di atxa.";
        Assert.Equal(plain, Norm(plain));
        Assert.Contains("ˈi ˈũ", Say("dôs átumu di idrojéniu y un átumu di oksijéniu"));
    }
}
