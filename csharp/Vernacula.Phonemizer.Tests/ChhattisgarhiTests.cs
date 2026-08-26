/**
 * ⚠ THE hne GOLDEN IS HINDI TEXT RE-RENDERED, NOT CHHATTISGARHI. csharp/goldens/hne.tsv is derived from
 * csharp/goldens/hi.tsv by tools/gen_variant_golden.mts — Chhattisgarhi has no FLEURS corpus, no mined
 * artifact and no attested file — so 200/200 pins C#↔TS parity on the shared Devanagari machinery and
 * nothing about whether the Chhattisgarhi-specific readings are the ones the manifest claims. These tests
 * carry that half, mirroring test/chhattisgarhi.test.ts row for row.
 *
 * ⚠ AND THE ANCHOR IS WEAKER HERE THAN FOR bho, which had tools/corpus/attest/bho.jsonc to draw running
 * text from. There is no equivalent for hne, so there is no "running Chhattisgarhi" block below: every row
 * is either a distinctive-feature word hand-adjudicated against the 1921 grammar, or a pin on an INHERITED
 * Hindi word this language has no source of its own for.
 */
using Vernacula.Phonemizer.Languages.Chhattisgarhi;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ChhattisgarhiTests
{
    public ChhattisgarhiTests() => Languages.Bootstrap.EnsureRegistered();

    [Theory]
    // श/ष→s (the inventory has no /ʃ/) — the one LETTER that maps differently from Hindi.
    [InlineData("शहर", "sˈəɦəɾ")]
    [InlineData("देश", "d̪ˈeːs")]
    [InlineData("शेर", "sˈeːɾ")]
    // ⟨ऐ⟩→ɛː and ⟨औ⟩→ɔː are MONOPHTHONGS as in Hindi, NOT the Bhojpuri diphthongs — the sibling is the
    // wrong thing to copy, and an earlier revision of this manifest had copied it.
    [InlineData("बैल", "bˈɛːl")]
    [InlineData("कौन", "kˈɔːn")]
    [InlineData("गौरव", "ɡˈɔːɾəʋ")]
    // The second divergence, by OMISSION: finalRules is EMPTY where Hindi has three. शहर above covers
    // əɦə→ɛɦɛ; these are the other two arms.
    [InlineData("समय", "sˈəməj")]
    [InlineData("जहर", "d͡ʒˈəɦəɾ")]
    // FILED, NOT FIXED — Hindi's corpus-measured ज्ञ→ɡj postRule is absent, so the ligature reads as its
    // literal parts. See the header of src/languages/chhattisgarhi/chhattisgarhi.ts.
    [InlineData("ज्ञान", "d͡ʒɲˈaːn")]
    [InlineData("विज्ञान", "ʋɪd͡ʒɲˈaːn")]
    // Shared Indo-Aryan core, where Chhattisgarhi does not diverge at all.
    [InlineData("पानी", "pˈaːniː")]
    [InlineData("गाय", "ɡˈaːj")]
    public void WordReadsTheChhattisgarhiDivergence(string word, string ipa) =>
        Assert.Equal(ipa, ChhattisgarhiPhonemizer.PhonemizeWord(word));

    [Theory]
    // ⚠ NOT the bare number. hne declares no symbolTier — and could not use one if it did, since
    // MakeNativeHindi never reads DEF.SymbolTier — so HINDI's tier claims ₹ before this engine's
    // `stripSymbols` ever sees it.
    [InlineData("₹500", "pˈaː̃t͡ʃ sˈɔː ɾˈʊpjeː")]
    // ⚠ Same output, DIFFERENT paths: the percent regex needs an adjacent digit, so `50%` is consumed by the
    // inherited tier and only a bare `%` reaches this manifest's own `symbols` map (with श→s applied).
    [InlineData("50%", "pət͡ʃˈaːs pɾˈət̪ɪsət̪")]
    [InlineData("%", "pɾˈət̪ɪsət̪")]
    [InlineData("16वीं", "soːlˈəɦʋiː̃")]
    // Clock and unit words live in NEITHER manifest — they are hardcoded in hindi/normalize.ts. बजकर is
    // unattested for Chhattisgarhi and unattestable: this repo holds no hne text to check it against.
    [InlineData("11:20", "ɡjˈaːɾəɦ bˈəd͡ʒkəɾ bˈiːs mˈɪnəʈ")]
    [InlineData("5 किमी", "pˈaː̃t͡ʃ kɪloːmˈiːʈəɾ")]
    // Indian lakh/crore grouping, over NATIVE digits — the engine spans \p{Nd}, not ASCII \d.
    [InlineData("१२३४५६७८९", "bˈaːɾəɦ kəɾˈoːɽ t͡ʃɔː̃n̪t̪ˈiːs lˈaːkʰ t͡ʃʰˈəpːən ɦəzˈaːɾ sˈaːt̪ sˈɔː nəʋˈaːsiː")]
    public void TextReadsTheInheritedHindiWords(string text, string ipa) =>
        Assert.Equal(ipa, Phonemizer.Phonemize(text, "hne"));
}
