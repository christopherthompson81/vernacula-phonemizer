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
    // Somali's defining shapes: the Cushitic pharyngeals/retroflex plus gemination and vowel length; the
    // glued calendar letter SPLIT BY DIGIT COUNT (1-2 digits is the million idiom, 3-4 with a year word is
    // the Miilaadi era); the `sq`/`cu` measure word folded case-insensitively onto a declared unit; and the
    // range that ENDS A CLAUSE, which used to fall through to the minus rule and read as a subtraction.
    [InlineData("so", "dhagax abbaan soo'maali", "ɖaɡaħ abːaːn soːʔmaːli")]
    [InlineData("so", "$2M iyo Sanadkii 1999M", "laba miljan doːlar ijo sanadkiː kun ijo saɡaːl boqol ijo saɡaːl ijo saɡaːʃan miːlaːdi")]
    // #1050: an h:mm followed by `:digit` is a ratio/h:m:s/ISO stamp, not a clock; and a glued meridiem
    // used to block the match entirely because JS `\b` is ASCII-only.
    [InlineData("so", "NPK 19:19:19 ah", "npk sa\u0261a\u02d0l ijo toban , sa\u0261a\u02d0l ijo toban , sa\u0261a\u02d0l ijo toban ah")]
    [InlineData("so", "430 SQ MI", "afar boqol ijo sodːon majl laba d͡ʒibaːran")]
    [InlineData("so", "Sanadihii 1960 -1969.", "sanadihiː kun ijo saɡaːl boqol ijo liħdan ilaː kun ijo saɡaːl boqol ijo saɡaːl ijo liħdan .")]
    // Min Nan's three paths, which no other row in this file reaches: the Han dictionary with tone sandhi
    // (台灣 — the non-final syllable takes its sandhi tone), the year+counter shape through the normalizer,
    // and a POJ Latin run folded to Tâi-lô before the g2p (`chit-ê` — POJ ⟨ch⟩ → ⟨ts⟩).
    [InlineData("nan", "台灣", "tai\u032f\u02e7 u\u032fan\u02e8\u02e6")]
    // The shared Han-dict core (Core/HanDictIpa.cs), through its first C# caller. cjy's golden is only 29
    // rows — the language has no wikipedia and no FLEURS — so these pin what it cannot: Han numeral
    // composition, and the year-range path.
    [InlineData("cjy", "1996-2007\u5e74", "i\u0259\u0294\u02e8 t\u0361\u0255i\u0259u\u02e5\u02e7 t\u0361\u0255i\u0259u\u02e5\u02e7 li\u0259u\u02e6\u02e5 tau\u02e6\u02e5 \u0259\u027b\u02e6\u02e5 li\u014b\u02e9\u02e9 li\u014b\u02e9\u02e9 t\u0361\u0255\u02b0i\u0259\u0294\u02e8 nie\u02e9\u02e9")]

    // #1048: POJ is ASCII Latin, so a foreign name used to be read as Min Nan syllables with a tone letter.
    // The dict's own 970 syllable skeletons are the discriminator; a mixed compound keeps both halves.
    [InlineData("nan", "Washington", "w\u02c8\u0251\u02d0\u0283\u026a\u014bt\u0259n")]
    [InlineData("nan", "Ukraina-g\u00ed", "\u02c8u\u02d0k\u0279\u00e6\u02cci\u02d0n\u0259 \u0261i\u02e5\u02e9")]
    [InlineData("nan", "chit-\u00ea l\u00e2ng", "t\u0361\u0255it\u031a\u02e5 e\u02e8\u02e6 la\u014b\u02e8\u02e6")]
    // Saraiki's defining shapes: the four implosives plus the voiced aspirate the Punjabi sibling turns into
    // tone (skr keeps it as a segment), the ZWJ/ZWNJ that used to hide a percentage from the symbol tier, the
    // `US$` key declared ahead of `$`, and the ء year marker sitting between a figure and a range dash.
    [InlineData("skr", "\u06b3\u0648\u0759\u0627 \u0628\u06be\u0684\u0768", "\u0260\u02c8o\u02d0\u0257a\u02d0 b\u02b1\u02c8\u0259\u0284\u0259\u0273")]
    [InlineData("skr", "\u0668\u0665\u066a", "p\u02c8\u0259\u0303\u0272d\u0361\u0292 \u02c8\u0259s\u02d0i\u02d0 f\u02c8i\u02d0s\u0259d\u032a")]
    [InlineData("skr", "US$20 \u0645\u0644\u06cc\u0646", "\u028b\u02c8i\u02d0\u0266 m\u0259l\u02c8i\u02d0n \u0256\u02c8a\u02d0l\u0259\u027e")]
    // Hakka's own arms, which its 200-row golden does NOT reach: the golden carries zero degree signs and
    // zero per-mille, 13 Han rows out of 200, and no grouped-thousands-plus-classifier. The first row is the
    // strongest of them — the Han and Pha̍k-fa-sṳ spellings of 客家人 in ONE sentence, byte-identical,
    // sandhi included, out of two separate artifacts (dict.tsv/hanRun against pfs.tsv/readPfs).
    [InlineData("hak", "客家人 lâu Hak-kâ-ngìn he siông-thùng ke.",
        "hak̚˩ ka˧˥ ŋin˩˩ lau˦˦ hak̚˩ ka˧˥ ŋin˩˩ he˥˧ ɕiɔŋ˦˦ tʰʊŋ˩˩ ke˥˧ .")]
    [InlineData("hak", "20°C", "ŋiap̚˩ sz̩˥˧ ŋi˥˧ səp̚˥ tʰu˥˧")]
    [InlineData("hak", "27°58′38″", "ŋi˥˧ səp̚˥ t͡ɕʰit̚˩ tʰu˥˧ n̩˧˩ səp̚˥ pat̚˩ pun˦˦ sam˦˦ səp̚˥ pat̚˩ miau˧˩")]
    [InlineData("hak", "30-34‰", "t͡ɕʰiɛn˦˦ pun˦˦ t͡sz̩˦˦ sam˦˦ səp̚˥ t͡sz̩˥˧ sam˦˦ səp̚˥ ɕi˥˧")]
    [InlineData("hak", "1,000人", "it̚˩ t͡ɕʰiɛn˦˦ ŋin˩˩")]
    // Above 2^53 the double has lost its low digits, so the Han-dict core degrades to digit-at-a-time.
    [InlineData("hak", "12345678901234567890",
        "it̚˩ ŋi˥˧ sam˦˦ ɕi˥˧ n̩˧˩ liʊk̚˩ t͡ɕʰit̚˩ pat̚˩ kiu˧˩ laŋ˩˩ it̚˩ ŋi˥˧ sam˦˦ ɕi˥˧ n̩˧˩ liʊk̚˩ t͡ɕʰit̚˩ pat̚˩ kiu˧˩ laŋ˩˩")]
    // Malagasy's signature values (⟨o⟩→/u/, ⟨tr⟩→ʈʂ, prenasalized ⟨mb⟩) with penultimate stress, and the
    // units-first `amby` cardinal reached through the number arm.
    [InlineData("mg", "olona mandeha", "ulˈuna maⁿdˈeha")]
    [InlineData("mg", "trano 21", "ʈʂˈanu irˈajka ˈaᵐbi ruapˈulu")]
    [InlineData("mg", "5 km² sy 2 kg", "dˈimi kilometˈaʈʂa turaɖʐˈua sˈi rˈua kˈilo")]
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
