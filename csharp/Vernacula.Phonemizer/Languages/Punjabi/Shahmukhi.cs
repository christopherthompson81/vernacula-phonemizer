/**
 * Shahmukhi (Perso-Arabic) scanner for Punjabi (pa) — the native abjad front-end used in Pakistan (Gurmukhi
 * is used in India).
 * Ported from src/languages/punjabi/shahmukhi.ts — see that file for the corpus evidence.
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

    /** ARABIC-KEYBOARD LETTERFORMS AND THE ARABIC-LOANWORD SPELLINGS → their Shahmukhi equivalents. */
    private static readonly IReadOnlyDictionary<string, string> LETTERFORM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ي"] = "ی", ["ى"] = "ی", // Arabic yeh / alif maqṣūra → Urdu-script yeh
        ["ك"] = "ک", // Arabic kāf → Shahmukhi kāf
        ["أ"] = "ا", ["إ"] = "ا", ["ٱ"] = "ا", // hamza-seated alifs → bare alif
        ["ة"] = "ہ", ["ۃ"] = "ہ", // tāʾ marbūṭa (both encodings) → the gol he that already reads final /a/
    };
    private static readonly JsRe LETTERFORM_RE = JsRegex.Compile($"[{string.Concat(LETTERFORM.Keys)}]", "gu");

    /** The Arabic ADVERBIAL ENDING ⟨ـاً⟩ — the tanwīn's alif is a SEAT, not a long vowel. Dropping it puts the
     *  mark back on its consonant, where the harakat table reads it as /-an/. Word-final only.
     *  ⚠ ⟨ی⟩ AND NOT ⟨ى⟩: this runs AFTER the letterform fold above, which has already unified the two. */
    private static readonly JsRe TANWIN_ALIF = JsRegex.Compile("[ای]([ًٌٍ])$", "u");

    /**
     * ⚠ SHADDA BEFORE ITS VOWEL MARK — AND WITHOUT THIS, A GEMINATE THAT CARRIES A VOWEL IS NOT A GEMINATE.
     * The consonant branch below reads the marks in a FIXED order, shadda then one haraka, but NFC orders them
     * the other way (vowel mark ccc 30, shadda ccc 33), so ⟨کَّ⟩ arrives as ⟨ک⟩+fatḥa+shadda and the shadda test
     * falls through. Same bug and same one-line repair as in Pashto; a no-op on already-ordered text.
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
            if (NASAL.Contains(ch))
            {
                if (!ENDS_TILDE.IsMatch(@out) && EndsInVowel(@out)) @out += "̃";
                i++;
                continue;
            }
            if (ch == HE_GOL)
            {
                if (i == n - 1 && @out != "" && !EndsInVowel(@out)) @out += "aː";
                else @out += "ɦ";
                i++;
                continue;
            }
            if (ch == "ئ" || ch == "ؤ")
            {
                @out += ch == "ئ" ? "iː" : "oː";
                i++;
                if ((ch == "ئ" && At(i) == YA) || (ch == "ؤ" && At(i) == WAW)) i++;
                continue;
            }
            // Post-vocalic و/ی → glide; after a consonant → the long-vowel nucleus. Word-INITIAL و/ی fall
            // through to the consonant branch on purpose (a consonant glide that carries an inherent vowel).
            var postVocGlide = (ch == WAW || ch == YA) && @out != "";
            if (postVocGlide || ch == BARI_YE || ch == ALIF || ch == ALIF_MADDA)
            {
                if (ch == BARI_YE) @out += "eː";
                else if (EndsInVowel(@out)) @out += ch == WAW ? "ʋ" : ch == YA ? "j" : "aː";
                else @out += LongVowelAfterConsonant(ch) ?? "aː";
                i++;
                continue;
            }
            if (C.ContainsKey(ch) || ch == WAW || ch == YA)
            {
                var ph = C.GetValueOrDefault(ch) ?? (ch == WAW ? "ʋ" : "j");
                i++;
                if (At(i) == HE && ASP.TryGetValue(ph, out var asp) && asp.Length > 0)
                {
                    ph = asp;
                    i++;
                }
                if (At(i) == DEF.Shadda)
                {
                    ph += ph;
                    i++;
                }
                @out += ph;
                var hk = i < n ? HARAKAT.GetValueOrDefault(s[i]) : null;
                if (At(i) == DEF.Sukun)
                {
                    i++; // explicit no-vowel
                }
                else if (hk is not null)
                {
                    @out += hk;
                    i++;
                    // A haraka plus its matching long-vowel letter lengthens to the HIGH long vowel
                    // (kasra+ی→iː, damma+و→uː): the explicit diacritic pins the letter, which bare ی/و
                    // would otherwise default to iː/oː.
                    if ((hk == "ɪ" && At(i) == YA) || (hk == "ʊ" && At(i) == WAW))
                    {
                        @out = @out[..^hk.Length] + (At(i) == YA ? "iː" : "uː");
                        i++;
                    }
                }
                else
                {
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
                }
                continue;
            }
            i++;
        }
        return @out.Normalize(System.Text.NormalizationForm.FormC);
    }
}
