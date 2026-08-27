// The three marks Armenian writes INSIDE a word — the portable half of test/armenian.test.ts's mark case.
//
// ⚠ NOT ONE OF THEM IS IN THE 200-ROW GOLDEN, so the parity gate cannot reach this rule at all: both
// engines agreed on the broken reading for as long as it shipped. The evidence is a corpus-wide
// differential (FLEURS hy_am + tools/corpus/mined/hy.jsonc, 4,465 unique lines: ՛ inside a word ×32,
// ՞ inside a word ×15), and these assertions are the only gate either engine has on it.
//
// ⚠ ASSERTED AGAINST THE SHARED ENGINE ON PURPOSE. The rule was Eastern's normalize step 0 and it worked,
// but the word it repairs is broken by the SHARED tokenizer — so Western Armenian inherited the defect and
// none of the fix. It now lives in `Armenian.UnbreakMarks`, and this file pins it there so hyw lands right.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ArmenianMarksTests
{
    [Theory]
    // ՛ (շեշտ) and ՜ (բացականչական) are SILENT — they have no CLAUSE_MARK entry. All the rule does is stop
    // them splitting the word and stranding a fragment with epenthetic schwa.
    [InlineData("կա՛մ մսով", "kɑm məsov")]  // was `kɑ mə məsov`
    [InlineData("ո՛չ", "vot͡ʃʰ")]            // was `vo t͡ʃʰə` — the ⟨ո⟩→[vo] glide fired on a one-letter fragment
    [InlineData("Տե՛ս", "tes")]             // was `te sə`
    // ՞ (հարցական) IS a real clause mark, so it moves to the end of the word rather than being dropped.
    [InlineData("Ինչո՞ւ", "int͡ʃʰu ?")]      // was `int͡ʃʰo ? və` — the mark split the ⟨ու⟩ digraph as well
    [InlineData("Ինչպե՞ս", "int͡ʃʰpes ?")]   // was `int͡ʃʰpe ? sə`
    [InlineData("Ինչու՞", "int͡ʃʰu ?")]      // already right before the rule, and stays right
    public void MarksWrittenInsideAWordDoNotSplitIt(string input, string expected) =>
        Assert.Equal(expected, Phonemizer.Phonemize(input, "hy"));

    [Fact]
    public void TheArcMinuteIsNotAnEmphasisMark()
    {
        // ՛ after a DIGIT is a coordinate (×9 in the hy corpus, every one). It has no letter before it, so
        // it never matches the rule — it stays dropped, which is what it did before.
        Assert.Equal("kʰəsɑn vet͡sʰ ɑstit͡ʃɑn kʰəsɑn t͡ʃʰoɾs", Phonemizer.Phonemize("26°24՛", "hy"));
    }

    [Fact]
    public void TheInterWordPauseIsUntouched()
    {
        // ՝ (U+055D) is Armenian's own inter-word pause — 1,096 corpus instances, none inside a word. It is
        // deliberately NOT in the class, and belongs exactly where it is written.
        Assert.Equal("ɑsɑt͡sʰ , bɑɾev", Phonemizer.Phonemize("Ասաց՝ բարև", "hy"));
    }
}
