/**
 * The INITIALISM TIER's two tables — `letterNames` and `phonotactics` — read from each language's manifest.
 * Ported from test/letternames-manifest.test.ts.
 *
 * ⚠ ONE TEST FOR A BATCH OF LANGUAGES, BY DESIGN: the lift is the same change in every language, so what
 * differs is the DATA, and the theory below reads it from each manifest rather than restating it.
 */
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LetterNamesManifestTests
{
    /** code, letterNames, phonotactics, a run that must be SPELLED, a run that must be READ, its initial. */
    public static TheoryData<string, IReadOnlyDictionary<string, string>, string, IReadOnlyList<string>,
        IReadOnlyList<string>, string, string, string, string> Cases()
    {
        var d = new TheoryData<string, IReadOnlyDictionary<string, string>, string, IReadOnlyList<string>,
            IReadOnlyList<string>, string, string, string, string>();
        var nl = Languages.Dutch.Manifest.MANIFEST;
        var pl = Languages.Polish.Manifest.MANIFEST;
        var hu = Languages.Hungarian.Manifest.MANIFEST;
        var tr = Languages.Turkish.Manifest.MANIFEST;
        d.Add("nl", nl.LetterNames, nl.Phonotactics.Vowels, nl.Phonotactics.Onsets, nl.Phonotactics.Codas,
            "de USB-poort werkt", "usb", "de SPORT van vandaag", "s");
        d.Add("pl", pl.LetterNames, pl.Phonotactics.Vowels, pl.Phonotactics.Onsets, pl.Phonotactics.Codas,
            "port USB działa", "usb", "ten SPORT dzisiaj", "s");
        d.Add("hu", hu.LetterNames, hu.Phonotactics.Vowels, hu.Phonotactics.Onsets, hu.Phonotactics.Codas,
            "az USB port működik", "usb", "a SPORT ma", "s");
        d.Add("tr", tr.LetterNames, tr.Phonotactics.Vowels, tr.Phonotactics.Onsets, tr.Phonotactics.Codas,
            "USB bağlantı noktası", "usb", "bu SPOR bugün", "s");
        return d;
    }

    private static string Say(string code, string s) =>
        Phonemizer.Phonemize(s, code).Replace("ˈ", "").Replace("ˌ", "");

    /**
     * Languages whose ONLY lifted table is `letterNames` — no phonotactics, because the OOV spell-it-out
     * test does not apply: an embedded Latin run in a Thai, Vietnamese or Chinese sentence is spelled
     * because it is FOREIGN, not because its clusters are illegal.
     */
    public static TheoryData<string, IReadOnlyDictionary<string, string>, string, string> SpellOnly()
    {
        var d = new TheoryData<string, IReadOnlyDictionary<string, string>, string, string>();
        d.Add("th", Languages.Thai.Manifest.MANIFEST.LetterNames, "ระบบ USB ใหม่", "USB");
        d.Add("vi", Languages.Vietnamese.Manifest.MANIFEST.LetterNames, "cổng USB hoạt động", "USB");
        d.Add("cmn", Languages.Mandarin.Manifest.MANIFEST.LetterNames, "USB接口可以用", "USB");
        return d;
    }

    [Theory]
    [MemberData(nameof(SpellOnly))]
    public void AnEmbeddedLatinRunIsSpelledFromLetterNames(
        string code, IReadOnlyDictionary<string, string> letters, string sentence, string run)
    {
        foreach (var ch in run)
        {
            Assert.True(letters.ContainsKey(ch.ToString()), $"{code}: no letterNames entry for {ch}");
            Assert.Contains(Say(code, letters[ch.ToString()]), Say(code, sentence));
        }
        // ⚠ KEYED UPPERCASE, and that is load-bearing — the engine looks a run up by the character as
        // WRITTEN. The loader's camelCase policy applies to PROPERTY names, not dictionary keys; verified
        // rather than assumed, because that policy is what mangled English's ARPABET block.
        Assert.All(letters.Keys, k => Assert.Equal(k.ToUpperInvariant(), k));
        Assert.Equal(26, letters.Count);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void TheLiftedInitialismTablesAreRead(
        string code, IReadOnlyDictionary<string, string> letters, string vowels,
        IReadOnlyList<string> onsets, IReadOnlyList<string> codas,
        string spelledSentence, string spelled, string readableSentence, string initial)
    {
        // The spelled run is composed from letterNames — each letter separately, since the engine may
        // re-stress across the run.
        foreach (var ch in spelled)
        {
            Assert.True(letters.ContainsKey(ch.ToString()), $"{code}: no letterNames entry for {ch}");
            Assert.Contains(Say(code, letters[ch.ToString()]), Say(code, spelledSentence));
        }

        // ⚠ THE READABLE RUN IS WHAT TESTS `phonotactics` AT ALL. Asserting the table's shape only proves
        // the DATA is there; emptying `legalOnsets` still passed until this assertion existed.
        Assert.DoesNotContain(Say(code, letters[initial]), Say(code, readableSentence));

        Assert.NotEmpty(vowels);
        Assert.NotEmpty(onsets);
        Assert.NotEmpty(codas);
        foreach (var c in onsets.Concat(codas))
        {
            Assert.DoesNotContain(' ', c);
            Assert.True(c.Length >= 2, $"{code}: cluster {c} is shorter than two characters");
        }

        // ⚠ A LETTER NEED NOT BE IN THE TABLE. Initialisms.cs falls back to the letter itself, so a gap
        // spells the character rather than leaking "undefined". Turkish is the case here: its vowel class
        // carries the loanword circumflexes ⟨â î û⟩, which have no distinct NAME and are deliberately absent.
        foreach (var (k, v) in letters)
        {
            Assert.NotEqual("", v);
            Assert.NotEqual("", k);
        }
    }
}
