/**
 * British English (en-GB) — modern Standard Southern British / "BBC", an ACCENT VARIANT of the General-American
 * `en` engine (not a separate language). Reuses the full English G2P (dict + heteronyms + OOV model) and applies
 * a phonological DELTA — a lexical-set transform — to the GenAm output.
 * Ported from src/languages/english-gb/english-gb.ts — see that file for the delta in full and for the referee
 * (wikipron eng_latn_uk, 76k).
 *
 * ⚠ THIS IS THE ONE VARIANT THAT NEEDS THE WORD, not just the IPA. Five of the six lexical sets cannot be
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

/** The six lexical sets. Membership is a WORD LIST because GenAm output cannot supply it. */
public sealed class LexSets
{
    public required IReadOnlySet<string> Bath { get; init; }   // æ → ɑː
    public required IReadOnlySet<string> Cloth { get; init; }  // ɔː → ɒ
    public required IReadOnlySet<string> Yod { get; init; }    // Cuː → Cjuː
    public required IReadOnlySet<string> Palm { get; init; }   // keep [ɑː] against the LOT rule
    /** ɑːɹ → ɒɹ before a vowel (sorry, borrow — LOT before intervocalic r; cf. starry, which keeps ɑː). */
    public required IReadOnlySet<string> Lotr { get; init; }

    /// ɒ → æ: the FOREIGN (a) set — a foreign /a/ GenAm nativises as LOT and RP as TRAP (#1414). The TS twin
    /// carries the reasoning: `pasta`, `taco`, `drachma`, `regatta`, `dacha`, `salsa`, `piazza`, `goulash`.
    /// ⚠ THE ONLY SET WHOSE INPUT THE LOT RULE ITSELF CREATED, so it is not undoing something the parent
    /// wrote — it names the words where LOT should never have fired. BATH is `æ → ɑː` and PALM is `ɒ → ɑː`,
    /// both the other way, which is why there was no set expressing this direction at all.
    public required IReadOnlySet<string> Trap { get; init; }

    /// ɛɹ → æɹ before a vowel: the marry–merry merger, UNDONE for RP. The TS twin carries the reasoning —
    /// GenAm (and Canadian) has marry = merry = Mary, SSBE keeps them apart, and the parent's dictionary was
    /// INCOHERENT about it (`arrogate` æ beside `arrogance` ɛ) until it was made consistently merged.
    /// ⚠ A WORD LIST, NOT A RULE: a blanket ɛɹ→æɹ would wrongly convert `merry`, `very`, `ferry`, `error`,
    /// `America`, which are genuinely ɛ in BOTH varieties.
    public required IReadOnlySet<string> Marry { get; init; }

    /// word → the GenAm-alphabet citation this accent starts from, REPLACING the parent's.
    ///
    /// ⚠ EVERY OTHER TABLE HERE IS AN ACCENT DELTA AND THIS ONE IS NOT. The six sets above say how the SAME
    /// word is realised differently; this one says the two varieties do not use the same word. British
    /// `aluminium` is /ˌæljʊˈmɪniəm/ against GenAm `aluminum` /əˈluːmɪnəm/ — five syllables against four,
    /// stressed on a different one — and no phonological rule gets from one to the other. Nor should one
    /// try: a transform able to insert a syllable and move the stress could do it to words that merely
    /// sound different, which is the class this file exists to handle correctly.
    ///
    /// ⚠ AND THE PARENT IS NOT WRONG ABOUT ITS OWN WORD: CMUdict lists `aluminium AH0 L UW1 M IH0 N AH0 M`,
    /// a GenAm reference deliberately reading the British SPELLING as the American WORD. This table is
    /// additive and changes no GenAm reading.
    ///
    /// ⚠ THE VALUE IS IN THE PARENT'S ALPHABET, NOT SSBE, so the whole delta still runs over it. `clerk` is
    /// stored `klˈɑːɹk` and START makes it `klˈɑːk`; storing the finished form would freeze a reading that
    /// then stopped tracking every later rule change. A word needing a set membership joins that set as
    /// usual — `tomato` is in en-gb-palm.tsv, because in RP it genuinely is a PALM word.
    ///
    /// ⚠ AN OPTIONAL SECOND FIELD IN THE VALUE (`to\tfrom`) IS THE GenAm READING THE ROW MAY REPLACE, and
    /// the row then applies only when the parent actually produced it. The substitution is POS-BLIND and the
    /// parent is not: `progress` is `pɹˈɑːɡɹɛs` as a noun and `pɹəɡɹˈɛs` as a verb, and unguarded it put
    /// the NOUN's citation into a VERB frame — "we progress quickly" — which is the wrong-within-one-sentence
    /// failure the inflection rows exist to prevent, arriving through the lemma. A row without the field is
    /// unconditional, which is right for a word with one reading.
    public required IReadOnlyDictionary<string, string> Lexical { get; init; }
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
     *  `ɡɹ` lost its /ɹ/.
     *  ⚠ AND A SYLLABIC CONSONANT IS A NUCLEUS (#1403), which is the same defect with `n̩`/`ɫ̩`/`m̩` in
     *  place of the stress run: the syllabic mark REMOVES the vowel that followed the /ɹ/, so the bare
     *  vowel test read an onset cluster as a coda. `children` came out `t͡ʃˈɪɫdn̩`, `neutral` `njˈuːtɫ̩`,
     *  `nostril` `nˈɒstɫ̩` — 34 words losing a cluster /ɹ/ RP pronounces. See the TS. */
    private const string SYLLABIC = "\u0329";
    private const string CODA = $"(?![ˈˌ]*(?:[{VOWEL}]|[nmɫlŋ]{SYLLABIC}))";

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
        Trap = LoadSet("en-gb-trap.tsv"),
        Marry = LoadSet("en-gb-marry.tsv"),
        Lexical = LoadTsv.LoadTsvMap("languages/english-gb", "en-gb-lexical.tsv", optional: true),
    };

