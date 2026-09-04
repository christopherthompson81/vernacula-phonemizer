/**
 * British English (en-GB) — modern Standard Southern British / "BBC", an ACCENT VARIANT of the General-American
 * `en` engine (not a separate language). Reuses the full English G2P (dict + heteronyms + OOV model) and applies
 * a phonological DELTA — a lexical-set transform — to the GenAm output.
 * Ported from src/languages/english-gb/english-gb.ts — see that file for the delta in full and for the referee
 * (wikipron eng_latn_uk, 76k).
 *
 * ⚠ THIS IS THE ONE VARIANT THAT NEEDS THE WORD, not just the IPA. Four of the five lexical sets cannot be
 * derived from GenAm output at all — GenAm does not carry the BATH/TRAP or CLOTH/THOUGHT splits, so membership
 * is a word list. That is why the delta rides the engine's per-word hook with `(ipa, word)`, and why no
 * declarative variant key could ever have expressed it.
 *
 * ⚠ NO ROMAN POLICY: `en-GB` is in `Registry.ROMAN_NATIVE`, so the shared Roman pass is skipped and English
 * resolves numerals in its own normalization.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.English;

namespace Vernacula.Phonemizer.Languages.EnglishGb;

/** The five lexical sets. Membership is a WORD LIST because GenAm output cannot supply it. */
public sealed class LexSets
{
    public required IReadOnlySet<string> Bath { get; init; }   // æ → ɑː
    public required IReadOnlySet<string> Cloth { get; init; }  // ɔː → ɒ
    public required IReadOnlySet<string> Yod { get; init; }    // Cuː → Cjuː
    public required IReadOnlySet<string> Palm { get; init; }   // keep [ɑː] against the LOT rule
    /** ɑːɹ → ɒɹ before a vowel (sorry, borrow — LOT before intervocalic r; cf. starry, which keeps ɑː). */
    public required IReadOnlySet<string> Lotr { get; init; }
}

public static class EnglishGb
{
    /** The vowels the "not before a vowel = coda" guard must know about — the POST-transform alphabet, since
     *  all three uses sit after the GOAT/NURSE/lettER remaps (hence SSBE-only `ɜ`, `ɒ`).
     *  ⚠ `ᵻ` WAS MISSING AND THAT DELETED ONSET /ɹ/ (#1250) — `reports` read *ᵻpʰˈɔːts*. Audited over the
     *  117,479-word dict: `ᵻ` (×828) is the only vowel that can follow an `ɹ` here and was absent, and `ɐ`/`o`
     *  stay though unreachable — the class is a NEGATIVE lookahead, so a missing vowel deletes a consonant
     *  while a dead one costs nothing. See the TS for the audit. */
    // ⚠ `ᶦ`/`ᶷ` JOINED THIS CLASS WITH #1252. The #1250 audit's "the only vowel that could follow an ɹ here"
    // held only because the generic offglide map rewrote them to full ɪ/ʊ before this class was consulted;
    // #1252 deleted that map. A no-op today (`ɹᶦ` cannot occur), added because the error here is one-sided.
    private const string VOWEL = "iɪeɛæəɜɐɑɒɔʌʊuoaᵻᶦᶷ";
    /** The same vowels ONE STEP EARLIER, for the two LINKING rules — one step earlier `ɚ`/`ɝ` are still in
     *  the string, because those two rules are what consume them, and they are VOWELS: an `ɚ` before another
     *  one is pre-vocalic (#1250, review). Looking ahead for VOWEL alone deleted the onset /ɹ/ of `ɚɚ` —
     *  `caterer` read *kʰˈeɪtəə* — in 96 dict words. Separate from VOWEL because VOWEL describes the
     *  POST-transform alphabet, which no longer holds either symbol. See the TS. */
    private const string PRE_VOWEL = VOWEL + "ɚɝ";
    /** An /ɹ/ NOT before a (optionally stressed) vowel = coda → non-rhotic.
     *  ⚠ A RUN OF MARKS, NOT ONE (#1250): the parent emits `ˌˈ` together on five dict words (`greedier` is
     *  `ɡɹˌˈiːd̬iʲɚ`), where one optional mark could not see the vowel behind the pair and the ONSET cluster
     *  `ɡɹ` lost its /ɹ/. */
    private const string CODA = $"(?![ˈˌ]*[{VOWEL}])";

    private static IReadOnlySet<string> LoadSet(string file) =>
        new HashSet<string>(LoadTsv.LoadTsvMap("languages/english-gb", file, optional: true).Keys, StringComparer.Ordinal);

