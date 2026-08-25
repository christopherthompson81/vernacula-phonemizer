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
