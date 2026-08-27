/**
 * N'Ko (ߒߞߏ, U+07C0–07FF) → Bambara Latin transliteration — the second-script front-end. N'Ko codepoints are
 * stored in LOGICAL (reading) order, so a left-to-right scan is correct; each letter maps to a Bambara
 * phoneme, so transliterating to Latin reuses the existing g2p, and the NASALIZATION MARK becomes the
 * syllable-final ⟨n⟩ that rule already reads.
 * Ported from src/languages/bambara/bambaraNko.ts — see that file for the vowel-naming trap (EE = /e/,
 * E = /ɛ/, OO = /o/, O = /ɔ/) and for why the tone marks, the lengthener and the carrier are dropped.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bambara;

public static class Nko
{
    private static readonly Dictionary<string, string> NKO = new()
    {
        ["ߊ"] = "a", ["ߋ"] = "e", ["ߌ"] = "i", ["ߍ"] = "ɛ", ["ߎ"] = "u", ["ߏ"] = "o", ["ߐ"] = "ɔ",
        ["ߒ"] = "n", ["ߓ"] = "b", ["ߔ"] = "p", ["ߕ"] = "t", ["ߖ"] = "j", ["ߗ"] = "c", ["ߘ"] = "d",
        ["ߙ"] = "r", ["ߚ"] = "r", ["ߛ"] = "s", ["ߜ"] = "g", ["ߝ"] = "f", ["ߞ"] = "k", ["ߟ"] = "l",
        ["ߠ"] = "ŋ", ["ߡ"] = "m", ["ߢ"] = "ny", ["ߣ"] = "n", ["ߤ"] = "h", ["ߥ"] = "w", ["ߦ"] = "y",
        ["ߧ"] = "ny", ["ߨ"] = "j", ["ߩ"] = "c", ["ߪ"] = "r",
    };

    /** COMBINING NASALIZATION MARK → a syllable-final ⟨n⟩. */
    private const string NASAL = "߲";

    private static readonly JsRe DROP = JsRegex.Compile("[߫-߱߳ߴߵߺ߽ߑ]", "u");

    /** Is any character of `s` in the N'Ko letter/mark range (U+07CA–07FF)? */
    public static bool IsNko(string s)
    {
        foreach (var ch in Js.CodePoints(s))
        {
            var c = Js.CodePointAt0(ch);
            if (c >= 0x07ca && c <= 0x07ff) return true;
        }
        return false;
    }

    /** Transliterate an N'Ko word → the Bambara Latin orthography. */
    public static string NkoToLatin(string word)
    {
        var outp = "";
        foreach (var ch in Js.CodePoints(word))
        {
            if (ch == NASAL) { outp += "n"; continue; }
            if (DROP.IsMatch(ch)) continue;
            // JS `NKO[ch] ?? ""` — an unknown N'Ko codepoint (digit/punct/symbol) is dropped.
            outp += NKO.GetValueOrDefault(ch, "");
        }
        return outp;
    }
}
