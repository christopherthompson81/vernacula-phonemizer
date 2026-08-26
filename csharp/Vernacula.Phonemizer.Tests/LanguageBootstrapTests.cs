// The registration seam — the C# stand-in for registry.ts's static imports, and the two ways it can be wrong.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Afrikaans;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LanguageBootstrapTests
{
    [Fact]
    public void BootstrapInstallsTheNeuralTable()
    {
        // ⚠ THE BOOTSTRAP OWNS BOTH TABLES. It once registered only the sync engines, so the FIRST
        // phonemizeAsync call in a process found no neural entry, served the rule reading, and installed
        // the table on its way out — one wrong utterance per process, invisible from the second call on.
        // Found by the parity gate (af: 1 of 200 rows, the first), not by any unit test, which is why the
        // invariant is pinned here.
        Registry.EnsureLanguages();
        Assert.NotNull(NeuralRegistry.GetNeuralPhonemizer("af"));
        Assert.NotNull(Phonemizer.GetNeuralPhonemizer("af"));
    }

    [Fact]
    public void UnportedLanguageIsReportedRatherThanGuessedAt()
    {
        // A missing engine must be a NAMED failure. The script router catches this exception and drops the
        // run, so without the record a golden row simply differs and reads as a porting bug in the language
        // that was ported — Quechua's Cyrillic rows are read by the RUSSIAN engine.
        // ⚠ THE SAMPLE MUST BE A LANGUAGE THAT IS STILL UNPORTED, so it changes as the port advances — it was
        // `de` until German landed. Pick one far down the queue rather than the next one up, so this does not
        // have to be edited every batch.
        Assert.Throws<NotImplementedException>(() => Registry.GetPhonemizer("is"));
        Assert.Contains("icelandic", Registry.PortPending);
    }

    [Theory]
    [InlineData("qu", "iskay chunka", "ˈiskaj ˈt͡ʃunka")]   // read off the TypeScript engine, not guessed
    [InlineData("af", "twee", "twˈiə")]           // ⟨tw⟩ is the glide, not [v] — the W_GLIDE_AFTER rule
    [InlineData("en", "virgin branson", "vˈɝd͡ʒɪn bɹˈænsən")]   // the ARPABET conditional vowels (ER/AH)
    [InlineData("ru", "XIX веке", "dʲɪvʲɪtnˈat͡sətɨj vʲˈekʲe")]   // the Roman pass takes ru's ORDINAL policy
    [InlineData("el", "15ο", "ðekato pempto")]   // the Greek ending is the CASE, and both members inflect
    [InlineData("en", "The word λόγος means word", "ðə wˈɝd loɣos mˈiːnz wˈɝd")]   // the script router reaches el
    // Igbo reads tone ONLY where the diacritic is written, and the dotted vowels are the [-ATR] set — the
    // same reading whether the input arrives precomposed or decomposed.
    [InlineData("ig", "Ábụ̄jà", "a˥bʊ˧d͡ʒa˩")]
    // The unit noun LEADS its number, and the English ordinal tail becomes `nke` + the Igbo cardinal.
    [InlineData("ig", "10 km", "kilomita iɾi")]
    [InlineData("ig", "8th", "nke asatɔ")]
    // Oromo's two defining shapes: the enclitic GLUED TO THE DIGITS attaches to the numeral word with the
    // linking vowel its stem demands, and the measure noun leads its number (head-initial).
    [InlineData("om", "1994tti", "kˈuma ᶑˈibːa saɡˈal saɡaltamˈiː afurˈitːi")]
    [InlineData("om", "mm 5", "miːliːmˈeːtira ʃˈan")]
    // Sundanese's three defining shapes: the SECOND SCRIPT (Aksara Sunda, assembled back to the Latin
    // orthography and read by the same g2p), the same-vowel hiatus glottal, and the schwa penult that
    // cannot bear stress so the mark shifts to the final vowel.
    [InlineData("su", "ᮃᮊ᮪ᮞᮛ ᮞᮥᮔ᮪ᮓ", "ʔaksˈara sˈunda")]
    [InlineData("su", "naam", "nˈaʔam")]
    [InlineData("su", "hese", "həsˈə")]
    // Uzbek's three defining shapes: the `N-word` hyphen is the ORDINAL writing, the comma-letter ⟨oʻ⟩ is
    // [o] against ⟨o⟩'s [ɒ] (and the ng/gʻ guard keeps toʻngʻiz off [ŋ]), and a Roman century is ordinal.
    [InlineData("uz", "1978-yildagi", "mˈiŋ toqqˈiz jˈuz jetmˈiʃ sakkizint͡ʃˈi jildaɡˈi")]
    [InlineData("uz", "toʻngʻiz", "tonʁˈiz")]
    [InlineData("uz", "XIX asr", "ˈon toqqizint͡ʃˈi ˈasr")]
    // Lao's four defining shapes: the Cຼ ligature survives the leading-vowel REORDER and the coda
    // lookahead (both dropped the [l] until #1018), ຫ + sonorant is one HIGH-class onset, the karan ໌
    // silences a whole final cluster down to one coda, and the era marker expands to a word.
    [InlineData("lo", "ກິໂລກຼາມ", "ki˧˥.loː˧˥.klaː˩m")]
    [InlineData("lo", "ຫຼາຍ", "laː˩j")]
    [InlineData("lo", "ວຽງຈັນທນ໌", "ʋiːə˧˥ŋ.t͡ɕa˩n")]
    [InlineData("lo", "ຄ.ສ. 1990", "kʰa˧.li˧t̚.sa˧˥k̚.ka˧˥.laː˥˨t̚ nɯ˧ŋ pʰa˧˥n ka˥˨w hɔː˥˨j ka˥˨w si˧˥p̚")]
    // Azerbaijani's defining shapes. ⚠ THE DOTTED/DOTLESS I PAIR IS THE ONE TO PIN: ⟨I⟩ names *ı* and ⟨İ⟩
    // names *i*, and every plain-fold shortcut (JS `toLowerCase`, .NET `ToLower`, a Turkish-locale cast)
    // collapses the contrast in a direction no golden row happens to expose. Then the Oghuz consonants that
    // separate az from tr — ⟨q⟩ → [ɡ] devoicing to [x] word-finally, ⟨ğ⟩ → [ɣ] rather than lengthening —
    // and the Roman century, which this orthography writes as an ordinal with no suffix.
    [InlineData("az", "ITV", "ˈɯ tˈe vˈe")]
    [InlineData("az", "İTV", "ˈi tˈe vˈe")]
    [InlineData("az", "I&O şirkəti", "ˈɯ vˈæ ˈo ʃiɾcætˈi")]
    [InlineData("az", "oxumaq lazımdır", "oxumˈɑx ɫɑzɯmdˈɯɾ")]
    [InlineData("az", "dağ və oğul", "dˈɑɣ vˈæ oɣˈuɫ")]
    [InlineData("az", "XIX əsr", "ˈon doɡːuzund͡ʒˈu ˈæsɾ")]
    [InlineData("az", "1767-ci ildə", "mˈin jedːˈi jˈyz ɑɫtmˈɯʃ jedːind͡ʒˈi ildˈæ")]
    [InlineData("az", "QHT nümayəndəsi", "ɡˈe hˈe tˈe nymɑjændæsˈi")]
    [InlineData("az", "b.e.ə. 500-cü ildə", "eɾɑmɯzdˈɑn ævvˈæl bˈeʃ jyzynd͡ʒˈy ildˈæ")]
    public void PortedEnginesAnswer(string code, string text, string expected) =>
        Assert.Equal(expected, Phonemizer.Phonemize(text, code));

    [Fact]
    public async Task AfrikaansAsyncUsesTheTagger()
    {
        // The tagger tier sits between the two lexicons and the rules; on an OOV word the async reading
        // must differ from the rule reading, or the tier is not wired at all.
        const string oov = "dreinsisteme";
        var rules = AfrikaansPhonemizer.PhonemizeWordRules(oov);
        var async = await Phonemizer.PhonemizeAsync(oov, "af");
        Assert.NotEqual(rules, async);
    }

    [Fact]
    public async Task SindhiAsyncUsesTheTagger()
    {
        // Same invariant one abjad over: the tagger restores the unwritten short vowels between the lexicon
        // and the default-ə rules, so an OOV word must read differently on the async path.
        const string oov = "چيو"; // rule t͡ʃˈiːʋ → neural t͡ʃjˈoː, the و glide↔vowel reinterpretation
        var rules = Languages.Sindhi.SindhiPhonemizer.PhonemizeWordRules(oov);
        var async = await Phonemizer.PhonemizeAsync(oov, "sd");
        Assert.NotEqual(rules, async);
    }
}
