/**
 * Hanzi → pinyin segmentation.
 * Ported from src/languages/mandarin/segment.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mandarin;

public sealed class PinyinTables
{
    /** Hanzi char → its readings (base+tone), most-common first. */
    public required IReadOnlyDictionary<string, List<string>> Chars { get; init; }
    /** multi-char phrase → its space-separated base+tone pinyin tokens. */
    public required IReadOnlyDictionary<string, string> Phrases { get; init; }
    /** longest phrase key length (in code points) — the greedy-match window. */
    public required int MaxPhrase { get; init; }
}

/** One segmented token: its `base+tone` pinyin, and (for single-char emissions) the source character so
 *  downstream sandhi can special-case 一/不/第. Phrase-dict tokens carry no `src` (their tones are baked). */
public sealed class PinToken
{
    public required string Py { get; set; }
    public string? Src { get; init; }
}

public static class Segmenter
{
    private static readonly JsRe HAN = JsRegex.Compile("\\p{Script=Han}", "u");

    /**
     * Segment a run of code points into pinyin tokens. `exempt[i]` marks a character that must not drive word
     * sandhi — a spoken digit synthesized from a number — so it gets no `Src` and 一/不 sandhi never fires on
     * it. Quantity 一 (一千) is NOT exempt and sandhis normally.
     */
    public static List<PinToken> Segment(IReadOnlyList<string> chars, PinyinTables t, IReadOnlyList<bool>? exempt = null)
    {
        var outp = new List<PinToken>();
        var i = 0;
        while (i < chars.Count)
        {
            var ch = chars[i];
            if (!HAN.IsMatch(ch))
            {
                outp.Add(new PinToken { Py = ch });
                i++;
                continue;
            }
            // This arm must run BEFORE the greedy phrase match below: 第一个 would otherwise be swallowed by
            // the 一个 phrase and read the sandhi, losing the ordinal citation 第一 → dì yī.
            if (ch == "一" && outp.Count > 0 && outp[^1].Src == "第")
            {
                outp.Add(new PinToken { Py = t.Chars.TryGetValue("一", out var r) ? r[0] : "一", Src = "一" });
                i++;
                continue;
            }
            var matched = false;
            var maxLen = Math.Min(t.MaxPhrase, chars.Count - i);
            for (var len = maxLen; len >= 2; len--)
            {
                var phrase = string.Concat(chars.Skip(i).Take(len));
                if (t.Phrases.TryGetValue(phrase, out var py))
                {
                    foreach (var p in py.Split(' ')) outp.Add(new PinToken { Py = p });
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            // A real input character carries Src (what 一/不/第 sandhi reads); a sandhi-exempt digit does not.
            var readings = t.Chars.TryGetValue(ch, out var rd) ? rd : null;
            outp.Add(exempt is not null && i < exempt.Count && exempt[i]
                ? new PinToken { Py = readings is not null ? readings[0] : ch }
                : new PinToken { Py = readings is not null ? readings[0] : ch, Src = ch });
            i++;
        }
        return outp;
    }
}
