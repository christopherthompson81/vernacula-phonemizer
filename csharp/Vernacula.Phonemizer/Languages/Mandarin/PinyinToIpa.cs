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

    /** Erhua: a bare `r` is the rhotic suffix of the syllable before it, outside the tone sequence; the
     *  rhotic is `er`'s own reading after its nucleus (ər → r). With no syllable before it, it is `er`. */
    private const string ERHUA = "r";

    /** The converter; `strict` returns null on a token that is neither a table syllable nor erhua. */
    private static string? Convert(MandarinTables tables, string pinyin, bool strict)
    {
        var tokens = WHITESPACE.Re.Split(pinyin.Trim()).Where(t => t.Length > 0).ToList();
        if (tokens.Count == 0) return "";
        string? rhotic = tables.SyllableIpa.TryGetValue("er", out var er) ? string.Concat(Js.CodePoints(er).Skip(1)) : null;
        var heads = new List<(string Base, int Tone, string Suffix)>();
        foreach (var tok in tokens)
        {
            var syl = ParseSyllable(tok);
            if (syl.Base == ERHUA && rhotic is not null)
            {
                if (heads.Count > 0) heads[^1] = heads[^1] with { Suffix = heads[^1].Suffix + rhotic };
                else heads.Add(("er", syl.Tone, ""));
                continue;
            }
            if (strict && !tables.SyllableIpa.ContainsKey(syl.Base)) return null;
            heads.Add((syl.Base, syl.Tone, ""));
        }
        var realized = ApplyThirdToneSandhi(heads.Select(h => h.Tone).ToList(), tables.ThirdToneSandhi);
        var outp = new List<string>();
        for (var i = 0; i < heads.Count; i++)
        {
            // An unknown token is DROPPED, not passed through as text; it keeps its slot in the tone sequence.
            if (!tables.SyllableIpa.TryGetValue(heads[i].Base, out var seg)) continue;
            outp.Add(seg + heads[i].Suffix + (tables.Tones.TryGetValue(Js.NumberToString(realized[i]), out var tone) ? tone : ""));
        }
        return string.Join(" ", outp);
    }

    /** Build the pinyin→IPA converter from the data tables. An unknown token is dropped. */
    public static Func<string, string> MakePinyinToIpa(MandarinTables tables) => pinyin => Convert(tables, pinyin, false)!;

    /** The same converter, but null when any token is neither a table syllable nor erhua. */
    public static Func<string, string?> MakeStrictPinyinToIpa(MandarinTables tables) => pinyin => Convert(tables, pinyin, true);
}
