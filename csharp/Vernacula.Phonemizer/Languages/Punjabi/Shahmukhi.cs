/**
 * Shahmukhi (Perso-Arabic) scanner for Punjabi (pa) — the native abjad front-end used in Pakistan (Gurmukhi is
 * used in India). Scans the script into the SAME raw canonical IPA the Gurmukhi abugida (core/abugida.ts) emits,
 * so the shared Punjabi phonology in punjabi.ts (gemination → length, inherent-schwa deletion, TONOGENESIS, weight
 * stress) applies UNCHANGED — one phonology, two scripts (the Aksara-Jawa pattern). Stored in logical order =
 * phonetic order, so RTL is a non-issue (as for Urdu/Arabic).
 *
 * The tonal crux carries through: the historical voiced-aspirate digraphs بھ گھ دھ ڈھ جھ emit the breathy MARKERS
 * bʱ/ɡʱ/d̪ʱ/ɖʱ/d͡ʒʱ, which punjabi.ts's tonogenesis de-aspirates + tones. Because the abjad omits short vowels, a
 * DEFAULT [ə] stands in between consonants (the shared restoration gap, as for Urdu). See shahmukhi.jsonc.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Punjabi;

public sealed class ShahmukhiDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public string AspirateHe { get; init; } = "";
    public IReadOnlyDictionary<string, string> Aspirates { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LongVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Harakat { get; init; } = new Dictionary<string, string>();
    public string Sukun { get; init; } = "";
    public string Shadda { get; init; } = "";
    public IReadOnlyList<string> Nasalizers { get; init; } = Array.Empty<string>();
    public string InherentVowel { get; init; } = "";
    public IReadOnlyDictionary<string, string> Digits { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Shahmukhi
{
    public static readonly ShahmukhiDef DEF = LoadManifest.Load<ShahmukhiDef>("languages/punjabi", "shahmukhi.jsonc");
    private static IReadOnlyDictionary<string, string> C => DEF.Consonants;
    private static string HE => DEF.AspirateHe;
    private static IReadOnlyDictionary<string, string> ASP => DEF.Aspirates;
    private static IReadOnlyDictionary<string, string> HARAKAT => DEF.Harakat;
    private static readonly IReadOnlySet<string> NASAL = new HashSet<string>(DEF.Nasalizers, StringComparer.Ordinal);
    private static string INH => DEF.InherentVowel;
    private const string ALIF = "ا";
    private const string ALIF_MADDA = "آ";
    private const string WAW = "و";
    private const string YA = "ی";
    private const string BARI_YE = "ے";
    private const string HE_GOL = "ہ";

    /** Any Shahmukhi word letter — Arabic block + Arabic Supplement (ݨ) + Arabic Extended-A (ࣇ). For tokenising. */
    public const string SHAHMUKHI_CLASS = "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF";
    public static readonly JsRe SHAHMUKHI_WORD = JsRegex.Compile($"[{SHAHMUKHI_CLASS}]", "u");
    public static string? ShahmukhiDigit(string ch) => DEF.Digits.GetValueOrDefault(ch);
    public static string? ShahmukhiPause(string ch) => DEF.ClausePunctuation.GetValueOrDefault(ch);

    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile("[əaɑɪiʊueoɛɔ]ː?̃?$", "u");
    private static readonly JsRe ENDS_TILDE = JsRegex.Compile("̃$", "");
    private static bool EndsInVowel(string @out) => ENDS_VOWEL.IsMatch(@out);

    /** A vowel/glide letter that, standing alone after a consonant, is the syllable nucleus (long vowel). */
    private static string? LongVowelAfterConsonant(string ch)
    {
        if (ch == ALIF || ch == ALIF_MADDA) return "aː";
        return ch == WAW || ch == YA || ch == BARI_YE ? DEF.LongVowels.GetValueOrDefault(ch) : null;
    }

    /**
     * ARABIC-KEYBOARD LETTERFORMS AND THE ARABIC-LOANWORD SPELLINGS → their Shahmukhi equivalents.
     *
     * ⚠ EVERY ROW HERE IS A CHARACTER `silentCharsIn` CAUGHT PRODUCING NOTHING, and every one of them is an
     * ENCODING or SPELLING variant of a letter this scanner already reads — not a sound it has no rule for. Left
     * unfolded they matched no branch of the scan below and were skipped in silence:
     *
     *     pnb  ⟨ى⟩ U+0649 ×34   عوامى → əʋˈaːm, آبادى → aːbˈaːd̪, ذاتى → zˈaːt̪  — the final /iː/ of every
     *                           ـی-ending adjective, gone, because the writer typed the ARABIC alif maqṣūra
     *     skr  ⟨ك⟩ U+0643 ×5    شاكر → ʃˈaːɾ — the /k/ deleted outright (ک U+06A9 is the Shahmukhi kāf)
     *     skr  ⟨أ⟩ U+0623 ×8    أکثر → kˈəsəɾ — the initial vowel gone; Urdu-script writing seats no hamza on ا
     *     skr  ⟨ة⟩ ×9 ⟨ۃ⟩ ×7    السنة → ˈəlsən, السیاسۃ → ələsjˈaːs
     *
     * ⚠ AND ⟨ة⟩/⟨ۃ⟩ FOLD TO ⟨ہ⟩ HERE WHILE THE ARABIC ENGINE EXEMPTS THEM AS CORRECTLY SILENT — the same
     * character, the opposite verdict, because the languages differ. Arabic reads تāʾ marbūṭa as nothing in
     * pausal form (the /a/ is the fatḥa before it, which Arabic writes); Urdu-script writing has no fatḥa to
     * carry it and reads the letter ITSELF as final /a/ — السنۃ *as-sunna*, سورۃ *sūra* — which is exactly what
     * word-final ⟨ہ⟩ already does in this scanner.
     *
     * ⚠ NOT FOLDED: ⟨ڊ⟩ U+068A, reported ×4 in skr. All four occurrences are ONE sentence of one article, and
     * they disagree with each other — ⟨ڊے⟩ is transparently دے /d̪eː/ "of", while ⟨پچاڊھ⟩ wants a retroflex, and
     * the letter's own Sindhi value is the retroflex implosive /ɗ̢/ (Saraiki writes that ݙ). Four tokens from one
     * sentence do not source a phoneme, and a wrong reading is worse than a silence. Left reported.
     */
    private static readonly IReadOnlyDictionary<string, string> LETTERFORM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ي"] = "ی", ["ى"] = "ی", // Arabic yeh / alif maqṣūra → Urdu-script yeh
        ["ك"] = "ک", // Arabic kāf → Shahmukhi kāf
        ["أ"] = "ا", ["إ"] = "ا", ["ٱ"] = "ا", // hamza-seated alifs → bare alif
        ["ة"] = "ہ", ["ۃ"] = "ہ", // tāʾ marbūṭa (both encodings) → the gol he that already reads final /a/
    };
    private static readonly JsRe LETTERFORM_RE = JsRegex.Compile($"[{string.Concat(LETTERFORM.Keys)}]", "gu");

    /**
     * The Arabic ADVERBIAL ENDING ⟨ـاً⟩ — the tanwīn's alif is a SEAT, not a long vowel.
     *
     * `silentCharsIn` reports ⟨ً⟩ ×32 in skr: تقریباً → t̪əqɾˈiːbaː, مثلاً → mˈəslaː, عموماً → əmˈoːmaː — the /n/
     * of *taqrīban*, *maslan*, *ʿumūman* deleted in every one. The cause is positional rather than missing data:
     * `harakat` in shahmukhi.jsonc has carried `"ً": "ən"` all along, but the scan only reads a mark that sits
     * directly on a CONSONANT, and in ⟨ـاً⟩ the mark sits on the alif. Dropping the alif puts the tanwīn back on
     * its consonant, where the existing table reads it — and drops the wrong long /aː/ at the same time, since
     * the ending is /-an/ and never /-aːn/. Word-final only: a medial ⟨اً⟩ is not this ending.
     */
    // ⚠ ⟨ی⟩ AND NOT ⟨ى⟩: this runs AFTER the letterform fold above, which has already unified the two.
    private static readonly JsRe TANWIN_ALIF = JsRegex.Compile("[ای]([ًٌٍ])$", "u");

    /**
     * ⚠ SHADDA BEFORE ITS VOWEL MARK — AND WITHOUT THIS, A GEMINATE THAT CARRIES A VOWEL IS NOT A GEMINATE.
     *
     * The consonant branch below reads the marks in a FIXED order — shadda, then one haraka — but the canonical
     * Unicode ordering is the opposite for the commonest case: a vowel mark has combining class 30 and the shadda
     * 33, so ⟨کَّ⟩ is stored ⟨ک⟩+fatḥa+shadda and real text arrives that way. The shadda test saw the fatḥa, fell
     * through, and the shadda was then skipped as an unknown diacritic — `مکَّہ` read *mˈəkəɦ*, losing both the
     * gemination AND the word-final [aː] (the ہ was no longer word-final for the branch that reads it). The same
     * bug, and the same one-line repair, as in `pashto.ts`; a no-op on the order the corpus usually writes.
     */
    private static readonly JsRe SHADDA_AFTER_VOWEL = JsRegex.Compile("([ً-ِٰ])ّ", "gu");

    /** Scan one Shahmukhi word into raw canonical Punjabi IPA (breathy markers, doubled geminates, inherent schwas)
     *  — the SAME shape the Gurmukhi g2p emits, for punjabi.ts's shared post-processing. */
    public static string ScanShahmukhi(string word)
    {
        var prepped = SHADDA_AFTER_VOWEL.Replace(
            TANWIN_ALIF.Replace(
                LETTERFORM_RE.Replace(word.Normalize(System.Text.NormalizationForm.FormC), c => LETTERFORM[c.Value]),
                "$1"),
            "ّ$1");
        var s = Js.CodePoints(prepped);
        var n = s.Count;
        var @out = "";
        var i = 0;
        string At(int k) => k >= 0 && k < n ? s[k] : "";

        // Word-initial vowel carrier (alif): آ→aː; ا+و→oː, ا+ی/ے→eː; bare ا → short ə carrier.
        if (At(0) == ALIF_MADDA)
        {
            @out += "aː";
            i = 1;
        }
        else if (At(0) == ALIF)
        {
            if (At(1) == WAW) { @out += "oː"; i = 2; }
            else if (At(1) == YA || At(1) == BARI_YE) { @out += "eː"; i = 2; }
            else { @out += "ə"; i = 1; }
        }

        while (i < n)
        {
            var ch = s[i];
            // Nasalizer → nasalize the preceding vowel.
            if (NASAL.Contains(ch))
            {
                if (!ENDS_TILDE.IsMatch(@out) && EndsInVowel(@out)) @out += "̃";
                i++;
                continue;
            }
            // Word-final گول ہ after a consonant realizes as the final [aː] vowel (the -ā ending); elsewhere it is [ɦ]
            // (Punjabi keeps ɦ — the intervocalic-ہ → tone merger is deferred, as on the Gurmukhi side).
            if (ch == HE_GOL)
            {
                if (i == n - 1 && @out != "" && !EndsInVowel(@out)) @out += "aː";
                else @out += "ɦ";
                i++;
                continue;
            }
            // Hamza seats carry a vowel in hiatus; ئ→iː, ؤ→oː, absorbing a directly-following ی/و.
            if (ch == "ئ" || ch == "ؤ")
            {
                @out += ch == "ئ" ? "iː" : "oː";
                i++;
                if ((ch == "ئ" && At(i) == YA) || (ch == "ؤ" && At(i) == WAW)) i++;
                continue;
            }
            // Post-vocalic و/ی → glide (کوئی→koːiː's hiatus); after a consonant → the long-vowel nucleus (بو→boː);
            // ے (bari ye) → /eː/; medial ا → aː. Word-INITIAL و/ی fall through to the consonant branch (a consonant
            // glide that carries an inherent vowel: وڈّا→ʋəɖːaː, یار→jaːɾ), so the vowel-after logic applies.
            var postVocGlide = (ch == WAW || ch == YA) && @out != "";
            if (postVocGlide || ch == BARI_YE || ch == ALIF || ch == ALIF_MADDA)
            {
                if (ch == BARI_YE) @out += "eː";
                else if (EndsInVowel(@out)) @out += ch == WAW ? "ʋ" : ch == YA ? "j" : "aː";
                else @out += LongVowelAfterConsonant(ch) ?? "aː";
                i++;
                continue;
            }
            // Consonant (incl. a word-initial و/ی consonant glide).
            if (C.ContainsKey(ch) || ch == WAW || ch == YA)
            {
                var ph = C.GetValueOrDefault(ch) ?? (ch == WAW ? "ʋ" : "j");
                i++;
                // Aspiration: C + ھ → aspirated / breathy (only aspirable consonants; else ھ is a plain [ɦ]).
                if (At(i) == HE && ASP.TryGetValue(ph, out var asp) && asp.Length > 0)
                {
                    ph = asp;
                    i++;
                }
                // Shadda → gemination: double the consonant (→ length in the shared reorder, as Gurmukhi addak).
                if (At(i) == DEF.Shadda)
                {
                    ph += ph;
                    i++;
                }
                @out += ph;
                // Vowel after the consonant.
                var hk = i < n ? HARAKAT.GetValueOrDefault(s[i]) : null;
                if (At(i) == DEF.Sukun)
                {
                    i++; // explicit no-vowel
                }
                else if (hk is not null)
                {
                    @out += hk;
                    i++;
                    // harakat + a matching long-vowel letter lengthens to the HIGH long vowel: kasra+ی→iː, damma+و→uː
                    // (the explicit diacritic disambiguates the letter — bare ی/و default to iː/oː; damma+waw pins uː,
                    // e.g. Urdu/Punjabi پُورا pūrā). This is the diacritic the Gurmukhi sister-script supplies as gold.
                    if ((hk == "ɪ" && At(i) == YA) || (hk == "ʊ" && At(i) == WAW))
                    {
                        @out = @out[..^hk.Length] + (At(i) == YA ? "iː" : "uː");
                        i++;
                    }
                }
                else
                {
                    // ی/و before ANOTHER vowel letter is a glide (نیا→nəjaː), not a long vowel.
                    var glideNext = (At(i) == YA || At(i) == WAW) && LongVowelAfterConsonant(At(i + 1)) is not null;
                    var lv = glideNext ? null : LongVowelAfterConsonant(At(i));
                    if (lv is not null)
                    {
                        @out += lv;
                        i++;
                    }
                    else if (glideNext)
                    {
                        @out += At(i) == YA ? "j" : "ʋ"; // glide; the following letter is the nucleus
                        i++;
                    }
                    else if (i < n
                             && !NASAL.Contains(s[i])
                             && !(At(i) == HE_GOL && i == n - 1)) // word-final ہ is the [aː] vowel, not a coda needing ə
                    {
                        @out += INH; // no written vowel, more letters follow → the abjad's omitted SHORT vowel: [ə]
                    }
                    // word-final consonant with no written vowel → no vowel (skeleton coda).
                }
                continue;
            }
            // hamza / unknown diacritic → skip.
            i++;
        }
        return @out.Normalize(System.Text.NormalizationForm.FormC);
    }
}