    /// The words the lexical-variant table owns. The TS twin exports this for the set builder, which must
    /// not claim one into an ACCENT set; kept here so the two ports declare the same surface.
    public static IReadOnlySet<string> LexicalVariants() =>
        new HashSet<string>(Sets().Lexical.Keys, StringComparer.Ordinal);

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
    /** ⚠ The syllabic nucleus belongs here too — these are the same test one step earlier, and the first
     *  version of the CODA fix missed them, so an `ɚ`/`ɝ` before a syllabic consonant fell through to the
     *  unconditional `ɚ→ə` and the onset /ɹ/ vanished (`natural`, `mineral`, `squirrel`). See the TS. */
    private const string PRE_NUCLEUS = $"(?=[ˈˌ]*(?:[{PRE_VOWEL}]|[nmɫlŋ]{SYLLABIC}))";
    private static readonly JsRe NURSE_PREVOCALIC = JsRegex.Compile($"ɝ{PRE_NUCLEUS}", "gu");
    private static readonly JsRe NURSE = JsRegex.Compile("ɝ", "gu");
    private static readonly JsRe LETTER_PREVOCALIC = JsRegex.Compile($"ɚ{PRE_NUCLEUS}", "gu");
    private static readonly JsRe LETTER = JsRegex.Compile("ɚ", "gu");
    private static readonly JsRe LOT = JsRegex.Compile("ɑː(?!ɹ)", "gu");
    // `\W?` rather than a literal apostrophe class — see the TS twin: the regex-corpus extractor drops
    // any pattern with a literal ' inside a character class, and a dropped pattern is one this engine's
    // JsRegex translator is never tested against.
    private static readonly JsRe ARY_SPELLED = JsRegex.Compile(@"(ar|er|or)(y|ies)\W?s?$", "u");
    private static readonly JsRe ARY_STORY = JsRegex.Compile(@"story\W?s?$", "u");
    private static readonly JsRe ARY_SECONDARY = JsRegex.Compile("ˌ(?:ɛ|ɔː)(ɹiz?)$", "u");
    private static readonly JsRe ARY_UNMARKED = JsRegex.Compile("(?<![ˈˌ])(?:ɛ|ɔː)(ɹiz?)$", "u");
    // ⚠ FIRST-OCCURRENCE ONLY — no "g" flag. See the note at the call sites.
    private static readonly JsRe BATH_FIRST = JsRegex.Compile("æ", "u");
    private static readonly JsRe CLOTH_FIRST = JsRegex.Compile("ɔː", "u");
    private static readonly JsRe YOD_FIRST = JsRegex.Compile("([tdnszθl])(ʰ?)([ˈˌ]?)uː", "u");
    private static readonly JsRe LOTR_FIRST = JsRegex.Compile("[ɑɔ]ːɹ", "u");
    private static readonly JsRe TRAP_FIRST = JsRegex.Compile("ɒ", "u");

