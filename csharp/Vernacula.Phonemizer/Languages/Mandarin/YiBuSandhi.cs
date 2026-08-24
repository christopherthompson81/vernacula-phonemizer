/**
 * 一 (yī) and 不 (bù) tone sandhi — the two lexically-triggered sandhi that need the source character, so
 * they run on segmented tokens (not the toneless syllable path). Applied to bare single-char 一/不 only; the
 * phrase dictionary already bakes sandhi into multi-char entries. Mutates the tokens' tone digit in place.
 *
 *   不: base 4th tone; before a 4th tone → 2nd (不是 bú shì); elsewhere stays 4th (不好 bù hǎo).
 *   一: before a 4th tone → 2nd (一定 yídìng); before 1st/2nd/3rd → 4th (一天 yìtiān, 一起 yìqǐ);
 *       utterance-final or after 第 (ordinal 第一) → 1st (citation yī). Counting sequences keep 1st too,
 *       but that context isn't detectable from tone alone and is left as the productive-sandhi default.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mandarin;

public static class YiBuSandhi
{
    private static readonly JsRe TONE_DIGIT = JsRegex.Compile("([1-5])$");
    private static readonly JsRe TONE_TAIL = JsRegex.Compile("[1-5]?$");

    private static int ToneOf(string py)
    {
        var m = TONE_DIGIT.Match(py);
        return m.Success ? (int)Js.Number(m.Groups[1].Value) : 5;
    }

    /** JS `py.replace(/[1-5]?$/, t)` — replaces the FIRST match of the anchored pattern. */
    private static string SetTone(string py, int t) =>
        TONE_TAIL.Replace(py, Js.NumberToString(t));

    public static void ApplyYiBuSandhi(List<PinToken> tokens)
    {
        for (var i = 0; i < tokens.Count; i++)
        {
            var src = tokens[i].Src;
            if (src != "一" && src != "不") continue;
            var next = i + 1 < tokens.Count ? tokens[i + 1] : null;
            var nextTone = next is not null ? ToneOf(next.Py) : 0; // 0 = no following syllable
            if (src == "不")
            {
                tokens[i].Py = SetTone(tokens[i].Py, nextTone == 4 ? 2 : 4);
                continue;
            }
            // 一
            var ordinal = i - 1 >= 0 && tokens[i - 1].Src == "第";
            if (nextTone == 0 || ordinal) tokens[i].Py = SetTone(tokens[i].Py, 1); // final / ordinal → yī
            else if (nextTone == 4) tokens[i].Py = SetTone(tokens[i].Py, 2); // before 4th → yí
            else tokens[i].Py = SetTone(tokens[i].Py, 4); // before 1/2/3 → yì
        }
    }
}
