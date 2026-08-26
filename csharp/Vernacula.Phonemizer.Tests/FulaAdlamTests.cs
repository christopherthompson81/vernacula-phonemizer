/**
 * ⚠ ADLAM IS ASTRAL, AND THE PARITY GATE CANNOT SEE IT. Fula's 200 golden rows are FLEURS ff_sn, which is
 * entirely Latin — the FLEURS transcript, `tools/corpus/mined/ff.jsonc` and `tools/corpus/attest/ff.jsonc`
 * hold ZERO code points in U+1E900–1E95F between them. Every earlier astral defect in this port
 * (`[]` reparsed as a lone-surrogate class, `\p{L}` matching neither half of an astral letter) was found by
 * a unit test rather than by a differential, for exactly this reason: no probe carried Adlam.
 *
 * These tests carry Adlam. The values are the TypeScript engine's, taken from a 346-line × 5-mode
 * differential against Node.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Fula;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class FulaAdlamTests
{
    public FulaAdlamTests() => Languages.Bootstrap.EnsureRegistered();

    [Theory]
    // The base letters, upper and lower, and the −0x22 case fold that folds one onto the other.
    [InlineData("𞤢𞤤𞤢", "ala")]
    [InlineData("𞤀𞤤𞤢", "ala")]
    [InlineData("𞤔𞤢𞤲𞤺𞤮", "jango")]
    // The COMBINING marks, which double what was just written rather than mapping to anything.
    [InlineData("𞤢𞥄", "aa")]        // ALIF LENGTHENER after a vowel
    [InlineData("𞤢𞥅", "aa")]        // VOWEL LENGTHENER after a vowel
    [InlineData("𞤦𞥄", "b")]         // …and NOT after a consonant
    [InlineData("𞥄𞤢", "a")]         // …nor with nothing before it
    [InlineData("𞤦𞥆𞤢", "bba")]      // GEMINATION MARK doubles the previous base
    [InlineData("𞤻𞥆𞤢", "nynya")]    // …including a TWO-letter base
    [InlineData("𞥆𞤢", "a")]         // …and is a no-op with no previous base
    [InlineData("𞤢𞥇𞤢", "aqa")]      // HAMZA → the glottal ⟨q⟩
    [InlineData("𞤢𞥈𞤢", "aa")]       // the three rare foreign-sound marks are DROPPED
    [InlineData("𞤢𞥉𞤢", "aa")]
    [InlineData("𞤢𞥊𞤢", "aa")]
    // Unknown astral characters PASS THROUGH — U+1E94B is in the block but in none of the tables.
    [InlineData("𞤢𞥋𞤢", "a\U0001E94Ba")]
    [InlineData("𐐷𞤢", "\U00010437a")]
    // The digit fold, which is guarded to the Adlam range so the "unknown" signal survives.
    [InlineData("𞥐𞥑𞥒", "012")]
    public void AdlamTransliteratesToBoko(string adlam, string boko) =>
        Assert.Equal(boko, FulaAdlam.AdlamToLatin(adlam));

    [Theory]
    [InlineData("𞤢", true)]
    [InlineData("𞥐", true)]
    [InlineData("\U0001E95F", true)]   // the last code point of the block
    [InlineData("ala", false)]
    [InlineData("\U00010437", false)]  // Deseret — astral, but not Adlam
    [InlineData("", false)]
    public void IsAdlamSeesTheWholeBlockAndNothingElse(string s, bool expected) =>
        Assert.Equal(expected, FulaAdlam.IsAdlam(s));

    /**
     * ⚠ THE ASTRAL-ONLY CLASS. `[\u{1E950}-\u{1E959}]` once emitted `[]|alt`, which .NET reparsed into a
     * class matching LONE SURROGATES — so the Adlam digit class matched every NEIGHBOURING astral code
     * point. U+1E94F and U+1E95A sit either side of the digit run and must read as nothing.
     */
    [Fact]
    public void TheAdlamDigitClassStopsAtTheDigits()
    {
        Assert.Equal("\U0001E94F\U0001E95A", FulaAdlam.AdlamToLatin("\U0001E94F\U0001E95A"));
        Assert.Equal("", Phonemizer.Phonemize("\U0001E94F\U0001E95A", "ff"));
        Assert.Equal("mˈeːɾe", Phonemizer.Phonemize("𞥐", "ff"));
    }

    [Theory]
    // Both scripts read to the SAME IPA — that is the whole point of transliterating rather than
    // giving Adlam its own g2p.
    [InlineData("𞤢𞤤𞤢", "ala")]
    [InlineData("𞤦𞥆𞤢", "bba")]
    [InlineData("𞤢𞥄𞤤𞤢", "aala")]
    [InlineData("𞤐𞤣𞤢", "nda")]
    [InlineData("𞤅𞤸𞤢", "sha")]
    public void TheTwoScriptsAgree(string adlam, string boko) =>
        Assert.Equal(FulaPhonemizer.PhonemizeWord(boko), FulaPhonemizer.PhonemizeWord(adlam));

    [Theory]
    [InlineData("𞤢𞤤𞤢", "ˈala")]
    [InlineData("𞤢𞥄𞤤𞤢", "ˈaːla")]
    [InlineData("𞤔𞤢𞤲𞤺𞤮 𞤅𞤫𞤯𞤮.", "d͡ʒˈaᵑɡo sˈeɗo .")]
    [InlineData("Ha 𞥑𞥒𞥓 nje.", "hˈa teːmedˈeɾe ˈe nˈoːɡaːs ˈe tˈati ⁿd͡ʒˈe .")]
    [InlineData("𞥑,𞥐𞥐𞥐", "ud͡ʒuⁿdˈeɾe")]
    public void AdlamTextReadsThroughTheWholeEngine(string text, string ipa) =>
        Assert.Equal(ipa, Phonemizer.Phonemize(text, "ff"));

    /**
     * ⚠ A LONE SURROGATE REACHES `LatinPhone`, AND .NET's `Normalize` THROWS ON ONE WHERE JS DOES NOT.
     * Fula's g2p indexes UTF-16 code UNITS (`w[i]`, faithfully), so a pass-through astral character arrives
     * one half at a time. Before the guard in Core/LatinPhones.cs this threw `ArgumentException: String
     * contains invalid Unicode code points` on any Adlam text carrying an unmapped astral character — the
     * "silent undefined on one side is a throw on the other" asymmetry, caught by an Adlam probe.
     */
    [Fact]
    public void AnUnmappedAstralCharacterDoesNotThrow()
    {
        Assert.Equal("ˈaa", Phonemizer.Phonemize("𞤢𞥋𞤢", "ff"));
        Assert.Equal("ˈala", Phonemizer.Phonemize("𐐷 𞤢𞤤𞤢 𐐷", "ff"));
    }
}
