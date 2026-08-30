// The portable half of test/hmong.test.ts — Hmong (hmn), White Hmong / Hmoob Dawb. An RPA → IPA converter:
// RPA has NO codas, so a final ⟨b j v s g m d⟩ is always a TONE marker.
using System.Text.RegularExpressions;
using Vernacula.Phonemizer;
using HmEngine = Vernacula.Phonemizer.Languages.Hmong.HmongPhonemizer;
using HmNormalize = Vernacula.Phonemizer.Languages.Hmong.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class HmongTests
{
    private static readonly ILanguage Hmn = HmEngine.CreateHmong();

    // The normalizer section's `say` — the engine's own text() with whitespace collapsed, mirroring the TS.
    private static string NormSay(string s)
    {
        var t = Hmn.Text(s);
        return Regex.Replace(t, @"\s+", " ").Trim();
    }

    // The raw-Latin section's `say` — the full registry path (roman conversion, foreign reader), mirroring the TS.
    private static string Say(string s) => Phonemizer.Phonemize(s, "hmn").Trim();

    [Theory]
    // The final consonant LETTER marks tone (no codas): b/j/v/s/g/m/d + none.
    [InlineData("teb", "te˥")]
    [InlineData("caij", "cai̯˥˧")]
    [InlineData("kuv", "ku˧˦")]
    [InlineData("lus", "lu˩")]
    [InlineData("cag", "ca˧˩̤")]
    [InlineData("cai", "cai̯˧")]
    public void TheFinalConsonantMarksTone(string word, string want) => Assert.Equal(want, HmEngine.PhonemizeWord(word));

    [Theory]
    // The rich onset system: prenasalised, voiceless sonorants, retroflex, uvular.
    [InlineData("npua", "ᵐbuə̯˧")]
    [InlineData("ntxhai", "ⁿt͡sʰai̯˧")]
    [InlineData("hlub", "l̥u˥")]
    [InlineData("Hmoob", "m̥ɒ̃˥")]
    public void TheOnsetSystem(string word, string want) => Assert.Equal(want, HmEngine.PhonemizeWord(word));

    [Theory]
    // ⟨tx x⟩ PALATALISE to [t͡ɕ ɕ] before /i/; a vowel-initial syllable takes glottal [ʔ].
    [InlineData("txiv", "t͡ɕi˧˦")]
    [InlineData("txab", "t͡sa˥")]
    [InlineData("ib", "ʔi˥")]
    [InlineData("nrhiav", "ᶯʈʰiə̯˧˦")]
    public void PalatalAndGlottal(string word, string want) => Assert.Equal(want, HmEngine.PhonemizeWord(word));

    [Fact]
    public void ClauseAssembly() =>
        Assert.Equal("ku˧˦ hai̯˩ lu˩ m̥ɒ̃˥ .", NormSay("Kuv hais lus Hmoob.")); // "I speak Hmong"

    [Theory]
    // Cardinal numbers — decimal and analytic. 11–19 are kaum + unit; 20 is the irregular two-word
    // nees nkaum; 30–90 are unit + caug (30/40/50) or caum (60–90). A magnitude ALWAYS carries its
    // multiplier, incl. "one" (ib puas, ib txhiab, ib roob).
    [InlineData(0, "sɒ̃˩̰")]
    [InlineData(7, "ça˧")]
    [InlineData(10, "kau̯˩̰")]
    [InlineData(11, "kau̯˩̰ ʔi˥")]
    [InlineData(20, "nẽ˩ ᵑɡau̯˩̰")]
    [InlineData(21, "nẽ˩ ᵑɡau̯˩̰ ʔi˥")]
    [InlineData(42, "pˡau̯˥ cau̯˧˩̤ ʔɒ˥")]
    [InlineData(100, "ʔi˥ puə̯˩")]
    [InlineData(1000, "ʔi˥ t͡sʰiə̯˥")]
    [InlineData(12345, "kau̯˩̰ ʔɒ˥ t͡sʰiə̯˥ pe˥ puə̯˩ pˡau̯˥ cau̯˧˩̤ t͡ʂi˥")]
    [InlineData(1000000, "ʔi˥ ʈɒ̃˥")]
    public void CardinalNumbers(double n, string want) => Assert.Equal(want, NormSay(n.ToString()));

    [Theory]
    // THE LAYER'S DEFINING RULE: the separator is decided by the TAIL LENGTH, for BOTH marks.
    [InlineData("23,822,747", "23822747")]
    [InlineData("146.270.033", "146270033")]
    [InlineData("8,46 lab", "8 4 6 lab")]
    [InlineData("2.9 lab", "2 9 lab")]
    // The version-dot guard: a dotted designation has a LETTER after its tail, so the decimal rule refuses it.
    [InlineData("802.11n", "802.11n")]
    // ⚠ THE STATED COST: a 3-place decimal de-groups.
    [InlineData("3.141", "3141")]
    // No rule bites a tone letter off an RPA word; the hyphenated proper nouns are not ranges.
    [InlineData("Aus-rab-lias", "Aus-rab-lias")]
    [InlineData("ib lab duas", "ib lab duas")]
    [InlineData("2.7 vam", "2 7 vam")]
    // Ranges are GLUED and ASCENDING only.
    [InlineData("1438-1806", "1438 mus rau 1806")]
    [InlineData("1859–1917", "1859 mus rau 1917")]
    [InlineData("Pejxeem - 146.270.033 neeg", "Pejxeem - 146270033 neeg")]
    [InlineData("Papua - Tshiab Guinea", "Papua - Tshiab Guinea")]
    [InlineData("1806-1438", "1806-1438")]
    // Percent is `feem pua`, postposed; the ordering that makes `5-10%` come out right.
    [InlineData("60%", "60 feem pua")]
    [InlineData("5-10%", "5 mus rau 10 feem pua")]
    // Currency is `duas`, postposed, with the magnitude kept in place; `US` consumed.
    [InlineData("$10 lab", "10 lab duas")]
    [InlineData("US$30", "30 duas")]
    [InlineData("US $ 46,330", "46330 duas")]
    // `° C` is consumed unread; the coordinate `°` is left alone.
    [InlineData("25 ° C", "25")]
    [InlineData("ntawm 50 ° N. M.", "ntawm 50 ° N. M.")]
    // The kilometre: the ASCII exponent folds onto `km²`, de-grouped first, then the unit is read.
    [InlineData("9,85 lab km2", "9 8 5 lab kis lus mev")]
    [InlineData("10 km", "10 kis lus mev")]
    [InlineData("tsuas yog 145 km deb", "tsuas yog 145 kis lus mev deb")]
    [InlineData("(362 km) rau", "(362 kis lus mev) rau")]
    [InlineData("17.125.187 km²", "17125187 kis lus mev")]
    // The unit key never bites an RPA word, and the bare token now reads (the shared bare-unit path).
    [InlineData("koom kaum kev", "koom kaum kev")]
    [InlineData("km", "kis lus mev")]
    [InlineData("kev km", "kev kis lus mev")]
    // The ampersand is `thiab`, and it restores the token boundary.
    [InlineData("A & B", "A thiab B")]
    [InlineData("A&B", "A thiab B")]
    // The refusals: omitting a minus inverts, so the minus is left silent (and stays out of the silence ledger).
    [InlineData("-71,2 ° C", "-71 2")]
    [InlineData("+45,4 ° C", "+45 4")]
    public void TheNormalizer(string input, string want) => Assert.Equal(want, HmNormalize.NormalizeHmong(input));

    [Theory]
    [InlineData("2.9 lab", "ʔɒ˥ cuə̯˥˧ la˥")]
    [InlineData("Hmoob", "m̥ɒ̃˥")]
    [InlineData("60%.", "ʈau̯˧ cau̯˩̰ fẽ˩̰ puə̯˧ .")]
    [InlineData("$10 lab", "kau̯˩̰ la˥ duə̯˩")]
    [InlineData("1 mus rau 25 ° C", "ʔi˥ mu˩ ʈau̯˧ nẽ˩ ᵑɡau̯˩̰ t͡ʂi˥")]
    [InlineData("10 km", "kau̯˩̰ ki˩ lu˩ me˧˦")]
    [InlineData("koom", "kɒ̃˩̰")]
    public void TheReading(string input, string want) => Assert.Equal(want, NormSay(input));

    [Fact]
    public void Km2DoesNotReadTheExponentAsACardinal() =>
        Assert.DoesNotContain("ʔɒ˥", NormSay("357.021 km2"), StringComparison.Ordinal);

    [Fact]
    public void KmDoesNotLeakRaw() =>
        Assert.DoesNotContain("km", NormSay("10 km"), StringComparison.Ordinal);

    [Fact]
    public void RomanNumeralsAreDigitsByTheTimeTheLayerRuns() =>
        Assert.Equal("ʔɒ˥", Say("II")); // `ob`, two — not two letters. ⚠ THROUGH phonemize, not text().

    [Fact]
    public void ASolidWrittenPolysyllableReadsAsItsSyllables()
    {
        Assert.Equal(Say("teb chaws"), Say("tebchaws")); // "country" — solid and spaced read the SAME
        Assert.Equal("te˥ cʰaɨ̯˩", Say("tebchaws"));
        Assert.Equal(Say("los sis"), Say("lossis"));
        Assert.Equal(Say("hauj lwm"), Say("haujlwm"));
        Assert.Equal(Say("qhov ntsej"), Say("qhovntsej"));
        Assert.Equal(Say("fab kis"), Say("Fabkis"));
        Assert.Equal(Say("nyab laj suav teb los tsuas"), Say("Nyablaj Suavteb Lostsuas"));
    }

    [Fact]
    public void ARunThatDoesNotTileIsNotReadAsHmong()
    {
        Assert.DoesNotContain("˧", Say("Cantonese"), StringComparison.Ordinal); // ca·nto·ne·se is legal RPA, NOT Hmong
        Assert.Equal(Say("Cantonese"), Say("Cantonese").ToLowerInvariant()); // …it is read, though — no capitals
        Assert.Equal(Phonemizer.Phonemize("kevcai", "en").Trim(), Say("kevcai")); // the stated COST: `cai` is unmarked
    }

    [Fact]
    public void ARunThatIsNotRpaIsReadNotEchoed()
    {
        Assert.Equal("kɹˈɑːkəd̬ˌaᶦɫ dəndˈiː", Say("Crocodile Dundee"));
        Assert.Equal("juːnˈaᶦt̬ᵻd nˈeᶦʃənz", Say("United Nations"));
        // THE INVARIANT: no ASCII capital may reach the IPA.
        Assert.DoesNotMatch("[A-Z]", Say("\"Crocodile\" Dundee yog ib xyoo 1986 Australian American romantic comedy"));
    }

    [Fact]
    public void InitialismsGetEnglishLetterNames()
    {
        Assert.Equal("bˌiːbisˈiː", Say("BBC"));
        Assert.Equal("ɡˈiːdˈiːpʰˈiː", Say("GDP"));
        Assert.Equal("ˈɛɫ . ˈɛɫ . zˈæmənhf", Say("L. L. Zamenhof"));
    }

    [Fact]
    public void OrdinaryRpaIsUntouched() =>
        Assert.Equal("ku˧˦ hai̯˩ lu˩ m̥ɒ̃˥ .", Say("Kuv hais lus Hmoob."));
}
