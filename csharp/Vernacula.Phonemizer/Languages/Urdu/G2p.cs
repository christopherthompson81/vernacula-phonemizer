/**
 * Urdu (ur) grapheme→phoneme engine — Perso-Arabic abjad → canonical IPA (Hindi phoneme inventory).
 * Ported from src/languages/urdu/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Urdu;

public sealed class UrduDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public string AspirateHe { get; init; } = "";
    public IReadOnlyDictionary<string, string> Aspirates { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LongVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Glides { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Harakat { get; init; } = new Dictionary<string, string>();
    public string Sukun { get; init; } = "";
    public string Shadda { get; init; } = "";
    public IReadOnlyList<string> Nasalizers { get; init; } = Array.Empty<string>();
    public string InherentVowel { get; init; } = "";
    public NumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class G2p
{
    public static readonly UrduDef DEF = LoadManifest.Load<UrduDef>("languages/urdu", "urdu.jsonc");
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

    private static readonly JsRe VOWEL_PH = JsRegex.Compile("[əaɑɪiʊueoɛɔ]", "");
    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile("[əaɑɪiʊueoɛɔ]ː?̃?$", "u");
    private static readonly JsRe ENDS_TILDE = JsRegex.Compile("̃$", "");

    private static bool IsVowelPh(string ph) => VOWEL_PH.IsMatch(ph);
    /** True when the output so far ENDS in a vowel (ignoring a trailing length ː / nasal ̃). */
    private static bool EndsInVowel(string @out) => ENDS_VOWEL.IsMatch(@out);

    /** A short-vowel letter/glide that, standing alone, is a syllable nucleus rather than a consonant. */
    private static string? LongVowelAfterConsonant(string ch)
    {
        if (ch == ALIF || ch == ALIF_MADDA) return "ɑː";
        if (ch == WAW) return "oː";
        if (ch == YA) return "iː";
        if (ch == BARI_YE) return "eː";
        return null;
    }

    /** Urdu word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var s = Js.CodePoints(word.Normalize(System.Text.NormalizationForm.FormC));
        var n = s.Count;
        var @out = "";
        var i = 0;
        string At(int k) => k >= 0 && k < n ? s[k] : "";

        if (At(0) == ALIF_MADDA)
        {
            @out += "ɑː";
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
                var atEnd = i == n - 1;
                if (atEnd && @out != "" && !EndsInVowel(@out)) @out += "ɑ";
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
            if (ch == WAW || ch == YA || ch == BARI_YE || ch == ALIF || ch == ALIF_MADDA)
            {
                var prevVowel = EndsInVowel(@out);
                if (ch == BARI_YE) @out += "eː";
                else if (prevVowel)
                    @out += ch == WAW ? "ʋ" : ch == YA ? "j" : ch == ALIF || ch == ALIF_MADDA ? "ɑː" : "";
                else @out += LongVowelAfterConsonant(ch) ?? "";
                i++;
                continue;
            }
            if (C.TryGetValue(ch, out var cph))
            {
                var ph = cph;
                i++;
                if (At(i) == HE && ASP.TryGetValue(ph, out var asp) && asp.Length > 0)
                {
                    ph = asp;
                    i++;
                }
                if (At(i) == DEF.Shadda)
                {
                    ph += "ː";
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
                    @out += hk == "ə" ? "ə̲" : hk;
                    i++;
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
                        if (At(i) == YA && At(i + 1) == "َ") { @out += "eː"; i += 2; }
                        else { @out += lv; i++; }
                    }
                    else if (glideNext)
                    {
                        @out += At(i) == YA ? "j" : "ʋ"; // glide; the following vowel letter provides the nucleus
                        i++;
                    }
                    else if (i < n
                             && !NASAL.Contains(s[i])
                             && !(At(i) == HE_GOL && i == n - 1)) // word-final ہ is the [ɑ] vowel, not a coda needing ə
                    {
                        @out += INH;
                    }
                }
                continue;
            }
            i++;
        }
        return @out.Normalize(System.Text.NormalizationForm.FormC);
    }
}
