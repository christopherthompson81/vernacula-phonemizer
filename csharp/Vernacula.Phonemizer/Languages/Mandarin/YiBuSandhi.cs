/**
 * 一 (yī) and 不 (bù) tone sandhi — the two lexically-triggered sandhi that need the source character, so they
 * run on segmented tokens (not the toneless syllable path).
 * Ported from src/languages/mandarin/yiBuSandhi.ts — see that file for the corpus evidence.
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
            var ordinal = i - 1 >= 0 && tokens[i - 1].Src == "第";
            if (nextTone == 0 || ordinal) tokens[i].Py = SetTone(tokens[i].Py, 1); // final / ordinal → yī
            else if (nextTone == 4) tokens[i].Py = SetTone(tokens[i].Py, 2); // before 4th → yí
            else tokens[i].Py = SetTone(tokens[i].Py, 4); // before 1/2/3 → yì
        }
    }
}
