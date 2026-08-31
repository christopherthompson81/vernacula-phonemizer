/**
 * The portable half of test/shan.test.ts — Shan / Tai Long (shn), လိၵ်ႈတႆး, Southwestern Tai (Tai-Kadai),
 * the SHAN ABUGIDA (a Myanmar-script variant), TONAL. A per-syllable scan: onset → medials → rime (vowel
 * signs × coda) → EXPLICIT tone. Signatures: aspirated ⟨သ⟩→[sʰ], glottal ⟨ဢ⟩→[ʔ]; ⟨ူ⟩→[o] closed /
 * [uː] open; medial ⟨ွ⟩ ROUNDS the inherent rime to [ɔ]; the ⟨ႂ⟩ coda →[ɰ]; ⟨ၵျ⟩→[d͡ʑ].
 * Referee: wikipron shn_mymr_broad (2607 human).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Shan;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ShanTests
{
    private static string Word(string s) => ShanPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "shn");
    private static string Norm(string s) => Normalize.NormalizeShan(s);

    [Theory]
    // onsets, tones, and the endonym.
    [InlineData("တႆး", "taj˥")]      // 'Tai/Shan' — ⟨ႆ⟩ final-y→[j], visarga း→˥ (high)
    [InlineData("ၼမ်ႉ", "nam˦˨")]    // 'water' — ⟨ၼ⟩→n, ⟨မ⟩ coda→m, ⟨ႉ⟩→˦˨ (tone 5)
    [InlineData("ၵိၼ်", "kin˨˦")]     // 'eat' — unmarked→˨˦ (rising)
    [InlineData("ၽႃႇ", "pʰaː˩")]      // ⟨ၽ⟩→pʰ, ⟨ႃ⟩→aː, ⟨ႇ⟩→˩ (low)
    public void OnsetsAndTones(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨ၢ⟩ and ⟨ႃ⟩ are BOTH long [aː]; short [a] is the inherent (sign-less) vowel.
    [InlineData("ၵၢၼ်", "kaːn˨˦")]    // 'work' — closed-syllable ⟨ၢ⟩ → long [aː]
    [InlineData("တၢင်း", "taːŋ˥")]    // 'way'
    [InlineData("တတ်း", "tat̚˥")]     // inherent (no sign) → SHORT [a], checked coda ⟨တ⟩→[t̚]
    public void TheTwoLongAVowels(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // the ⟨ူ⟩ o/uː split, medial-⟨ွ⟩ rounding, aspirated ⟨သ⟩.
    [InlineData("ၵူၼ်း", "kon˥")]     // 'person' — ⟨ူ⟩ before a coda → [o]
    [InlineData("ၵွင်", "kɔŋ˨˦")]     // medial ⟨ွ⟩ + inherent → ROUNDED [ɔ] (no -w- glide)
    [InlineData("သွင်", "sʰɔŋ˨˦")]    // 'two' — aspirated ⟨သ⟩→[sʰ] + ⟨ွ⟩ rounding
    public void RoundingAndTheUSplit(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // diphthong rimes ⟨ိူ ို⟩, the ⟨ႂ⟩ coda, palatalisation, and ⟨ေႃ⟩.
    [InlineData("မိူင်း", "mɤŋ˥")]     // 'country' (möng) — ⟨ိူ⟩→[ɤ] before a coda
    [InlineData("ႁိူၼ်း", "hɤn˥")]     // 'house'
    [InlineData("ၶိုၵ်ႉ", "kʰɯk̚˦˨")]  // ⟨ို⟩→[ɯ] short before a checked coda ⟨ၵ⟩→[k̚]
    [InlineData("ၸႂ်", "t͡ɕaɰ˨˦")]     // 'heart/mind' — ⟨ႂ⟩ coda → [ɰ] offglide
    [InlineData("ၵျေႃး", "d͡ʑɔː˥")]    // palatalised ⟨ၵျ⟩→[d͡ʑ] + ⟨ေႃ⟩→[ɔː]
    public void DiphthongsAndPalatalisation(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Cardinal numbers — structurally Thai's: 20 is သၢဝ်း (replacing the whole "twenty"), a final 1 in a
    // compound is ဢဵတ်း, tens 30–90 are unit+သိပ်း, 10⁴/10⁵ their own words. No attested 10⁶ word, so a
    // million composes on သႅၼ်.
    [InlineData(0, "sʰun˨˦")]
    [InlineData(7, "t͡ɕet̚˥")]
    [InlineData(11, "sʰip̚˥ ʔet̚˥")]                       // သိပ်းဢဵတ်း — final 1 is ဢဵတ်း
    [InlineData(20, "sʰaːw˥")]                            // သၢဝ်း — the irregular twenty (no သိပ်း)
    [InlineData(21, "sʰaːw˥ ʔet̚˥")]
    [InlineData(42, "sʰiː˩ sʰip̚˥ sʰɔŋ˨˦")]                // unit-first decade
    [InlineData(100, "nɯŋ˧˧˨ paːk̚˩")]
    [InlineData(1000, "nɯŋ˧˧˨ heŋ˨˦")]
    [InlineData(12345, "nɯŋ˧˧˨ mɯn˩ sʰɔŋ˨˦ heŋ˨˦ sʰaːm˨˦ paːk̚˩ sʰiː˩ sʰip̚˥ haː˧˧˨")]
    [InlineData(1000000, "sʰip̚˥ sʰɛn˨˦")]                 // သိပ်းသႅၼ် — 10 × 10⁵
    public void CardinalNumbers(int n, string want) => Assert.Equal(want, Say(n.ToString()));

    [Theory]
    // ⚠ THE VOICED SERIES OF THE SHAN LETTER BLOCK. U+1075–U+1081 is the Shan run and the table used to
    // skip exactly ၷ ၹ ၻ ၿ — loan-only letters, which is why they were missed and not a reason to omit them.
    [InlineData("ၻွၵ်ႇ", "dɔk̚˩")]              // ၻွၵ်ႇတႂ်ႇ 'doctor' — was *kaː˨˦*
    [InlineData("ၻီႇ", "diː˩")]                 // ၻီႇၵရီႇ 'degree'
    [InlineData("ၿီႇလီႇယၢၼ်ႇ", "biː˩liː˩jaːn˩")] // 'billion' — was *liː˩jaːn˩*
    public void TheVoicedLoanLetters(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    // ⟨ꧦ⟩ U+A9E6 SHAN REDUPLICATION — the ໆ/ๆ-style "say that again" mark. TWO holes had to close: it is
    // not an onset, AND U+A9E6 is Myanmar Extended-B, which the TOKEN class did not admit.
    public void ReduplicationRepeatsThePrecedingSyllable()
    {
        Assert.Equal("laːj˨˦laːj˨˦", Word("လၢႆꧦ"));                       // လၢႆလၢႆ 'various'
        Assert.Equal("hat̚˥hat̚˥haːn˨˦haːn˨˦", Say("ႁတ်းꧦႁၢၼ်ꧦ"));        // ႁတ်းႁၢၼ် 'bold' → 'boldly'
        Assert.Equal("ŋaːj˧˧˨ŋaːj˧˧˨", Say("ငၢႆႈꧦ"));                     // ငၢႆႈငၢႆႈ 'easily'
    }

    [Fact]
    // ⚠ ⟨က န အ ည ခ⟩ ARE NOT SHAN LETTERS — 15 of the corpus's 407 lines are BURMESE, and the surrounding
    // Burmese vowel signs used to latch onto the next consonant (`ပတ်ဝန်းကျင်` → *pat̚˨˦waː˨˦ŋaː˨˦*). A run
    // carrying a Burmese-only consonant goes to the script router, i.e. to `my`.
    public void ABurmeseRunIsReadByTheBurmeseEngine()
    {
        foreach (var w in new[] { "ပတ်ဝန်းကျင်", "သည်", "တောင်ကြီး", "အမြင့်" })
            Assert.Equal(Phonemizer.Phonemize(w, "my"), Say(w));
        // ⚠ AND A SHAN WORD MUST NEVER TAKE THAT BRANCH. The Burmese-only set is the COMPLEMENT of the Shan
        // inventory — ⟨င တ ထ ပ မ ယ ရ လ ဝ သ⟩ are shared and excluded — so this is a property, not a sample.
        foreach (var w in new[] { "တႆး", "မိူင်းတႆး", "ၵိၼ်", "ႁတ်းႁၢၼ်" })
            Assert.Equal(Word(w), Say(w));
    }

    [Fact]
    // THE SEPARATOR CONVENTION IS THE ENGLISH ONE, and the dot is free to be a decimal point — Shan ends
    // sentences with ။, not with the ASCII dot.
    public void SeparatorConventionAndNativeDigits()
    {
        Assert.Equal("sʰiː˩ haː˧˧˨ sʰiː˩", Say("4.54"));       // was "four ⟨sentence break⟩ fifty-four"
        Assert.Equal("sʰɔŋ˨˦ heŋ˨˦ t͡ɕet̚˥ paːk̚˩ haː˧˧˨ sʰip̚˥ kaw˧˧˨", Say("2,759"));
        // ⚠ THE NATIVE DIGITS ARE FOLDED BY THE NORMALIZER, not by the engine — it folds AFTER that pass.
        Assert.Equal(Say("924,608"), Say("၉၂၄,၆၀၈"));
        Assert.Equal(Say("7054.37"), Say("၇၀၅၄.၃၇"));
    }

    [Fact]
    // THE COORDINATE, which this corpus writes BOTH ways in one publication.
    public void CoordinatesAndDegrees()
    {
        Assert.Equal(Say("18 ၻီႇၵရီႇ 0 မိၼိတ်ႉ"), Say("၁၈° ၀'"));
        Assert.Equal(Say("94 ၻီႇၵရီႇ 40 မိၼိတ်ႉ"), Say("၉၄° ၄၀'"));
        // ⚠ The scale name is NOT emitted — no Shan word for Celsius is attested — but the ⟨C⟩ is consumed
        // rather than left to read as the ENGLISH letter name.
        Assert.Equal(Say("70 ၻီႇၵရီႇ"), Say("70°C"));
    }

    [Fact]
    // the CLOCK, and the word the corpus already wrote.
    public void TheClockAndTheWordTheCorpusWrote()
    {
        Assert.Equal(Say("5 မူင်း 23 မိၼိတ်ႉ"), Say("5:23"));  // was "five ⟨pause⟩ twenty-three"
        Assert.Equal(Say("10 မူင်း"), Say("10:00"));           // a zero minute is dropped
        // ⚠ AND IT MUST NOT DOUBLE. `09:00 – 10:00 မူင်း` puts one မူင်း after the whole span.
        Assert.Equal(Say("10 မူင်း"), Say("10:00 မူင်း"));
    }

    [Fact]
    // the ERA MARKER is claimed for A.D and REFUSED for B.C, which is what the evidence says.
    public void TheEraMarkerAsymmetry()
    {
        Assert.Equal(Say("ပီၶရိတ်ႉ 739"), Say("A.D 739"));
        Assert.Equal("(1434 ပီၶရိတ်ႉ)", Norm("(1434 A.D.)"));
        Assert.Equal("B.C 1122", Norm("B.C 1122"));
    }

    [Fact]
    // ranges, dates and the ± all take a PAUSE, and no connective is invented.
    public void RangesDatesAndThePlusMinus()
    {
        Assert.Equal("400, 500", Norm("400-500"));
        Assert.Equal("10, 1, 1990", Norm("10/1/1990")); // a D/M/Y date, never a fraction here
        Assert.Equal("4.5672, 0.0006", Norm("4.5672 ± 0.0006"));
        // ⚠ THE HYPHEN IS A LABEL SEPARATOR IN CENSUS FIGURES — `ၸၢႆး-1,226၊ ယိင်း-1,316` — so the range
        // rule requires a DIGIT before it and leaves those alone.
        Assert.Equal("ၸၢႆး-1226", Norm("ၸၢႆး-1,226"));
        Assert.Equal("ၸၼ်ႉ-5", Norm("ၸၼ်ႉ-5"));
    }

    [Fact]
    // the country-prefixed currency sign, and the tier the corpus glossed.
    public void TheCurrencyTier()
    {
        Assert.Equal(Say("70 တေႃႇလႃႇ"), Say("US$70"));
        Assert.Equal(Say("579 တေႃႇလႃႇ"), Say("$579"));
        Assert.Equal(Say("5950 ၵီႇလူဝ်ႇမီႇတႃႇ"), Say("5950 km"));
    }

    [Fact]
    // what is REFUSED — and the refusal is the finding.
    public void TheRefusals()
    {
        // PERCENT: the obvious compound ႁူဝ်ပၢၵ်ႇ is the word for CENTURY, which this corpus glosses in
        // English to prove it ("ပီႁူဝ်ပၢၵ်ႇ 15 (15th Century AD)").
        Assert.Equal("10%", Norm("10%"));
        // `=` is a PALI GLOSS SEPARATOR ×23, zero equations; `>` is a SOUND-CHANGE ARROW ×10.
        Assert.Equal("ပၼ်ထၵ=ၵေႃႉၵိူတ်ႇၸွမ်းတၢင်း", Norm("ပၼ်ထၵ=ၵေႃႉၵိူတ်ႇၸွမ်းတၢင်း"));
        Assert.Equal("Rhwam > Yhwam", Norm("Rhwam > Yhwam"));
    }
}
