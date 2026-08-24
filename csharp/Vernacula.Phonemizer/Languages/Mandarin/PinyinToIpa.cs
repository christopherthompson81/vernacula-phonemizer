/**
 * Pinyin → canonical IPA.
 * Ported from src/languages/mandarin/pinyinToIpa.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mandarin;

public sealed class MandarinTables
{
    /** toneless pinyin syllable → segmental IPA (with the ˈ nucleus mark, no tone). */
    public required IReadOnlyDictionary<string, string> SyllableIpa { get; init; }
    /** tone number ("1".."5") → Chao contour letters ("" for neutral). */
    public required IReadOnlyDictionary<string, string> Tones { get; init; }
    /** third-tone sandhi rule (from cmn.jsonc → sandhi.thirdThird), as tone NUMBERS. */
    public required (int From, int Before, int To) ThirdToneSandhi { get; init; }
}

public static class PinyinToIpa
{
    private static readonly JsRe U_COLON = JsRegex.Compile("u:", "g");
    private static readonly JsRe SYLLABLE = JsRegex.Compile("^([a-zü:]+?)([1-5])?$", "i");
    private static readonly JsRe WHITESPACE = JsRegex.Compile("\\s+");

    /** Normalize ü spellings the table keys with ü: `lv`/`nv` → `lü`, trailing `u:` → `ü`. */
    private static string NormalizeU(string bas)
    {
        if (bas == "lv" || bas == "nv") return bas[0] + "ü";
        if (bas == "lve" || bas == "nve") return bas[0] + "üe";
        return U_COLON.Replace(bas, "ü");
    }

    /** Split a pinyin token into its toneless base + tone digit (default 5 = neutral). */
    private static (string Base, int Tone) ParseSyllable(string token)
    {
        var m = SYLLABLE.Match(token);
        if (!m.Success) return (token.ToLowerInvariant(), 5);
        return (NormalizeU(m.Groups[1].Value.ToLowerInvariant()),
            m.Groups[2].Success && m.Groups[2].Value.Length > 0 ? (int)Js.Number(m.Groups[2].Value) : 5);
    }

    /**
     * Third-tone sandhi over a syllable run: a 3rd tone immediately before another 3rd tone surfaces as 2nd
     * (你好 nǐ hǎo → ní hǎo). Applied left-to-right pairwise; the last 3rd tone in a run stays 3rd.
     */
    public static List<int> ApplyThirdToneSandhi(IReadOnlyList<int> tones, (int From, int Before, int To) rule)
    {
        var outp = tones.ToList();
        for (var i = 0; i < outp.Count - 1; i++)
            if (outp[i] == rule.From && outp[i + 1] == rule.Before) outp[i] = rule.To;
        return outp;
    }

    /** Build the pinyin→IPA converter from the data tables. */
    public static Func<string, string> MakePinyinToIpa(MandarinTables tables)
    {
        return pinyin =>
        {
            var tokens = WHITESPACE.Re.Split(pinyin.Trim()).Where(t => t.Length > 0).ToList();
            if (tokens.Count == 0) return "";
            var syls = tokens.Select(ParseSyllable).ToList();
            var realized = ApplyThirdToneSandhi(syls.Select(s => s.Tone).ToList(), tables.ThirdToneSandhi);
            var outp = new List<string>();
            for (var i = 0; i < syls.Count; i++)
            {
                if (!tables.SyllableIpa.TryGetValue(syls[i].Base, out var seg))
                {
                    outp.Add(tokens[i]); // unknown syllable: pass through
                    continue;
                }
                outp.Add(seg + (tables.Tones.TryGetValue(Js.NumberToString(realized[i]), out var tone) ? tone : ""));
            }
            return string.Join(" ", outp);
        };
    }
}
