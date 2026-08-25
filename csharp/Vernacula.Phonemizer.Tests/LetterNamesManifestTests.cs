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
        var fr = Languages.French.Manifest.MANIFEST;
        var ru = Languages.Russian.Manifest.MANIFEST;
        var jv = Languages.Javanese.JavanesePhonemizer.DEF;
        d.Add("fr", fr.LetterNames, fr.Phonotactics.Vowels, fr.Phonotactics.Onsets, fr.Phonotactics.Codas,
            "le port USB fonctionne", "usb", "un TEST de sport", "t");
        // ⚠ RUSSIAN'S TABLE IS CYRILLIC-KEYED, so the spelled run must be Cyrillic: a Latin run inside
        // Russian goes through the script router to English and never reaches this table.
        d.Add("ru", ru.LetterNames, ru.Phonotactics.Vowels, ru.Phonotactics.Onsets, ru.Phonotactics.Codas,
            "ВВП растёт", "ввп", "СПОРТ сегодня", "с");
        // ⚠ JAVANESE GENUINELY SPELLS `SPORT` — it licenses only ⟨ng⟩/⟨ny⟩ as codas, so the ⟨rt⟩ tail is
        // illegal and the run is spelled, correctly. `PRO` reaches the ONSET table instead.
        d.Add("jv", jv.LetterNames, jv.Phonotactics.Vowels, jv.Phonotactics.Onsets, jv.Phonotactics.Codas,
            "port USB mlaku", "usb", "PRO dina iki", "p");
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

    /**
     * ⚠ HAUSA IS EXCLUDED FROM THE CLUSTER ASSERTIONS, and the reason is a PRE-EXISTING DEFECT this lift
     * surfaced rather than caused: its `LegalCodas` are ALL single characters, and 20 of its 29 `LegalOnsets`
     * are too. Initialisms.cs tests `w[..2]` against those sets — a two-character slice — so a one-character
     * entry can never match. Hausa's entire coda list is dead. NOT fixed here: repairing it changes readings
     * and needs Hausa-specific sourcing. This pins the defect so it is visible and will fail when fixed.
     */
    [Fact]
    public void HausaPhonotacticsListsAreDeadDataWhichIsAKnownDefect()
    {
        var ha = Languages.Hausa.Manifest.MANIFEST;
        Assert.All(ha.Phonotactics.Codas, c => Assert.Single(c));
        Assert.True(ha.Phonotactics.Onsets.Count(c => c.Length == 1) > 15);
        Assert.Contains("sh", ha.Phonotactics.Onsets);
        // The letter names ARE live even though the clusters are not.
        foreach (var ch in "cd")
            Assert.Contains(Say("ha", ha.LetterNames[ch.ToString()]), Say("ha", "CD da DNA"));
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

    /**
     * ⚠ A DIFFERENT FACT UNDER A DIFFERENT NAME. ta, te and kn have no `LetterNames` map — they have a
     * CLOSED list of the letter-name spellings AS WRITTEN, used to build the regex that RECOGNISES a
     * dot-separated initialism run so its interior dots can be deleted. Nothing in it is ever emitted as a
     * reading. Filing that under `letterNames` would put two facts under one name.
     *
     * ⚠ Closed by NECESSITY: a generic "short token, dot, short token" rule cannot be written safely against
     * a script with no case distinction — it matches sentence boundaries.
     */
    public static TheoryData<string, IReadOnlyList<string>, string, string> Recognition()
    {
        var d = new TheoryData<string, IReadOnlyList<string>, string, string>();
        d.Add("ta", Languages.Tamil.Manifest.MANIFEST.InitialismLetterForms, "யு.எஸ். அரசு", "யு.எஸ்.");
        d.Add("te", Languages.Telugu.Manifest.MANIFEST.InitialismLetterForms, "యూ.ఎస్. ప్రభుత్వం", "యూ.ఎస్.");
        d.Add("kn", Languages.Kannada.Manifest.MANIFEST.InitialismLetterForms, "ಯು.ಎಸ್. ಸರ್ಕಾರ", "ಯು.ಎಸ್.");
        return d;
    }

    [Theory]
    [MemberData(nameof(Recognition))]
    public void AnInitialismRunIsRecognisedFromTheWrittenForms(
        string code, IReadOnlyList<string> forms, string sentence, string run)
    {
        // With the list empty the regex matches nothing and every interior dot survives as a clause pause.
        Assert.DoesNotContain(" . ", Say(code, sentence));
        Assert.NotEmpty(forms);
        Assert.Contains(forms, f => run.Contains(f, StringComparison.Ordinal));
        // Nothing in the list is emitted — the forms are native script and never reach the IPA.
        foreach (var f in forms) Assert.DoesNotContain(f, Say(code, sentence));
    }
}
