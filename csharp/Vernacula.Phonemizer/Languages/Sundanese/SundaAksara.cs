/**
 * Aksara Sunda (ᮃᮊ᮪ᮞᮛ, U+1B80–1BBF) → Sundanese Latin transliteration — the second-script front-end for
 * Sundanese (su). The abugida is assembled back into the Latin orthography and the existing su g2p reads it
 * unchanged → identical IPA.
 * Ported from src/languages/sundanese/sundaAksara.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sundanese;

public static class SundaAksara
{
    /** Base consonant (ngalagéna) → Latin ONSET (the inherent /a/ is added by the assembler, or replaced). */
    private static readonly IReadOnlyDictionary<string, string> ONSET = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ᮊ"] = "k", ["ᮋ"] = "q", ["ᮌ"] = "g", ["ᮍ"] = "ng", ["ᮎ"] = "c", ["ᮏ"] = "j", ["ᮐ"] = "z",
        ["ᮑ"] = "ny", ["ᮒ"] = "t", ["ᮓ"] = "d", ["ᮔ"] = "n", ["ᮕ"] = "p", ["ᮖ"] = "f", ["ᮗ"] = "v",
        ["ᮘ"] = "b", ["ᮙ"] = "m", ["ᮚ"] = "y", ["ᮛ"] = "r", ["ᮜ"] = "l", ["ᮝ"] = "w", ["ᮞ"] = "s",
        ["ᮟ"] = "x", ["ᮠ"] = "h", ["ᮮ"] = "kh", ["ᮯ"] = "sy", ["ᮽ"] = "bh",
    };

    private static readonly IReadOnlyDictionary<string, string> INDEP = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ᮃ"] = "a", ["ᮄ"] = "i", ["ᮅ"] = "u", ["ᮆ"] = "é", ["ᮇ"] = "o", ["ᮈ"] = "e", ["ᮉ"] = "eu",
    };

    /** REU / LEU = r/l + the eu vowel. */
    private static readonly IReadOnlyDictionary<string, string> SYLLABIC = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ᮻ"] = "reu", ["ᮼ"] = "leu",
    };

    /** Vowel signs (rarangkén) — replace the inherent /a/. */
    private static readonly IReadOnlyDictionary<string, string> VOWEL_SIGN = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ᮤ"] = "i", ["ᮥ"] = "u", ["ᮦ"] = "é", ["ᮧ"] = "o", ["ᮨ"] = "e", ["ᮩ"] = "eu",
    };

    /** Medial consonant signs — insert a glide/liquid between the onset and the vowel. */
    private static readonly IReadOnlyDictionary<string, string> MEDIAL = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ᮡ"] = "y", ["ᮢ"] = "r", ["ᮣ"] = "l", ["ᮬ"] = "m", ["ᮭ"] = "w",
    };

    /** Final signs — close the syllable with a coda. */
    private static readonly IReadOnlyDictionary<string, string> FINAL = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ᮀ"] = "ng", ["ᮁ"] = "r", ["ᮂ"] = "h", ["ᮾ"] = "k", ["ᮿ"] = "m",
    };

    /** pamaéh / virama — suppress the inherent vowel. */
    private static readonly IReadOnlySet<string> VIRAMA =
        new HashSet<string>(new[] { "᮪", "᮫" }, StringComparer.Ordinal);

    private static readonly IReadOnlyDictionary<string, string> DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["᮰"] = "0", ["᮱"] = "1", ["᮲"] = "2", ["᮳"] = "3", ["᮴"] = "4",
        ["᮵"] = "5", ["᮶"] = "6", ["᮷"] = "7", ["᮸"] = "8", ["᮹"] = "9",
    };

    /** Is any character of `s` an Aksara Sunda letter/sign (U+1B80–1BBF)? */
    public static bool IsAksaraSunda(string s)
    {
        foreach (var ch in Js.CodePoints(s))
        {
            var c = Js.CodePointAt0(ch);
            if (c >= 0x1b80 && c <= 0x1bbf) return true;
        }
        return false;
    }

    /** Normalise Aksara Sunda digits (U+1BB0–1BB9) → ASCII (so the su number path can read them). */
    public static string NormalizeSundaDigits(string s)
    {
        var sb = new StringBuilder();
        foreach (var ch in Js.CodePoints(s)) sb.Append(DIGITS.TryGetValue(ch, out var d) ? d : ch);
        return sb.ToString();
    }

    /** Transliterate an Aksara Sunda word → the Sundanese Latin orthography (the caller runs the su g2p). */
    public static string AksaraToLatin(string word)
    {
        var s = Js.CodePoints(word.Normalize(NormalizationForm.FormC));
        var n = s.Count;
        var sb = new StringBuilder();
        var i = 0;
        void Finals()
        {
            while (i < n && FINAL.TryGetValue(s[i], out var f)) { sb.Append(f); i++; }
        }
        while (i < n)
        {
            var ch = s[i];
            if (ONSET.TryGetValue(ch, out var on))
            {
                sb.Append(on);
                i++;
                while (i < n && MEDIAL.TryGetValue(s[i], out var md)) { sb.Append(md); i++; } // medial glide(s)
                if (i < n && VOWEL_SIGN.TryGetValue(s[i], out var vs)) { sb.Append(vs); i++; } // replaces inherent /a/
                else if (i < n && VIRAMA.Contains(s[i])) i++; // pamaéh → bare consonant (no vowel)
                else sb.Append('a'); // inherent /a/
                Finals();
            }
            else if (SYLLABIC.TryGetValue(ch, out var sy))
            {
                sb.Append(sy);
                i++;
                Finals();
            }
            else if (INDEP.TryGetValue(ch, out var ind))
            {
                sb.Append(ind);
                i++;
                Finals();
            }
            else if (FINAL.TryGetValue(ch, out var fin))
            {
                sb.Append(fin); // a coda sign after a vowel (independent vowel + panyecek)
                i++;
            }
            else i++; // avagraha / stray sign / unknown → skip
        }
        return sb.ToString();
    }
}
