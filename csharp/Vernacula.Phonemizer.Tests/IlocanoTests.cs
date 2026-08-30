/**
 * The portable half of test/ilocano.test.ts — Ilocano / Iloko (ilo), Austronesian (Northern Luzon,
 * Ilocano subgroup — NOT Bisayan), Latin. TWO paths: PhonemizeWordRules = the non-circular RULE g2p
 * (what the referee eval measures); PhonemizeWord = the shipped path (a stress-marked-referee lexicon
 * first, then the rule). The rule's Ilocano-distinctive HIATUS: a HIGH vowel ⟨i u⟩ before a vowel
 * GLIDES (dua→dwa, radio→ɾadjo); whether a high vowel glides vs stays syllabic is LEXICAL, and the
 * lexicon carries that.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Ilocano;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class IlocanoTests
{
    private static string Rules(string s) => IlocanoPhonemizer.PhonemizeWordRules(s);
    private static string Word(string s) => IlocanoPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "ilo").Trim();

    [Theory]
    // HIGH-vowel GLIDING hiatus: i→j, u→w before a vowel — the split from Bisayan.
    [InlineData("dua", "dwˈa")]        // ⟨u⟩ before a → w
    [InlineData("radio", "ɾˈadjo")]    // ⟨i⟩ before o → j
    [InlineData("dies", "djˈɛs")]      // ⟨i⟩ before e → j; ⟨e⟩→ɛ
    public void HighVowelGlidingHiatus(string word, string want) => Assert.Equal(want, Rules(word));

    [Theory]
    // NON-high hiatus keeps the glottal; word-initial glottal.
    [InlineData("tao", "tˈaʔo")]            // a+o hiatus → glottal
    [InlineData("naimbag", "naʔˈimbaɡ")]    // a+i hiatus glottal
    [InlineData("agtutubo", "ʔaɡtutˈubo")]  // word-initial glottal
    public void NonHighHiatusKeepsTheGlottal(string word, string want) => Assert.Equal(want, Rules(word));

    [Theory]
    // The shipped LEXICON path fixes the lexical residual: the stressed high vowel STAYS syllabic
    // (what the rule can't derive).
    [InlineData("garcia", "ɡaɾsˈia")]      // i STAYS (rule wrongly glides)
    [InlineData("kua", "kuˈa")]            // u STAYS (rule → kwa)
    [InlineData("biblioteka", "bibliotˈɛka")] // io STAYS (rule → bibljo…)
    public void TheLexiconFixesTheLexicalResidual(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    // OOV falls back to the rule g2p.
    public void OovFallsBackToTheRuleG2p() => Assert.Equal(Rules("zzqx"), Word("zzqx"));

    [Fact]
    public void RegistryWiring() => Assert.Equal("sˈɛɾo", Say("0"));

    [Theory]
    // Units and the tens (fused vs. the 'a' ligature).
    [InlineData(0, "sˈɛɾo")]                    // sero (Spanish loan; native "awan" is 'none', not a numeral)
    [InlineData(5, "lˈima")]                    // lima
    [InlineData(20, "dwapˈulo")]                // duapulo — vowel-final dua FUSES (⟨u⟩ glides → dw)
    [InlineData(40, "ʔˈuppat ʔˈa pˈulo")]       // uppat a pulo — consonant-final → ligature
    // Compounds 11-99 chain with ket.
    [InlineData(11, "saŋapˈulo kˈɛt mˈajsa")]   // sangapulo ket maysa
    [InlineData(25, "dwapˈulo kˈɛt lˈima")]     // duapulo ket lima
    [InlineData(99, "sjˈam ʔˈa pˈulo kˈɛt sjˈam")] // siam a pulo ket siam
    // Hundreds / thousands / millions (sanga- for 1).
    [InlineData(100, "saŋaɡˈasut")]             // sangagasut
    [InlineData(101, "saŋaɡˈasut kˈɛt mˈajsa")] // sangagasut ket maysa
    [InlineData(555, "limaɡˈasut kˈɛt limapˈulo kˈɛt lˈima")] // limagasut ket limapulo ket lima
    [InlineData(1000, "saŋaɾˈibo")]            // sangaribo
    [InlineData(1000000, "saŋaɾˈiwɾiw")]       // sangariwriw
    public void CardinalNumbers(double n, string want) => Assert.Equal(want, Say(n.ToString()));

    [Fact]
    // The native series tops out at riwriw → ≥10⁹ reads digit-by-digit.
    public void TheNativeSeriesTopsOutAtRiwriw() =>
        Assert.Equal(10, Say("1000000000").Split(' ').Length); // maysa sero sero … (documented fallback)

    [Fact]
    // ⚠ THE NUMBERED ORDER IS LOAD-BEARING — pinned as text, where the coupling is visible.
    public void TheNumberedOrderIsLoadBearing()
    {
        // ⚠ RANGES ABOVE DECIMALS. With the decimal rule first this reads `3 punto 5–3 punto 8`, and the
        // range rule then claims `5–3` — a backwards span from inside a number (the hil finding).
        Assert.Equal("3 punto 5 aginggana iti 3 punto 8 bilion", Normalize.NormalizeIlocano("3.5–3.8 bilion"));
        // ⚠ DE-GROUPING FIRST, or the tier sees `578 km²` in `676,578 km²` and the range rule can match a
        // grouping comma.
        Assert.Equal("Iti 676578 kuadrado kilometro", Normalize.NormalizeIlocano("Iti 676,578 km²"));
        // ⚠ THE TIER ABOVE THE DECIMAL RULE is what keeps `NOT_VERSION` armed for the one-letter `m` key:
        // `802.11m` must therefore NOT become eleven metres, while `12.5 km` must still read.
        Assert.Equal("ti 12 punto 5 kilometro ken 802 punto 1 1m", Normalize.NormalizeIlocano("ti 12.5 km ken 802.11m"));
    }

    [Theory]
    // De-grouping and the decimal point — the two rules that carry ~3,760 instances.
    [InlineData("populasion iti 822,352",
        "populˈasjon ʔˈiti waloɡˈasut kˈɛt dwapˈulo kˈɛt dwˈa ʔˈa ɾˈibo kˈɛt talloɡˈasut kˈɛt limapˈulo kˈɛt dwˈa")]
    [InlineData("May 302.18 kilometro",
        "mˈaj talloɡˈasut kˈɛt dwˈa pˈunto mˈajsa wˈalo kilomˈɛtɾo")]
    // Both at once, in that order: the de-grouping guard must let a group through when its decimal point follows.
    [InlineData("1,497.70 kuadrado kilometro",
        "saŋaɾˈibo kˈɛt ʔˈuppat ʔˈa ɡasˈut kˈɛt sjˈam ʔˈa pˈulo kˈɛt pˈito pˈunto pˈito sˈɛɾo kwadɾˈado kilomˈɛtɾo")]
    // ⚠ THE DIGIT-LIST MUST SURVIVE: one digit per group; the `{3}` in the de-grouping rule is what refuses it.
    [InlineData("aggibus iti 0,1,8,9", "ʔaɡɡˈibus ʔˈiti sˈɛɾo , mˈajsa , wˈalo , sjˈam")]
    public void DeGroupingAndTheDecimalPoint(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // ⚠ THE THREE-DIGIT FRACTIONAL PART IS NOT CLAIMED — the two-digit cap, pinned from the opposite side.
    public void TheThreeDigitFractionalPartIsNotClaimed() => Assert.DoesNotContain("pˈunto", Say("17.865"));

    [Theory]
    // ⚠ THE CLOCK'S GUARD IS THE RULE — 205 colon-numbers, ~23 clocks.
    // Arm (a): a following AM/PM/GMT/UTC. The colon was a pause plus a phantom *sero*.
    [InlineData("manipud iti 6:00 AM", "manˈipud ʔˈiti ʔinnˈɛm ʔˈam")]
    // Arm (b): a following part-of-day. Minutes join with the manifest's own connector `ket`.
    [InlineData("iti 8:16 ti agsapa", "ʔˈiti wˈalo kˈɛt saŋapˈulo kˈɛt ʔinnˈɛm tˈi ʔaɡsˈapa")]
    // Arm (c): a preceding `oras a`.
    [InlineData("iti oras a 6:30 aginggana", "ʔˈiti ʔˈoɾas ʔˈa ʔinnˈɛm kˈɛt tallopˈulo ʔaɡiŋɡˈana")]
    public void TheClocksGuardIsTheRule(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // ⚠ A UTC OFFSET — the leading-sign guard is what refuses it.
    public void TheUtcOffsetIsNotAClock()
    {
        Assert.DoesNotContain("kˈɛt wˈalo kˈɛt", Say("Ti UTC+08:00 ket"));
        Assert.Equal("tˈi ʔˈutk wˈalo , sˈɛɾo kˈɛt", Say("Ti UTC+08:00 ket"));
    }

    [Theory]
    // ⚠ A SCRIPTURE REFERENCE, and a RATIO (flag proportions) — the other two non-clock classes.
    [InlineData("naibasar iti Juan 13:21",
        "naʔibˈasaɾ ʔˈiti hwˈan saŋapˈulo kˈɛt tˈallo , dwapˈulo kˈɛt mˈajsa")]
    [InlineData("ti ratio ket 5:8", "tˈi ɾˈatjo kˈɛt lˈima , wˈalo")]
    public void TheNonClockColonShapesStayPauses(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // Percent, and the currencies — including the two spellings that had to be measured.
    // `porsiento` — NOT ceb's `porsyento`/hil's `porsiyento`, both ×0 in Ilocano.
    [InlineData("mangbukel iti 11.60%",
        "maŋbˈukɛl ʔˈiti saŋapˈulo kˈɛt mˈajsa pˈunto ʔinnˈɛm sˈɛɾo poɾsjˈɛnto")]
    // ⚠ `doliar` — NOT `dolyar`/`dolar` (×0). The compound `US$` key carries the corpus's own phrase.
    [InlineData("nalako iti US$53.9 milion",
        "nalˈako ʔˈiti limapˈulo kˈɛt tˈallo pˈunto sjˈam mˈiljon dˈoljaɾ tˈi ʔɛstˈados ʔunˈidos")]
    // ⚠ `pisos`, not `piso` — `piso` is the botanist Willem Piso, and `pisos` is the currency in an amount.
    [InlineData("bayad iti ₱50", "bˈajad ʔˈiti limapˈulo pˈisos")]
    [InlineData("ngem €890 bilion", "ŋˈɛm waloɡˈasut kˈɛt sjˈam ʔˈa pˈulo bˈiljon ʔɛʔˈuɾo")]
    // ⚠ `£` rests on ONE attestation of the COLLOCATION; bare `libra` is 3-of-4 the unit of weight.
    [InlineData("tangdan a £200", "tˈaŋdan ʔˈa dwaɡˈasut lˈibɾa ʔɛstɛɾlˈina")]
    public void PercentAndTheCurrencies(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // ⚠ THE MEASURE WORD GOES BEFORE ITS NOUN — where ceb and hil are wrong for Ilocano.
    [InlineData("iti lugar ti 636 km²",
        "ʔˈiti lˈuɡaɾ tˈi ʔinnˈɛm ʔˈa ɡasˈut kˈɛt tallopˈulo kˈɛt ʔinnˈɛm kwadɾˈado kilomˈɛtɾo")]
    // The CUBE branch, which the corpus writes spelled-out and which the symbol path must also reach.
    [InlineData("1,000 kubiko metro", "saŋaɾˈibo kubˈiko mˈɛtɾo")]
    public void TheMeasureWordGoesBeforeItsNoun(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // Units, rates and the ampersand.
    [InlineData("adda ti 250 ml ken 3 mi ken 5 kg ken 100 mm ken 20 cm",
        "addˈa tˈi dwaɡˈasut kˈɛt limapˈulo mililˈitɾo kˈɛn tˈallo mˈilja kˈɛn lˈima kiloɡɾˈamo"
        + " kˈɛn saŋaɡˈasut milimˈɛtɾo kˈɛn dwapˈulo sɛntimˈɛtɾo")]
    // `mph` is its own KEY, not the composition of its parts (trap 44) — there is no `p` denominator.
    [InlineData("5 km/s ken 60 mph",
        "lˈima kilomˈɛtɾo kˈada sɛɡˈundo kˈɛn ʔinnˈɛm ʔˈa pˈulo mˈilja kˈada ʔˈoɾas")]
    // ⚠ Spaced on both sides, so `AT&T` stays three tokens (trap 18) rather than fusing.
    [InlineData("Luna & Balaoan", "lˈuna kˈɛn balaʔˈoʔan")]
    public void UnitsRatesAndTheAmpersand(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // ⚠ `ft` → `pie` — the corpus's foot word is the Spanish spelling, digit-adjacent in the gloss.
    public void TheFootWordIsTheSpanishSpelling() => Assert.Contains("pjˈɛ kˈɛn", Say("20,320 pié ken 35,797 ft"));

    [Fact]
    // ⚠ A UNIT IN THE `per` SLOT HAS NO NUMBER BESIDE IT — the tier cannot reach it, ×133.
    public void ThePerSlotUnitIsSpentLocally() =>
        Assert.Equal("saŋapˈulo kˈɛt dwˈa pˈunto pˈito sˈɛɾo ʔˈa tattˈaʔo tˈuŋɡal mˈajsa ʔˈa kwadɾˈado kilomˈɛtɾo",
            Say("12.70 a tattao tunggal maysa a km²"));

    [Fact]
    // ⚠ AND THE SPELLED-OUT FORM MUST NOT BE DOUBLED — the corpus writes both.
    public void TheSpelledOutFormIsNotDoubled() =>
        Assert.Equal("ʔˈiti tˈuŋɡal kwadɾˈado kilomˈɛtɾo", Say("iti tunggal kuadrado kilometro"));

    [Fact]
    // ⚠ WHAT BARE `m` COSTS: the astronomical / UTC-offset notation where `m` is a MINUTE, and an ordinary
    // height must still be metres.
    public void TheTimeCoordinateAndTheMetre()
    {
        Assert.Equal("panaɡpaŋˈato ʔˈa saŋapˈulo kˈɛt dwˈa ʔˈoɾas ʔˈuppat ʔˈa pˈulo kˈɛt sjˈam minˈuto",
            Say("panagpangato a 12 h 49 m"));
        Assert.Contains("mˈɛtɾo", Say("agsobra nga 3.7 m"));
    }

    [Theory]
    // Ranges read `aginggana iti`, and the connective is not doubled. NOT ceb's `ngadto sa` and NOT hil's
    // `hasta` — both ×0 in Ilocano. Third language, third word.
    [InlineData("Dagiti 40-45 a rancheria",
        "daɡˈiti ʔˈuppat ʔˈa pˈulo ʔaɡiŋɡˈana ʔˈiti ʔˈuppat ʔˈa pˈulo kˈɛt lˈima ʔˈa ɾankhˈɛɾja")]
    // The guard the su/so/ceb/hil runs paid for: do not double a connective the text already wrote.
    [InlineData("manipud 15 aginggana iti 64",
        "manˈipud saŋapˈulo kˈɛt lˈima ʔaɡiŋɡˈana ʔˈiti ʔinnˈɛm ʔˈa pˈulo kˈɛt ʔˈuppat")]
    // ⚠ THE ORDERING BRANCH (trap 13): ranges run ABOVE the decimal rule so the operands are still whole.
    [InlineData("0.25–0.33 pulgada",
        "sˈɛɾo pˈunto dwˈa lˈima ʔaɡiŋɡˈana ʔˈiti sˈɛɾo pˈunto tˈallo tˈallo pulɡˈada")]
    // ⚠ AND IT MUST NOT CLAIM THE ORDINAL PREFIX, whose hyphen has a LETTER on its left — trap 16.
    [InlineData("idi maika-19 a siglo", "ʔˈidi maʔˈika saŋapˈulo kˈɛt sjˈam ʔˈa sˈiɡlo")]
    public void RangesReadAgingganaIti(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // Degrees — one word serves the coordinate and the two scales.
    // ⚠ THE SIGN IS NOW READ TOO: the U+2212 in front of `−224 °C` used to be silent, a 448-degree error.
    [InlineData("temperatura ti −224 °C",
        "tɛmpɛɾatˈuɾa tˈi nɛɡatˈibo dwaɡˈasut kˈɛt dwapˈulo kˈɛt ʔˈuppat ɡɾˈado kˈɛlsjus")]
    [InlineData("−129 °F", "nɛɡatˈibo saŋaɡˈasut kˈɛt dwapˈulo kˈɛt sjˈam ɡɾˈado pahɾɛnhˈɛʔit")]
    // ⚠ THE BARE ARM IS THE BIG ONE — a coordinate IS degrees, so no second reading has to be sourced.
    [InlineData("iti 16°Am 26'", "ʔˈiti saŋapˈulo kˈɛt ʔinnˈɛm ɡɾˈado ʔˈam dwapˈulo kˈɛt ʔinnˈɛm ʔ")]
    [InlineData("ti 47.8°", "tˈi ʔˈuppat ʔˈa pˈulo kˈɛt pˈito pˈunto wˈalo ɡɾˈado")]
    public void Degrees(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // Dotted abbreviations, and `c.` before a year.
    // ⚠ `Blng.` is Ilocano's own contraction of `bilang` and has NO VOWEL, so it used to reach the IPA as
    // the cluster [blŋ].
    [InlineData("Bilin Blng. 1", "bˈilin bˈilaŋ mˈajsa")]
    [InlineData("Dr. Jose Rizal ken Ramon Mitra, Sr.",
        "dˈoktoɾ hˈosɛ ɾˈisal kˈɛn ɾˈamon mˈitɾa , sˈɛnjoɾ")]
    public void DottedAbbreviations(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // ⚠ #1122: the pattern is built from the table's own keys with `i`+`u`, so the fold widens it —
    // `ſr.` matches `sr` while `ſr` is not a key. The match falls through UNCHANGED (the g2p then drops
    // the long s it has no rule for) rather than reading the word "undefined", which the table's `!`
    // used to stringify.
    public void TheFoldWidenedAbbreviationMissesTheTable() =>
        Assert.Equal("bˈilin ɾ . mˈajsa", Say("Bilin ſr. 1"));

    [Fact]
    // `agarup` is the corpus's own word in the same function; a following digit is required.
    public void CircaBeforeAYear() => Assert.Contains("ʔaɡˈaɾup ʔˈa talloɡˈasut", Say("ni Theophrastus (c. 371 BC)"));

    [Fact]
    // ⚠ A FOLLOWING DIGIT IS REQUIRED — 2,442 lone `X.` personal initials in author lists.
    public void PersonalInitialsStayLone() =>
        Assert.Equal("mˈathɛw , s . p . ʔˈand k . ɾ . khˈitɾa", Say("Mathew, S. P. and C. R. Chitra"));

    [Theory]
    // ⚠ THE SOURCED REFUSALS — these stay silent on purpose (see defects.ts): fractions ×54 with no
    // denominator series, and the magnitude-plus-exponent residual the plain unit does compose across.
    [InlineData("iti 3/4 ti kalawa", "ʔˈiti tˈallo ʔˈuppat tˈi kalˈawa")]
    public void TheSourcedRefusals(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    public void TheMagnitudePlusExponentResidual() => Assert.Contains("bˈiljon kilomˈɛtɾo", Say("ti kaadayuna 3 a bilion km"));

    /**
     * ⚠ THE DIGIT-BY-DIGIT FALLBACK ITERATES CODE POINTS, NOT CHARS — the TS spreads the string
     * (`[...raw]`), which yields whole code points; iterating a C# string would split an astral character
     * into two lone surrogates. Same finding as haw, gn and hil. Unreachable from `text()` (the token is
     * `\d+`), but `NumberToWords` is public and the TS answers it.
     */
    [Theory]
    [InlineData("😀", "😀")]
    [InlineData("1😀2", "maysa 😀 dua")]
    [InlineData("a", "a")]
    [InlineData("", "")]
    public void TheDigitFallbackReadsCodePointsNotCodeUnits(string raw, string want) =>
        Assert.Equal(want, Numbers.NumberToWords(double.NaN, raw));
}