    private static LexSets? SETS;
    private static LexSets Sets() => SETS ??= new LexSets
    {
        Bath = LoadSet("en-gb-bath.tsv"),
        Cloth = LoadSet("en-gb-cloth.tsv"),
        Yod = LoadSet("en-gb-yod.tsv"),
        Palm = LoadSet("en-gb-palm.tsv"),
        Lotr = LoadSet("en-gb-lotr.tsv"),
    };

    private static readonly JsRe FLAP_T = JsRegex.Compile("t̬", "gu");
    private static readonly JsRe FLAP_D = JsRegex.Compile("d̬", "gu");
    /** GOAT — RP's central onset, the parent's offglide. ⚠ THE CLOSING DIPHTHONGS KEEP THE SUPERSCRIPT
     *  (#1252): `əʊ eɪ aɪ aʊ ɔɪ` are correct IPA for RP, so this is a CONSISTENCY decision between two
     *  variants of one engine — `en` has written `oᶷ eᶦ aᶦ aᶷ ɔᶦ` for a long time and `en-GB` did not follow
     *  it — and a superscript offglide is ONE unit where two full vowels are two symbols. Measured over the
     *  first 60 golden rows of every ported language, the superscript spellings are where the English family
     *  already lives (`eᶦ` 28 languages, `aᶦ` 27) and the plain ones are mostly Burmese/German/Devanagari
     *  (`eɪ` 2, `aɪ` 13). `eᶦ aᶦ aᶷ ɔᶦ` are now byte-identical to the parent's; only the GOAT ONSET differs,
     *  deliberately — that is REALISATION (RP central vs GenAm back rounded), not notation. `əᶷ` is not novel
     *  to this fleet: Welsh already writes it (`dəᶷˈɛdɔð`). See the TS. */
    private static readonly JsRe GOAT = JsRegex.Compile("oᶷ", "gu");
    private static readonly JsRe PALATAL = JsRegex.Compile("ʲ", "gu");
    private static readonly JsRe NURSE_PREVOCALIC = JsRegex.Compile($"ɝ(?=[ˈˌ]*[{PRE_VOWEL}])", "gu");
    private static readonly JsRe NURSE = JsRegex.Compile("ɝ", "gu");
    private static readonly JsRe LETTER_PREVOCALIC = JsRegex.Compile($"ɚ(?=[ˈˌ]*[{PRE_VOWEL}])", "gu");
    private static readonly JsRe LETTER = JsRegex.Compile("ɚ", "gu");
    private static readonly JsRe LOT = JsRegex.Compile("ɑː(?!ɹ)", "gu");
    // ⚠ FIRST-OCCURRENCE ONLY — no "g" flag. See the note at the call sites.
    private static readonly JsRe BATH_FIRST = JsRegex.Compile("æ", "u");
    private static readonly JsRe CLOTH_FIRST = JsRegex.Compile("ɔː", "u");
    private static readonly JsRe YOD_FIRST = JsRegex.Compile("([tdnszθl])(ʰ?)([ˈˌ]?)uː", "u");
    private static readonly JsRe LOTR_FIRST = JsRegex.Compile("ɑːɹ", "u");
    /** The OFFGLIDE TRIPHTHONGS. ⚠ WITHOUT THESE #1252 WOULD HAVE DELETED A SCHWA IN 238 WORDS: the generic
     *  offglide map used to rewrite `ᶦ`/`ᶷ` to full `ɪ`/`ʊ` first, so NEAR and CURE fired on the result and
     *  turned offglide + coda /ɹ/ into RP's triphthong (`ˈæbʃaᶦɹ` → `ˈæbʃaɪə`). Keeping the superscript stops
     *  them matching and the coda-/ɹ/ drop takes the `ɹ` instead. Named for the GLIDE, not one lexical set:
     *  the patterns are bare, so `ᶦ` covers FACE as well as PRICE/CHOICE. Same CODA guard, so a LINKING /ɹ/ survives
     *  (`əkwˈaᶦɹɪŋ`). See the TS. */
    private static readonly JsRe IGLIDE_R = JsRegex.Compile($"ᶦɹ{CODA}", "gu");
    private static readonly JsRe UGLIDE_R = JsRegex.Compile($"ᶷɹ{CODA}", "gu");
    private static readonly JsRe NEAR = JsRegex.Compile($"ɪɹ{CODA}", "gu");
    private static readonly JsRe SQUARE = JsRegex.Compile($"ɛɹ{CODA}", "gu");
    private static readonly JsRe CURE = JsRegex.Compile($"ʊɹ{CODA}", "gu");
    private static readonly JsRe NORTH = JsRegex.Compile($"ɔːɹ{CODA}", "gu");
    private static readonly JsRe START = JsRegex.Compile($"ɑːɹ{CODA}", "gu");
    private static readonly JsRe CODA_R = JsRegex.Compile($"ɹ{CODA}", "gu");

