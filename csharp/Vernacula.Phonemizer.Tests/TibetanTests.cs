// The portable half of test/tibetan.test.ts — the stack grammar the 200-row golden exercises only in bulk.
//
// Tibetan has one of the deepest orthographies in the world: Classical spelling encodes Old Tibetan and the
// Lhasa reading diverges massively, so the engine PARSES each syllable's stack (prefix · superscript · root ·
// subscript · vowel · suffix · post-suffix) and reads it. Each case below pins one decision of that parse,
// because a stack misparsed in either engine produces a plausible-looking syllable rather than garbage.
//
// ⚠ PORTING bo ALSO CLEARED ak's LAST ROW. Akan's golden carried an embedded Tibetan run and read it silently
// while `bo` was unported — reported by the gate as BLOCKED rather than as a diff. ak is now 131/131.
using Vernacula.Phonemizer;
using BoEngine = Vernacula.Phonemizer.Languages.Tibetan.TibetanPhonemizer;
using BoNormalize = Vernacula.Phonemizer.Languages.Tibetan.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TibetanTests
{
    [Theory]
    // TONOGENESIS — the root's historical voicing sets the tone, and a plain voiced obstruent both LOWERS
    // the tone and surfaces aspirated.
    [InlineData("ཁ", "kʰa˥")]      // kha — voiceless aspirate, HIGH
    [InlineData("ག", "kʰa˩")]      // ga  — plain voiced → aspirated voiceless, LOW
    [InlineData("ང", "ŋa˩")]       // nga — plain sonorant, LOW
    [InlineData("ཁང", "kʰaŋ˥")]    // khang 'house' — suffix -ng → ŋ coda
    // SILENT prefixes / superscripts: they leave no segment, only a tone and a headed onset.
    [InlineData("རྟ", "ta˥")]       // rta 'horse' — superscript r silent, root t HIGH
    [InlineData("མགོ", "ko˩")]     // mgo 'head' — prefix m silent, voiced g→k unaspirated, LOW
    // ONSET CLUSTERS.
    [InlineData("ཁྱི", "kʲʰi˥")]     // khyi 'dog' — ya-btags → palatalized velar
    [InlineData("ཁྲག", "ʈ͡ʂʰaʔ˥")]  // khrag 'blood' — ra-btags → retroflex affricate, -g → ʔ
    [InlineData("ལྷ", "ɬa˥")]       // lha 'god' — subjoined ha → voiceless lateral, HIGH
    // SUFFIX-DRIVEN vowel umlaut / length / nasalization / glottalization.
    [InlineData("བོད", "pʰøʔ˩")]   // bod 'Tibet' — b→pʰ LOW, o→ø, -d → ʔ
    [InlineData("གསལ", "sɛː˥")]    // gsal 'clear' — a→ɛ, -l drops and lengthens
    [InlineData("གསད", "sɛʔ˥")]
    [InlineData("སྤྱན", "t͡ɕɛ̃ː˥")]  // spyan 'eye (H)' — s silent, py→t͡ɕ, -n → front + nasal + length
    // The Lhasa word-tone template: tone is contrastive only on syllable 1.
    [InlineData("བཀྲ་ཤིས", "ʈ͡ʂa˥ɕiː˥")] // bkra shis 'Tashi' — both syllables HIGH
    public void TheStackReadsWhatItClaims(string word, string want) =>
        Assert.Equal(want, BoEngine.PhonemizeWord(word));

    [Theory]
    // ⚠ THE VOWEL-LESS STACK IS THE HARD CASE, and these four are the whole of the disambiguator. With no
    // vowel sign to mark the root, its position comes from the stack SHAPE — a unit bearing subjoined
    // letters IS the root; otherwise the prefix-legality table decides whether a leading g/d/b/m/' is a
    // PREFIX or the ROOT itself. Get it wrong and a real syllable is deleted or a suffix is read as an onset.
    [InlineData("དང", "tʰaŋ˩")]    // 'and' — root ⟨d⟩ + suffix ⟨ng⟩, NOT prefix d + root ng
    [InlineData("གནས", "nɛː˥")]    // gnas 'place' — prefix ⟨g⟩ + root ⟨n⟩ + suffix ⟨s⟩
    [InlineData("གངས", "kʰaŋ˩")]   // gangs 'snow' — root ⟨g⟩ + suffix ⟨ng⟩ + postsuffix ⟨s⟩
    [InlineData("དགའ", "kaː˩")]    // dga' 'joy' — prefix ⟨d⟩ + root ⟨g⟩ + suffix ⟨'⟩
    public void AVowellessStackResolvesItsRootFromTheStackShape(string word, string want) =>
        Assert.Equal(want, BoEngine.PhonemizeWord(word));

    [Theory]
    // The lexical cluster exceptions, each of which overrides the tone its root would otherwise give.
    [InlineData("བློ", "lo˥")]      // blo 'mind' — la-btags → [l], HIGH regardless of root
    [InlineData("གླང", "laŋ˥")]    // glang 'ox'
    [InlineData("དབང", "waŋ˥")]    // dbang 'power' — the db- cluster is historically /w/, HIGH
    [InlineData("དབུ", "ʔu˥")]      // dbu 'head (H)' — db- before /u/ → [ʔ]
    public void TheClusterExceptionsOverrideTheRootsTone(string word, string want) =>
        Assert.Equal(want, BoEngine.PhonemizeWord(word));

    [Fact]
    public void TheVisargaSplitsASyllable() =>
        // ⚠ ཿ U+0F7F is the Sanskrit VISARGA and a syllable TERMINATOR. Without it in the split class,
        // `ཀཿཐོག` (the monastery Kaḥtog) parsed as ONE stack, ⟨ཀ⟩ was taken for a prefix and DELETED, and the
        // word read *tʰoʔ˥* — a whole syllable lost. Its own value is deliberately left unread: Lhasa has no
        // coda /h/ and neither referee holds an instance, so splitting is a fact where a phone would be a guess.
        // Two syllables, and the second takes the word-template's default HIGH. Written out rather than
        // constructed from the parts, because a constructed expectation would encode the same assumption
        // the assertion is meant to test.
        Assert.Equal("ka˥tʰoʔ˥", BoEngine.PhonemizeWord("ཀཿཐོག"));

    [Fact]
    public void TheLoanwordDigraphForFIsRead() =>
        // ⟨ཧྥ⟩ = root ha + SUBJOINED pha, the loanword digraph for /f/ — a sound native Tibetan lacks. The
        // parser used to drop the subjoined letter and read the graphic CARRIER ⟨ཧ⟩, so every one of these
        // Western loans came out with an /h/ it does not have. 31 distinct corpus forms, no counter-example.
        Assert.StartsWith("f", BoEngine.PhonemizeWord("ཧྥ་རན་སི"), StringComparison.Ordinal);

    [Theory]
    // Numeral composition: the units, the teens, the decade CONNECTIVE series (ཉེར, སོ, ཞེ — a DIFFERENT
    // series from the decades themselves, and the arm most likely to be mis-indexed), and the named
    // 10²…10⁹ ladder. ⚠ A multiplier of 1 is left UNSPOKEN, which is why 100/1000/100000 are one syllable.
    [InlineData("0", "lɛʔ˥koː˥")]
    [InlineData("11", "t͡ɕu˥t͡ɕiʔ˥")]
    [InlineData("21", "ɲeː˩t͡ɕiʔ˥")]        // the connective series, not ཉི་ཤུ + unit
    [InlineData("99", "kʰo˩ku˥")]
    [InlineData("100", "kʲa˩")]
    [InlineData("1000", "toŋ˥")]
    [InlineData("100000", "pum˩")]
    [InlineData("1000000000", "tʰeː˥pum˥")]
    public void NumeralsComposeThroughTheSameG2p(string n, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(n, "bo").Trim());

    [Theory]
    [InlineData("0")] [InlineData("11")] [InlineData("21")] [InlineData("99")]
    [InlineData("100")] [InlineData("1000")] [InlineData("100000")] [InlineData("1000000000")]
    public void NoNumeralLeaksADigitOrAVowellessToken(string n)
    {
        // The two failure shapes a composition gap produces, asserted separately from the readings above so
        // a future number-word change fails on the SHAPE even if someone updates the expected strings.
        var got = Phonemizer.Phonemize(n, "bo").Trim();
        Assert.NotEmpty(got);
        Assert.DoesNotMatch("[0-9༠-༩]", got);
        Assert.True(got.Any(c => "aeiouɛøyɔ".Contains(c, StringComparison.Ordinal)), $"no nucleus in {got}");
    }

    [Theory]
    // The normalizer's arms, on its own output where that is the thing under test.
    [InlineData("50%", "་བརྒྱ་ཆ་50")]                    // the word is PREPOSED
    [InlineData("24 km", "་སྤྱི་ལེ་24")]
    [InlineData("1990-2020", "1990ནས་2020བར་")]           // the corpus's own span circumfix
    [InlineData("2020-1990", "2020-1990")]                // …declined when it does not ascend
    public void TheNormalizerRewritesWhatItClaims(string input, string want) =>
        Assert.Equal(want, BoNormalize.NormalizeTibetan(input));

    [Fact]
    public void ACommaGroupedThousandIsNotCutInHalf() =>
        // ⚠ Before the comma can be read as a clause pause. And never after a lone `0` — no convention
        // groups from zero, so joining would be a 1000× error rather than a reading of one.
        Assert.Equal("31200", BoNormalize.NormalizeTibetan("31,200"));
}