    private static readonly JsRe MARRY_FIRST = JsRegex.Compile("ɛ(ˈ|ˌ)?ɹ", "u");
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
        // ⚠ FIRST, AND IT REPLACES THE INPUT RATHER THAN EDITING IT. A lexical variant is a different word,
        // so nothing in the parent's citation is worth keeping; everything below then treats the substitute
        // as though the dictionary had produced it. Shipped path only — `lex` is absent for the referee
        // eval, which must stay non-circular, exactly as the six sets are.
        string? row = null;
        var owned = lex is not null && lex.Lexical.TryGetValue(w, out row);
        string? variant = null;
        if (owned)
        {
            // ⚠ `to` or `to\tfrom` — a row naming the reading it replaces applies only when the parent
            // produced it, so a POS heteronym keeps its other sense. See LexSets.Lexical.
            var tab = row!.IndexOf('\t');
            if (tab < 0) variant = row;
            else if (string.Equals(row.Substring(tab + 1), genAm, StringComparison.Ordinal)) variant = row.Substring(0, tab);
            owned = variant is not null;
        }
        var citation = owned ? variant! : genAm;
        var s = FLAP_D.Replace(FLAP_T.Replace(citation, "t"), "d"); // un-flap the tapped coronal
        s = GOAT.Replace(s, "əᶷ");
        s = PALATAL.Replace(s, "");                              // drop the palatal on-glide (idea)
        // NURSE ɝ / lettER ɚ: before a vowel keep a LINKING /ɹ/; in coda non-rhotic.
        s = NURSE.Replace(NURSE_PREVOCALIC.Replace(s, "ɜːɹ"), "ɜː");
        s = LETTER.Replace(LETTER_PREVOCALIC.Replace(s, "əɹ"), "ə");
        // LOT: GenAm [ɑː] not before /ɹ/ → [ɒ]; PALM words keep [ɑː].
        // ⚠ AND A WORD THE LEXICAL TABLE OWNS IS EXEMPT FROM THIS AND EVERY SET BELOW — see the TS twin.
        // The citation was written with the SSBE target in mind, so a set edit derived for a DIFFERENT
        // word must not run over it. The PHONOLOGICAL rules above still do.
        if (!owned && !(lex is not null && lex.Palm.Contains(w))) s = LOT.Replace(s, "ɒ");
        if (lex is not null && !owned)
        {
            // ⚠ FIRST OCCURRENCE ONLY, mirroring the set builder, which validated a first-occurrence edit
            // against the referee. A BATH word may also carry a TRAP æ later (aftermath → ˈɑːftəmæθ, not
            // …mˌɑːθ); a global replace would wrongly convert it. Words whose diagnostic vowel is NOT first
            // never entered the set.
            // ⚠ marry–merry RUNS FIRST, BEFORE BATH — the TS twin carries the reasoning. Four words are in
            // BOTH sets (`barry`, `clara`, `dara`, `scarry`): the merger made them ɛ, which BATH cannot see,
            // so they came out æ and RP lost `klˈɑːɹə`. Running marry first chains ɛ → æ → ɑː.
            if (lex.Marry.Contains(w)) s = MARRY_FIRST.Replace(s, "æ$1ɹ");
            if (lex.Bath.Contains(w)) s = BATH_FIRST.Replace(s, "ɑː");
            if (lex.Cloth.Contains(w)) s = CLOTH_FIRST.Replace(s, "ɒ");
            // yod-retention: the glide goes after any aspiration and before the stressed vowel.
            if (lex.Yod.Contains(w)) s = YOD_FIRST.Replace(s, "$1$2j$3uː");
            // LOT before intervocalic r — the LOT rule's (?!ɹ) skipped it.
            // ⚠ EITHER GenAm REALIZATION — the TS twin carries the reasoning: #1334 aligned the parent's AA/AO
            // to gold's consistent LOT–THOUGHT split and 7 of this set's 13 words moved from ɑː to ɔː, so
            // matching only ɑːɹ left the rule silently failing on over half its own list.
            if (lex.Lotr.Contains(w)) s = LOTR_FIRST.Replace(s, "ɒɹ");
            // FOREIGN (a) — see LexSets.Trap. The `ɒ` this consumes is the LOT rule's own output.
            // ⚠ IT CANNOT COLLIDE WITH BATH/CLOTH/yod/LOTR — the builder's claim loop `break`s on the first
            // set that claims a word, so those five lists are disjoint by construction (measured: 0, 0, 0, 0).
            // ⚠ BUT `marry` IS BUILT SEPARATELY AND OVERLAPS ON ONE WORD, AND IT CHAINS: `ararat` is in both,
            // and marry→TRAP gives `ˈæɹəɹˌæt`, the referee's reading. The builder probed with marry applied
            // first, so this order is the one the claim was validated under. See the TS twin.
            if (lex.Trap.Contains(w)) s = TRAP_FIRST.Replace(s, "æ");

        }
        // ⚠ THE -ary/-ery/-ory WEAK VOWEL (#1380) — a RULE, not a word list, because the suffix is
        // productive. GenAm carries a secondary-stressed full vowel there and SSBE does not. See the TS
        // twin for the measurement (662 of 774 referee headwords attest the reduced form) and for why the
        // secondary mark is dropped although nothing in this repo can verify that.
        // ⚠ TWO PASSES AND NOT ONE OPTIONAL MARK: the PRIMARY mark also sits before the vowel, so
        // `ˌ?(ɛ|ɔː)ɹi$` matches `ˈɛɹi` with the group empty and reduces the tonic away (`canary`).
        // ⚠ Exempt for a table-owned word, like every rule above it; inflections and the clitic come too
        // (`secretaries`, `secretary's`), and `-story` compounds are excluded — see the TS twin.
        if (!owned && ARY_SPELLED.IsMatch(w) && !ARY_STORY.IsMatch(w))
        {
            s = ARY_SECONDARY.Replace(s, "ə$1");
            s = ARY_UNMARKED.Replace(s, "ə$1");
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

    /** The per-word delta on its own, for the ASYNC entry (EnglishNeural) — same hook, same lexical sets. */
    private static Func<string, string, string>? RP_HOOK;
    public static Func<string, string, string> RpWordTransform()
    {
        if (RP_HOOK is null) { var lex = Sets(); RP_HOOK = (ipa, word) => ToRP(ipa, word, lex); }
        return RP_HOOK;
    }

    internal static void RegisterSelf() => Registry.Register("english-gb", CreateEnglishGB);
}