    /** GenAm citation IPA → SSBE. `lex` (present on the shipped path) supplies `word`'s set membership. */
    public static string ToRP(string genAm, string word, LexSets? lex = null)
    {
        var w = Js.ToLowerCase(word);
        var s = FLAP_D.Replace(FLAP_T.Replace(genAm, "t"), "d"); // un-flap the tapped coronal
        s = GOAT.Replace(s, "əᶷ");
        s = PALATAL.Replace(s, "");                              // drop the palatal on-glide (idea)
        // NURSE ɝ / lettER ɚ: before a vowel keep a LINKING /ɹ/; in coda non-rhotic.
        s = NURSE.Replace(NURSE_PREVOCALIC.Replace(s, "ɜːɹ"), "ɜː");
        s = LETTER.Replace(LETTER_PREVOCALIC.Replace(s, "əɹ"), "ə");
        // LOT: GenAm [ɑː] not before /ɹ/ → [ɒ]; PALM words keep [ɑː].
        if (!(lex is not null && lex.Palm.Contains(w))) s = LOT.Replace(s, "ɒ");
        if (lex is not null)
        {
            // ⚠ FIRST OCCURRENCE ONLY, mirroring the set builder, which validated a first-occurrence edit
            // against the referee. A BATH word may also carry a TRAP æ later (aftermath → ˈɑːftəmæθ, not
            // …mˌɑːθ); a global replace would wrongly convert it. Words whose diagnostic vowel is NOT first
            // never entered the set.
            if (lex.Bath.Contains(w)) s = BATH_FIRST.Replace(s, "ɑː");
            if (lex.Cloth.Contains(w)) s = CLOTH_FIRST.Replace(s, "ɒ");
            // yod-retention: the glide goes after any aspiration and before the stressed vowel.
            if (lex.Yod.Contains(w)) s = YOD_FIRST.Replace(s, "$1$2j$3uː");
            // LOT before intervocalic r — the LOT rule's (?!ɹ) skipped it.
            if (lex.Lotr.Contains(w)) s = LOTR_FIRST.Replace(s, "ɒɹ");
        }
        // Non-rhoticity: remap each vowel + coda /ɹ/, then drop any remaining coda /ɹ/.
        s = IGLIDE_R.Replace(s, "ᶦə");  // any ᶦ-glide + coda r: FACE, PRICE, CHOICE (ayr, fire, choir)
        s = UGLIDE_R.Replace(s, "ᶷə");  // any ᶷ-glide + coda r: MOUTH, GOAT (hour, power, lower)
        s = NEAR.Replace(s, "ɪə");
        s = SQUARE.Replace(s, "ɛə");
        s = CURE.Replace(s, "ʊə");
        s = NORTH.Replace(s, "ɔː");
        s = START.Replace(s, "ɑː");
        return CODA_R.Replace(s, "");
    }

    private static EnglishPhonemizer? GB;
    private static EnglishPhonemizer Eng() => GB ??= EnglishFactory.CreateEnglish();

    /** Bare word → SSBE IPA, SHIPPED path (rule delta + lexical sets). */
    public static string PhonemizeWord(string word) => ToRP(Eng().Text(word), word, Sets());

    /** Bare word → SSBE IPA, RULE-ONLY (no lexical sets) — the non-circular signal for the referee eval. */
    public static string PhonemizeWordRules(string word) => ToRP(Eng().Text(word), word);

    private sealed class EnGbLanguage(EnglishPhonemizer inner, LexSets lex) : ILanguage
    {
        public string Text(string input) => inner.Text(input, (ipa, word) => ToRP(ipa, word, lex), null);
    }

    /**
     * Build the British-English phonemizer. The delta rides the engine's per-word output hook so each word
     * gets its lexical-set membership while reusing the full number/heteronym/prosody context.
     * ⚠ Linking-r ACROSS words is deferred — the hook's scope is one word.
     */
    public static ILanguage CreateEnglishGB() => new EnGbLanguage(EnglishFactory.CreateEnglish(), Sets());

    internal static void RegisterSelf() => Registry.Register("english-gb", CreateEnglishGB);
}
