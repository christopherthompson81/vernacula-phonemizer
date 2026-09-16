/**
 * Two reported misreadings — `in situ` and abbreviated `max`.
 * Ported from test/english-reported-misreadings.test.ts; the diagnosis is in
 * docs/investigations/en/en_reported_misreadings_investigation.md.
 *
 * ⚠ THE EXPECTED STRINGS ARE THE TYPESCRIPT'S, VERBATIM.
 */
using System.IO;
using System.Linq;
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishReportedMisreadingsTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    [Theory]
    [InlineData("en", "ɪn sˈɪt͡ʃuː")]
    [InlineData("en-GB", "ɪn sˈɪt͡ʃuː")]
    public void InSitu(string lang, string ipa)
        => Assert.Equal(ipa, Phonemizer.Phonemize("in situ", lang));

    [Theory]
    [InlineData("max 40 characters", "mˈæksəməm fˈɔːɹt̬i kʰˈæɹəktɚz")]
    [InlineData("a max of 40", "ə mˈæksəməm ʌv fˈɔːɹt̬i")]
    [InlineData("to the max", "tʰuː ðə mˈæksəməm")]
    [InlineData("max. 40", "mˈæksəməm fˈɔːɹt̬i")]
    [InlineData("the max. is 40", "ðə mˈæksəməm ɪz fˈɔːɹt̬i")]
    public void MaxExpandsToMaximum(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("Max went home", "mˈæks wˈɛnt hˈoᶷm")]
    [InlineData("Max.", "mˈæks .")]
    [InlineData("max out the budget", "mˈæks ˈaᶷt ðə bˈʌd͡ʒɪt")]
    [InlineData("max it out", "mˈæks ɪt ˈaᶷt")]
    [InlineData("maxed out", "mˈækst ˈaᶷt")]
    public void TheNameAndTheVerbAreLeftAlone(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("IR spectroscopy", "ˌɪnfɹɚˈɛd spɛktɹˈɑːskəpi")]
    [InlineData("UV and IR light", "jˈuːvˈiː ənd ˌɪnfɹɚˈɛd lˈaᶦt")]
    [InlineData("Ir", "ˈɪɹ")]
    public void IrReadsAsInfraredAndOnlyInThatExactCasing(string text, string ipa)
        => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("CH₄", "sˈiː ˈeᶦt͡ʃ fˈɔːɹ")]
    [InlineData("N₂ and CH₄", "ˈɛn tʰˈuː ənd sˈiː ˈeᶦt͡ʃ fˈɔːɹ")]
    [InlineData("x²", "ˈɛks skwˈɛɹd")]
    public void SubscriptDigitsRead(string text, string ipa) => Assert.Equal(ipa, Say(text));

    // ⚠ EVERY ported language, not a sample — see the TS test for why the first, tier-by-tier
    // attempt looked like full coverage and reached only 151 of 189.
    [Fact]
    public void EveryLanguageReadsASubscriptLikeItsAsciiSpelling()
    {
        var dir = AppContext.BaseDirectory;
        while (dir is not null && !Directory.Exists(Path.Combine(dir, "goldens")))
            dir = Path.GetDirectoryName(dir);
        Assert.NotNull(dir);
        var langs = Directory.EnumerateFiles(Path.Combine(dir!, "goldens"), "*.tsv")
            .Select(Path.GetFileNameWithoutExtension).Where(l => l is not null).Select(l => l!)
            .Order(StringComparer.Ordinal).ToList();
        Assert.True(langs.Count > 180, $"only {langs.Count} languages enumerated");
        var differ = langs.Where(l =>
            Phonemizer.Phonemize("CH₄", l) != Phonemizer.Phonemize("CH4", l)).ToList();
        Assert.Empty(differ);
    }

    [Theory]
    [InlineData("It rained, and it was cold.", "ɪt ɹˈeᶦnd , ˈænd ɪt wʌz kʰˈoᶷɫd .")]
    [InlineData("And then we left.", "ˈænd ðˈɛn wiː lˈɛft .")]
    [InlineData("dogs and cats", "dˈɑːɡz ənd kʰˈæts")]
    [InlineData("he and I", "hiː ənd ˈaᶦ")]
    [InlineData("The man arrived, the woman left.", "ðə mˈæn ɚˈaᶦvd , ðə wˈʊmən lˈɛft .")]
    [InlineData(", and it was", "ˈænd ɪt wˈʌz")]
    [InlineData("Coffee, tea, or water.", "kʰˈɑːfi , tʰˈiː , ɔːɹ wˈɔːt̬ɚ .")]
    public void AClauseInitialCoordinatorTakesItsStrongForm(string text, string ipa)
        => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("profile", "pɹˈoᶷfˌaᶦɫ")]
    [InlineData("textile", "tʰˈɛkstˌaᶦɫ")]
    [InlineData("skylines", "skˈaᶦlˌaᶦnz")]
    [InlineData("zeitgeist", "tsˈaᶦtɡˌaᶦst")]
    // …and the guards: OW/EY are not true diphthongs here, and an open final syllable is excluded.
    [InlineData("zorro", "zˈɔːɹoᶷ")]
    [InlineData("window", "wˈɪndoᶷ")]
    [InlineData("airplane", "ˈɛɹpleᶦn")]
    // ⚠ plain d, not d̬: a 2° the clash rule KEEPS is a real beat, so the coronal before it is a full
    // stop rather than a flap. misaki's lexicon agrees (kɹˈɑkədˌIl). The ˌ — what this case is about —
    // is unchanged. See englishArpabet.ts.
    [InlineData("crocodile", "kɹˈɑːkədˌaᶦɫ")]
    [InlineData("compile", "kəmpˈaᶦɫ")]
    public void AClosedFinalSyllableOnATrueDiphthongKeepsItsSecondaryStress(string w, string ipa)
        => Assert.Equal(ipa, Say(w));

    [Theory]
    [InlineData("Panels lit at ≥30%", "pʰˈænəɫz lˈɪt æt ɡɹˈeᶦt̬ɚ ðæn ɔːɹ ˈiːkwɫ̩ tʰuː θˈɝd̬i pɚsˈɛnt")]
    [InlineData("a ≠ b", "ə nɑːt ˈiːkwɫ̩ tʰuː bˈiː")]
    [InlineData("a ± b", "ə plˈʌs ɔːɹ mˈaᶦnəs bˈiː")]
    // …and the ASCII pair keeps its digit gate, because it can be markup and these cannot.
    [InlineData("5 > 3", "fˈaᶦv ɡɹˈeᶦt̬ɚ ðæn θɹˈiː")]
    [InlineData("a = b", "ə ˈiːkwəɫz bˈiː")]
    public void TheUnicodeRelationalsAreRead(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("TY2024", "tʰˈæks jˈɪɹ twˈɛnti twˈɛnti fˈɔːɹ")]
    [InlineData("TY 2024", "tʰˈæks jˈɪɹ twˈɛnti twˈɛnti fˈɔːɹ")]
    public void AFiscalYearIsReadAsOne(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("BTU/hr/sf", "bˈiː tʰˈiː jˈuː pʰɝ ˈaᶷɚ , pʰɝ skwˈɛɹ fˈʊt")]
    [InlineData("50 BTU/hr", "fˈɪfti bˈiː tʰˈiː jˈuː pʰɝ ˈaᶷɚ")]
    [InlineData("250 BTU", "tʰˈuː hˈʌndɹəd fˈɪfti bˈiː tʰˈiː jˈuː")]
    // ⚠ The bare arm steals neither the count nor a URL.
    [InlineData("and/or", "ˈænd ˈɔːɹ")]
    public void ASlashedRateUnitReads(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("thermocouple", "θˈɝməkʰˌʌpɫ̩")]
    [InlineData("thermocouples", "θˈɝməkʰˌʌpəɫz")]
    [InlineData("thermostat", "θˈɝməstˌæt")]
    public void ThermocoupleAgreesWithEspeakAndWithItsOwnPlural(string w, string ipa)
        => Assert.Equal(ipa, Say(w));

    [Theory]
    [InlineData("CO₂", "sˈiː ˈoᶷ tʰˈuː")]
    [InlineData("SO₂", "ˈɛs ˈoᶷ tʰˈuː")]
    [InlineData("NO₂", "ˈɛn ˈoᶷ tʰˈuː")]
    [InlineData("H2SO4", "ˈeᶦt͡ʃ tʰˈuː ˈɛs ˈoᶷ fˈɔːɹ")]
    [InlineData("AS400", "ˈeᶦ ˈɛs fˈɔːɹ hˈʌndɹəd")]
    // ⚠ TWO LETTERS ONLY — widening this turns COVID19 into "C O V I D nineteen".
    [InlineData("COVID19", "koᶷvˈiːd nˈaᶦntˈiːn")]
    // …and the ones that were already right, pinned as undisturbed.
    [InlineData("CH₄", "sˈiː ˈeᶦt͡ʃ fˈɔːɹ")]
    [InlineData("MP3", "ˈɛm pʰˈiː θɹˈiː")]
    [InlineData("A380", "ˈeᶦ θɹˈiː hˈʌndɹəd ˈeᶦt̬i")]
    public void ATwoLetterCapsRunGluedToDigitsIsACode(string text, string ipa)
        => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("pages 5–15", "pʰˈeᶦd͡ʒᵻz fˈaᶦv tʰuː fɪftˈiːn")]
    [InlineData("2019–2020", "twˈɛnti nˈaᶦntˈiːn tʰuː twˈɛnti twˈɛnti")]
    public void ADashBetweenTwoNumbersIsARange(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Theory]
    [InlineData("Rev. B, 2025-10-21", "ɹivˈɪʒn̩ bˈiː , ɑːktˈoᶷbɚ twˈɛnti fˈɝst twˈɛnti twˈɛnti fˈaᶦv")]
    [InlineData("Rev. 3", "ɹivˈɪʒn̩ θɹˈiː")]
    // ⚠ The name shapes are the point of the guard — a capital followed by a PERIOD is an initial.
    [InlineData("Rev. Smith", "ɹˈɛvɚənd smˈɪθ")]
    [InlineData("Rev. J. Smith", "ɹˈɛvɚənd d͡ʒˈeᶦ . smˈɪθ")]
    [InlineData("the Rev. Jesse Jackson", "ðə ɹˈɛvɚənd d͡ʒˈɛsi d͡ʒˈæksn̩")]
    public void RevIsARevisionBeforeADesignatorAndAReverendBeforeAName(string t, string ipa)
        => Assert.Equal(ipa, Say(t));

    /**
     * A DOUBLED CAPITAL IS A CODE, NOT A WORD. Reported against a project code whose last field is
     * `-AA`, which read as one run-together vowel — CMUdict's Hawaiian lava word — instead of two
     * letter names.
     *
     * ⚠ THIS IS A DATA-ONLY FIX, and that is exactly why it needs a test on THIS side. The port
     * reads the same english.jsonc, so parity is supposed to hold by construction with no C# change
     * at all — which is a claim, not a fact, until the port is asked the same questions.
     */
    [Theory]
    [InlineData("(ABC-AA)", "ˈeᶦbiːsˌiː ˈeᶦ ˈeᶦ")]
    [InlineData("AA battery", "ˈeᶦ ˈeᶦ bˈæt̬ɚi")]
    [InlineData("the AA thing", "ðə ˈeᶦ ˈeᶦ θˈɪŋ")]
    [InlineData("the EE thing", "ðə ˈiː ˈiː θˈɪŋ")]
    [InlineData("the MM thing", "ðə ˈɛm ˈɛm θˈɪŋ")]
    [InlineData("the OO thing", "ðə ˈoᶷ ˈoᶷ θˈɪŋ")]
    [InlineData("the UU thing", "ðə jˈuː jˈuː θˈɪŋ")]
    [InlineData("the YY thing", "ðə wˈaᶦ wˈaᶦ θˈɪŋ")]
    [InlineData("format YYYY-MM-DD here", "fˈɔːɹmæt wˈaᶦ wˈaᶦ wˈaᶦ wˈaᶦ ˈɛm ˈɛm dˈiː dˈiː hˈɪɹ")]
    // ⚠ CC and SS are doubled too and are NOT on the list: CMUdict records their letter readings
    // already, in one token with one stress, which is better prosody than spelling out.
    [InlineData("the CC thing", "ðə siːsˈiː θˈɪŋ")]
    [InlineData("the SS thing", "ðə ˈɛsˈɛs θˈɪŋ")]
    [InlineData("the AAA thing", "ðə tɹˌɪpəlˈeᶦ θˈɪŋ")]
    [InlineData("the BB thing", "ðə bˈiː bˈiː θˈɪŋ")]
    public void ADoubledCapitalIsACode(string t, string ipa) => Assert.Equal(ipa, Say(t));

    /**
     * A SPACE-GUARDED DASH IS A PARENTHETICAL BREAK. Reported against a question with a spaced hyphen
     * mid-clause: the halves ran together with no boundary, where a comma in the same slot pauses.
     * ⚠ The expected strings are the TypeScript's, verbatim.
     */
    [Theory]
    [InlineData("the answer, a long one, arrived")]   // the baseline this must equal
    [InlineData("the answer - a long one - arrived")]
    [InlineData("the answer -- a long one -- arrived")]
    [InlineData("the answer – a long one – arrived")]
    [InlineData("the answer — a long one — arrived")]
    [InlineData("the answer—a long one—arrived")]     // unspaced em dash: the other house style
    public void ASpaceGuardedDashReadsLikeAComma(string t)
        => Assert.Equal("ðə ˈænsɚ , ə lˈɔːŋ wˈʌn , ɚˈaᶦvd", Say(t));

    // ⚠ The word-joiner is what this must not touch; an unspaced EN dash joins rather than breaks.
    [Theory]
    [InlineData("Bose–Einstein condensate", "bˈoᶷz ˈaᶦnstaᶦn kʰˈɑːndənsˌeᶦt")]
    [InlineData("a well-known case", "ə wˈɛɫ nˈoᶷn kʰˈeᶦs")]
    [InlineData("state-of-the-art design", "stˈeᶦt ʌv ðə ˈɑːɹt dᵻzˈaᶦn")]
    [InlineData("re-enter the code", "ɹˈeᶦ ˈɛntɚ ðə kʰˈoᶷd")]
    [InlineData("pages 5–15", "pʰˈeᶦd͡ʒᵻz fˈaᶦv tʰuː fɪftˈiːn")]
    public void TheJoinerAndTheSpanAreUntouched(string t, string ipa) => Assert.Equal(ipa, Say(t));

    // ⚠ A dash with a DIGIT ON BOTH SIDES is a loose-written span, not a parenthesis, and keeps its
    // measured reading — no pause. The digit/word mixes DO pause.
    [Fact]
    public void ASpacedSpanBetweenNumbersIsNotAParenthesis()
    {
        Assert.DoesNotContain(",", Say("from 1990 - 1995"));
        Assert.Contains(",", Say("from 1990 - present"));
    }

    // A list marker opening a line has no word before it, so the left guard declines it.
    [Fact]
    public void ADashOpeningALineIsNotABreak() => Assert.DoesNotContain(",", Say("first item\n- second item"));

    /**
     * A POSTFIX PLUS IS READ. Both existing arms require a digit on the RIGHT, so a plus in final
     * position was dropped outright — reported against a code ending in `+`.
     * ⚠ The expected strings are the TypeScript's, verbatim.
     */
    [Theory]
    [InlineData("C7+", "sˈiː sˈɛvən plˈʌs")]
    [InlineData("the C7+ cut", "ðə sˈiː sˈɛvən plˈʌs kʰˈʌt")]
    // ⚠ The run is matched WHOLE: a per-sign rule reads the first and strands the second.
    [InlineData("C++ code", "sˈiː plˈʌs plˈʌs kʰˈoᶷd")]
    [InlineData("the + sign", "ðə plˈʌs sˈaᶦn")]
    // …and what already worked is unchanged.
    [InlineData("2 + 2", "tʰˈuː plˈʌs tʰˈuː")]
    [InlineData("2+2", "tʰˈuː plˈʌs tʰˈuː")]
    [InlineData("+5 volts", "plˈʌs fˈaᶦv vˈoᶷɫts")]
    [InlineData("5 + 3 = 8", "fˈaᶦv plˈʌs θɹˈiː ˈiːkwəɫz ˈeᶦt")]
    public void APostfixPlusIsRead(string t, string ipa) => Assert.Equal(ipa, Say(t));

    // A `+`-marked list keeps its bullets: the between-words arm takes horizontal space only.
    [Fact]
    public void APlusListMarkerIsNotAnOperator()
        => Assert.DoesNotContain("plˈʌs", Say("first item\n+ second item"));

    /**
     * A DASH BETWEEN TWO CALENDAR NAMES IS A SPAN. `May–June 2025` read as "may june" — the range
     * rule owns digit–digit only, so a dash between two NAMES had no rule at all.
     * ⚠ The expected strings are the TypeScript's, verbatim.
     */
    [Theory]
    [InlineData("May–June 2025")]
    [InlineData("May-June 2025")]
    [InlineData("May — June 2025")]
    [InlineData("May – June 2025")]
    public void ACalendarRangeSaysTo(string t)
        => Assert.Equal("meᶦ tʰuː d͡ʒˈuːn twˈɛnti twˈɛnti fˈaᶦv", Say(t));

    [Fact]
    public void WeekdaysRangeTheSameWay() => Assert.Equal("mˈʌndi tʰuː fɹˈaᶦd̬i", Say("Monday–Friday"));

    // ⚠ The licence is TWO calendar names joined by a dash, never the word alone — ⟨may⟩, ⟨march⟩
    // and ⟨august⟩ are ordinary English words.
    [Fact]
    public void TheCalendarWordsAreNotClaimedAlone()
        => Assert.Equal("ə wˈɛɫ nˈoᶷn kʰˈeᶦs", Say("a well-known case"));

    /**
     * A PREFIX THE DICTIONARY SPELLED TWO WAYS IN ONE PARADIGM (`replaced` read "ree-placed"), and a
     * heteronym entry that was a REGIONAL variant rather than a part of speech (`details`).
     * ⚠ Both fixes are DATA — three ARPABET rows and one manifest entry — so the port inherits them
     * with no code change at all. That is a claim until the port is asked the same questions.
     */
    [Theory]
    [InlineData("replace", "ɹᵻplˈeᶦs")]
    [InlineData("replaced", "ɹᵻplˈeᶦst")]
    [InlineData("replaceable", "ɹᵻplˈeᶦsəbɫ̩")]
    [InlineData("details", "dᵻtʰˈeᶦɫz")]
    [InlineData("detail", "dᵻtʰˈeᶦɫ")]
    // ⚠ The PRODUCTIVE prefix meaning "again" keeps its beat — the words a rule-based fix got wrong.
    [InlineData("reconstructed", "ɹˌiːkənstɹˈʌktᵻd")]
    [InlineData("relocate", "ɹiːlˈoᶷkeᶦt")]
    [InlineData("report", "ɹipʰˈɔːɹt")]
    public void TheReducedPrefixAndTheProductiveOne(string t, string ipa) => Assert.Equal(ipa, Say(t));
}
