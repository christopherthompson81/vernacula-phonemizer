/**
 * The Modern Greek defects the Rust port found by reading (#1510), fixed TS-first.
 * Ported from test/greek.test.ts's "greek port findings (#1510)" block.
 */
using System.Text;
using Vernacula.Phonemizer.Languages.Greek;
using Xunit;
using GreekNormalize = Vernacula.Phonemizer.Languages.Greek.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class GreekPortFindingsTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "el");

    [Fact]
    public void TeensAreLexicalWords()
    {
        Assert.Equal("δέκα", Numbers.NumberToWords(10));
        Assert.Equal("έντεκα", Numbers.NumberToWords(11));
        Assert.Equal("δώδεκα", Numbers.NumberToWords(12));
        Assert.Equal("δεκατρία", Numbers.NumberToWords(13));
        Assert.Equal("δεκαεννέα", Numbers.NumberToWords(19));
        Assert.Equal("δύο χιλιάδες δεκαέξι", Numbers.NumberToWords(2016));
        Assert.Equal("έντεκα χιλιάδες", Numbers.NumberToWords(11000));
        Assert.Equal("δεκατρείς χιλιάδες", Numbers.NumberToWords(13000));
        Assert.Equal("δεκατέσσερις χιλιάδες", Numbers.NumberToWords(14000));
        Assert.Equal("δεκατρία εκατομμύρια", Numbers.NumberToWords(13_000_000));
        Assert.Equal("iɾθan endeka atoma .", Say("Ήρθαν 11 άτομα."));
    }

    [Fact]
    public void HundredTakesNuBeforeARemainder()
    {
        Assert.Equal("εκατό", Numbers.NumberToWords(100));
        Assert.Equal("εκατόν ένα", Numbers.NumberToWords(101));
        Assert.Equal("εκατόν έντεκα", Numbers.NumberToWords(111));
        Assert.Equal("εκατόν ενενήντα εννέα", Numbers.NumberToWords(199));
        Assert.Equal("εκατόν μία χιλιάδες", Numbers.NumberToWords(101_000));
        Assert.Equal("εκατό χιλιάδες", Numbers.NumberToWords(100_000));
        Assert.Equal("διακόσια ένα", Numbers.NumberToWords(201));
    }

    [Fact]
    public void GreekQuestionMarkIsTheQuestionPause()
    {
        Assert.Equal(Say("Τι κάνεις; Καλά."), Say("Τι κάνεις\u037e Καλά."));
        Assert.Equal("ti kanis ? kala .", Say("Τι κάνεις\u037e Καλά."));
    }

    [Fact]
    public void DecomposedInputReadsAsTheComposedWord()
    {
        foreach (var w in new[] { "τσάι", "κοιλιά", "ρολόι", "Ήρθε\u0387 έφυγε." })
            Assert.Equal(Say(w), Say(w.Normalize(NormalizationForm.FormD)));
        Assert.Equal("t͡sai", Say("τσάι".Normalize(NormalizationForm.FormD)));
    }

    [Fact]
    public void PolytonicLettersFoldToMonotonic()
    {
        Assert.Equal(Say("αρχή"), Say("\u1f00ρχή"));
        Assert.Equal(Say("Η αρχή του λόγου."), Say("\u1f29 \u1f00ρχή τ\u03bf\u1fe6 λόγου."));
        Assert.Equal(Say("ρήτωρ ωδή Αθήναι"), Say("\u1fe5ήτωρ \u1fa0δή \u1f08θ\u1fc6ναι"));
        Assert.Equal("i aɾçi tu loɣu .", Say("\u1f29 \u1f00ρχή τ\u03bf\u1fe6 λόγου."));
        Assert.Equal("καφέ à", GreekNormalize.NormalizeGreek("καφέ à"));
    }

    [Fact]
    public void DigraphReadingsComeFromTheTablesUnchanged()
    {
        var words = new[] { "άγγελος", "έλεγχος", "ελέγχει", "φθόγγος", "γκέι", "Σφίγξ", "μπίρα", "άντε", "τσέπη", "τζάκι", "κέικ" };
        Assert.Equal(
            new[] { "aŋɟelos", "eleŋxos", "eleŋçi", "fθoŋɡos", "ɟei", "sfiŋks", "biɾa", "ande", "t͡sepi", "d͡zaci", "ceik" },
            words.Select(GreekPhonemizer.PhonemizeWordRules).ToArray());
    }

    [Fact]
    public void AnAstralCharacterDoesNotDesyncTheStressMarks()
    {
        Assert.Equal(GreekPhonemizer.PhonemizeWord("τσάι"), GreekPhonemizer.PhonemizeWord("\U0001F600τσάι"));
        Assert.Equal("ɾoloi", GreekPhonemizer.PhonemizeWord("\U0001F600ρολόι"));
    }
}
