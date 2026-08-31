/**
 * Min Dong / Eastern Min (cdo) — Fuzhou dialect, Sinitic, tonal (~9M). A Bàng-uâ-cê (BUC / Foochow
 * Romanized) → IPA converter; missionary convention: plain ⟨p t k⟩ = [pʰ tʰ kʰ], ⟨b d g⟩ = [p t k],
 * ⟨c⟩=[t͡s], ⟨ch⟩=[t͡sʰ], ⟨ng⟩=[ŋ]. Segmental + citation tone, with the 韻變 (rime alternation) tight/loose
 * by tone register.
 *
 * The portable half of test/mindong.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.MinDong;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class MinDongTests
{
    private static string Word(string s) => MinDongPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => MinDongPhonemizer.CreateMinDong().Text(s).Trim();
    // The normalization tests go through the REGISTRY, not the engine: ℃/℉ are folded to °C/°F at the
    // registry's single dispatch point, so a direct engine would assert the very defect the layer closes.
    private static string Text(string s) => Registry.GetPhonemizer("cdo").Text(s).Trim();

    [Theory]
    [InlineData("kēng", "kʰɛiŋ˧˧")]  // ⟨k⟩→kʰ, rime eng→ɛiŋ, macron→上聲 33
    [InlineData("cūi", "t͡sui˧˧")]     // ⟨c⟩→t͡s
    [InlineData("chiáh", "t͡sʰiɑʔ˨˦")]  // ⟨ch⟩→t͡sʰ, checked acute → 陰入 24
    [InlineData("mā", "ma˧˧")]
    public void TheMissionaryConvention(string input, string expected) => Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("nguŏk", "ŋuoʔ˥")]  // breve + checked coda → 陽入 5
    [InlineData("siŏh", "suoʔ˥")]   // ⟨-h⟩ checked, breve → 陽入 5
    public void TheFiveDiacriticsAndTheCheckedBump(string input, string expected) => Assert.Equal(expected, Word(input));

    // The breve is redundant with the unmarked-tone fallback (both tone 1), but it must keep reading 陰平
    // on its own account: the day the fallback changes, these three referee readings pin the mark.
    [Theory]
    [InlineData("dṳ̆ng", "tyŋ˥˥")]
    [InlineData("gṳ̆", "ky˥˥")]
    [InlineData("sṳ̆k", "syʔ˥")]  // 陽入, the checked counterpart
    public void TheBreveReadsYinPingOnItsOwnAccount(string input, string expected) => Assert.Equal(expected, Word(input));

    // 韻變: the SAME rime is TIGHT under 陰平/陽平/上聲, LOOSE under 陰去/陽去/陰入.
    [Theory]
    [InlineData("găng", "kaŋ˥˥")]     // ⟨ang⟩ TIGHT [aŋ] (breve = 陰平 55)
    [InlineData("gáng", "kɑŋ˨˩˧")]    // ⟨ang⟩ LOOSE [ɑŋ] (acute = 陰去 213)
    [InlineData("să̤", "sɛ˥˥")]       // ⟨a̤⟩ TIGHT [ɛ]
    [InlineData("dá̤", "tɑ˨˩˧")]      // ⟨a̤⟩ LOOSE [ɑ]
    [InlineData("iông", "yɔŋ˨˦˨")]   // ⟨iong⟩ y-medial (zero onset) + LOOSE (circumflex = 陽去)
    public void TheRimeAlternationTightVsLoose(string input, string expected) => Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("ng", "ŋ̍˥˥")]        // bare ⟨ng⟩ → syllabic velar nasal
    [InlineData("nè̤ng", "nøyŋ˥˧")]   // ⟨e̤ng⟩→øyŋ, grave → 陽平 53
    public void TheSyllabicNasalAndTheQualityRimes(string input, string expected) => Assert.Equal(expected, Word(input));

    [Fact]
    public void MultiSyllableCitationTonePerSyllable() =>
        Assert.Equal("houʔ˨˦ t͡sieu˥˥ nøyŋ˥˧", Say("Hók-ciŭ nè̤ng"));

    // The tokenizer must NFD-normalize, else the single-codepoint NFC ṳ truncates the syllable.
    [Fact]
    public void TheTextPathHandlesPrecomposedNfc()
    {
        Assert.Equal("ky˥˥", Say("gṳ̆"));
        Assert.Equal("tyŋ˥˥", Say("dṳ̆ng")); // ⟨ṳng⟩→yŋ, not truncated to "t ŋ̍"
    }

    // Cardinal numbers — myriad grouping 萬/億; a magnitude multiplier of 1 is 蜀 siŏh, of 2 is 兩 lâng
    // before 百/千/萬/億 but 二 nê before 十; 百 is the VERNACULAR ⟨báh⟩, not the literary ⟨báik⟩.
    [Theory]
    [InlineData(0, "liŋ˥˧")]
    [InlineData(7, "t͡sʰɛiʔ˨˦")]
    [InlineData(10, "sɛiʔ˨˦")]
    [InlineData(11, "sɛiʔ˨˦ ɛiʔ˨˦")]   // the bare unit digit is ék
    [InlineData(20, "nɛi˨˦˨ sɛiʔ˨˦")]  // 二 nê before 十
    [InlineData(21, "nɛi˨˦˨ sɛiʔ˨˦ ɛiʔ˨˦")]
    [InlineData(100, "suoʔ˥ pɑʔ˨˦")]   // 蜀百 siŏh-báh
    [InlineData(1000, "suoʔ˥ t͡sʰieŋ˥˥")]
    [InlineData(12345, "suoʔ˥ uɑŋ˨˦˨ lɑŋ˨˦˨ t͡sʰieŋ˥˥ saŋ˥˥ pɑʔ˨˦ sɛi˨˩˧ sɛiʔ˨˦ ŋou˨˦˨")]
    [InlineData(1000000, "suoʔ˥ pɑʔ˨˦ uɑŋ˨˦˨")]  // 蜀百萬 siŏh-báh-uâng
    public void CardinalNumbers(int n, string ipa) => Assert.Equal(ipa, Text(n.ToString()));

    [Fact]
    public void TheGroupingCommaIsNotAClausePause()
    {
        Assert.Equal(Text("1000"), Text("1,000"));
        Assert.Equal(Text("30221532"), Text("30,221,532"));
        // A 1–2 digit tail is a DECIMAL and survives de-grouping intact.
        Assert.Equal("sɛiʔ˨˦ nɛi˨˦˨ tieŋ˧˧ ŋou˨˦˨", Text("12.5"));
    }

    [Fact]
    public void TheDecimalIsDiēngAndTheFractionDigitByDigit()
    {
        Assert.Equal("saŋ˥˥ tieŋ˧˧ ɛiʔ˨˦ sɛi˨˩˧", Text("3.14"));
        // A ZERO in the fractional part is the digit word ⟨lìng⟩, not silence.
        Assert.Equal("løyʔ˥ tieŋ˧˧ liŋ˥˧", Text("6.0"));
        // A DOTTED DESIGNATION IS NOT A DECIMAL.
        Assert.DoesNotContain("tieŋ˧˧", Text("1.2.3"));
    }

    [Fact]
    public void ThePercentWordPrecedesItsNumber()
    {
        Assert.Equal("pɑʔ˨˦ huŋ˥˥ t͡si˥˥ sɛi˨˩˧ sɛiʔ˨˦ ŋou˨˦˨", Text("45%"));
        // A PERCENT RANGE IS CLAIMED WHOLE and says the word once, in front.
        Assert.Equal("pɑʔ˨˦ huŋ˥˥ t͡si˥˥ saŋ˥˥ kɑu˨˩˧ sɛi˨˩˧", Text("3%-4%"));
        Assert.Equal("pɑʔ˨˦ huŋ˥˥ t͡si˥˥ kau˧˧ sɛiʔ˨˦ sɛi˨˩˧ kɑu˨˩˧ kau˧˧ sɛiʔ˨˦ paiʔ˨˦", Text("94–98%"));
    }

    [Fact]
    public void TheUnitAbbreviationsDoNotLeakRawLatin()
    {
        Assert.Equal("suoʔ˥ t͡sʰieŋ˥˥ sɛi˨˩˧ pɑʔ˨˦ ho˥˧ mi˧˧", Text("1400 mm"));
        Assert.Equal("sɛi˨˩˧ sɛiʔ˨˦ li˧˧ mi˧˧", Text("40cm"));
        Assert.Equal("saŋ˥˥ sɛiʔ˨˦ ɛiʔ˨˦ kuŋ˥˥ kiŋ˥˥", Text("31 kg"));
        Assert.Equal("løyʔ˥ pɑʔ˨˦ piŋ˥˧ huoŋ˥˥ mi˧˧", Text("600 m²"));
        Assert.Equal("paiʔ˨˦ sɛiʔ˨˦ sɛi˨˩˧ piŋ˥˧ huoŋ˥˥ kuŋ˥˥ li˧˧", Text("84 km²"));
        foreach (var (s, abbr) in new[] { ("2,133 km²", "km"), ("1400 mm", "mm"), ("40cm", "cm"), ("31 kg", "kg") })
            Assert.DoesNotContain(abbr, Text(s));
        // THE ONE-LETTER KEY'S GUARD: BUC's own metre word begins with the same letter, so `9.15 mī` must
        // NOT match the bare `m` unit key.
        Assert.Equal("kau˧˧ tieŋ˧˧ ɛiʔ˨˦ ŋou˨˦˨ mi˧˧", Text("9.15 mī"));
    }

    [Fact]
    public void TheDegreeAndTheTemperature()
    {
        Assert.Equal("nɛi˨˦˨ sɛiʔ˨˦ tou˨˦˨", Text("20 °C"));
        Assert.Equal("sɛiʔ˨˦ kau˧˧ tieŋ˧˧ løyʔ˥ tou˨˦˨", Text("19.6℃"));
        // `°F` gets the same bare-degree reading — cdo has no scale name in any source.
        Assert.Equal(Text("100 °C"), Text("100 °F"));
        // A COORDINATE is claimed whole before the bare-degree rule can eat its °.
        Assert.Equal(
            "nɛi˨˦˨ sɛiʔ˨˦ nɛi˨˦˨ tou˨˦˨ sɛiʔ˨˦ ɛiʔ˨˦ huŋ˥˥ sɛi˨˩˧ sɛiʔ˨˦ t͡sʰɛiʔ˨˦ mieu˧˧",
            Text("22° 11′ 47″"));
    }

    [Fact]
    public void TheRangeConnectiveAndTheGuardsThatKeepIdentifiersOut()
    {
        Assert.Equal("suoʔ˥ pɑʔ˨˦ kɑu˨˩˧ t͡sʰɛiʔ˨˦ pɑʔ˨˦ kuŋ˥˥ li˧˧", Text("100 - 700 km"));
        Assert.Contains("kɑu˨˩˧", Text("23~27"));
        Assert.DoesNotContain("kɑu˨˩˧", Text("ISBN 3-88053-113-7"));          // chained dashes
        Assert.DoesNotContain("kɑu˨˩˧", Text("«Mā-tái Hók-ĭng» 22:37-40"));  // a Bible verse
        Assert.DoesNotContain("kɑu˨˩˧", Text("ISO 639-3"));                   // an ALL-CAPS designation
    }

    [Fact]
    public void ARangeThatEndsAClauseKeepsTheConnectiveAndTheMarkStillPauses()
    {
        Assert.Equal("lɑŋ˨˦˨ t͡sʰieŋ˥˥ kɑu˨˩˧ saŋ˥˥ t͡sʰieŋ˥˥ .", Text("2,000-3,000."));
        Assert.Equal("lɑŋ˨˦˨ pɑʔ˨˦ kɑu˨˩˧ saŋ˥˥ pɑʔ˨˦ ,", Text("200-300,"));
        Assert.Contains("kɑu˨˩˧", Text("100 - 700 km."));
        // And the guards still hold at a sentence end.
        Assert.DoesNotContain("kɑu˨˩˧", Text("ISO 639-3."));
        Assert.DoesNotContain("kɑu˨˩˧", Text("«Sĕng-mêng Gé» 5:6-21."));
        Assert.DoesNotContain("kɑu˨˩˧", Text("ISBN 3-88053-113-7."));
    }

    [Fact]
    public void TheFractionIsDenominatorFirstAndAYearPairIsNotAFraction()
    {
        Assert.Equal("sɛi˨˩˧ huŋ˥˥ t͡si˥˥ ɛiʔ˨˦", Text("1/4"));
        Assert.DoesNotContain("huŋ˥˥ t͡si˥˥", Text("2020/2021"));
    }

    [Fact]
    public void TheYearIsDeliberatelyUntouched()
    {
        Assert.Equal($"{Text("1749")} nieŋ˥˧", Text("1749 nièng"));
        Assert.Equal("suoʔ˥ t͡sʰieŋ˥˥ t͡sʰɛiʔ˨˦ pɑʔ˨˦ sɛi˨˩˧ sɛiʔ˨˦ kau˧˧", Text("1749"));
    }

    [Fact]
    public void ASuperscriptIsARomanizationToneNumberNotAPower()
    {
        Assert.DoesNotContain("piŋ˥˧ huoŋ˥˥", Text("hoeng¹ gong²"));
        Assert.DoesNotContain("piŋ˥˧ huoŋ˥˥", Text("/y⁵³ y³⁵ touŋ³³/"));
    }
}
