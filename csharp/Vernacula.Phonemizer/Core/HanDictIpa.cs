/**
 * Shared engine for the "IPA-already-in-the-dict" Sinitic bring-ups (cjy, hak, gan, hsn): greedy longest-match
 * Han segmentation over the dict, superscript-tone → Chao contour letters (surface tone after a sandhi arrow),
 * and Han numeral composition.
 * Ported from src/core/hanDictIpa.ts — see that file for the corpus evidence.
 */
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;

namespace Vernacula.Phonemizer.Core;

public sealed class HanDictDef
{
    /** Pitch digit ("1".."5") → Chao contour letter (˩..˥). */
    public IReadOnlyDictionary<string, string> Chao { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class HanDictIpa
{
    private static readonly JsRe HAN = JsRegex.Compile("\\p{Script=Han}", "u");
    private static readonly IReadOnlyDictionary<string, string> SUP = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["⁰"] = "0", ["¹"] = "1", ["²"] = "2", ["³"] = "3", ["⁴"] = "4",
        ["⁵"] = "5", ["⁶"] = "6", ["⁷"] = "7", ["⁸"] = "8", ["⁹"] = "9",
    };
    private const string TONE_CHARS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁻";

    /** One dict syllable → segmental IPA + Chao contour letters. A sandhi arrow ⁵³⁻¹¹ renders the SURFACE tone. */
    private static string SyllableToIpa(string syl, IReadOnlyDictionary<string, string> chao)
    {
        // ⚠ `cut -= ch.length` in the TS counts UTF-16 units over a code-point iteration, which is what the
        // superscript digits (all BMP) make equivalent to a char walk. Kept as a char walk for that reason.
        var cut = syl.Length;
        for (var i = syl.Length - 1; i >= 0; i--)
        {
            if (TONE_CHARS.IndexOf(syl[i]) >= 0) cut--;
            else break;
        }
        var body = syl[..cut];
        var toneBlock = syl[cut..];
        if (toneBlock.Length == 0) return syl; // no tone (neutral/轻声 or a stray) → leave as-is
        var parts = toneBlock.Split('⁻');
        var surface = parts[^1]; // surface tone = digits after the LAST sandhi arrow
        var contour = new StringBuilder();
        foreach (var ch in Js.CodePoints(surface))
            if (SUP.TryGetValue(ch, out var d)) contour.Append(chao.GetValueOrDefault(d, ""));
        return body + contour;
    }

    private static readonly JsRe WS = JsRegex.Compile("\\s+", "u");

    /** A space-separated dict reading → IPA. Public so a romanization reader renders tones through THIS
     *  function rather than a second copy. */
    public static string ReadingToIpa(string reading, IReadOnlyDictionary<string, string> chao) =>
        string.Join(" ", SplitWs(Js.Trim(reading)).Select(s => SyllableToIpa(s, chao)));

    private static List<string> SplitWs(string s)
    {
        var outp = new List<string>();
        var last = 0;
        foreach (var m in JsRegex.MatchAll(WS, s))
        {
            outp.Add(s[last..m.Index]);
            last = m.Index + m.Length;
        }
        outp.Add(s[last..]);
        return outp;
    }

    /** A Han run → IPA (greedy longest-match over the dictionary; unknown chars are skipped). */
    private static string HanRun(string run, IReadOnlyDictionary<string, string> dict, int maxWord,
        IReadOnlyDictionary<string, string> chao)
    {
        var chars = Js.CodePoints(run).ToList();
        var outp = new List<string>();
        for (var i = 0; i < chars.Count;)
        {
            var matched = "";
            var reading = "";
            for (var len = Math.Min(maxWord, chars.Count - i); len >= 1; len--)
            {
                var word = string.Concat(chars.Skip(i).Take(len));
                if (dict.TryGetValue(word, out var hit) && hit.Length > 0)
                {
                    matched = word;
                    reading = hit;
                    break;
                }
            }
            if (reading.Length > 0)
            {
                outp.Add(ReadingToIpa(reading, chao));
                i += Js.CodePoints(matched).Count();
            }
            else i++; // no reading for this char → skip
        }
        return string.Join(" ", outp);
    }

    // Han numeral composition — the Han string is then read through the dict, so number words pick up sandhi.
    private static readonly string[] DIGITS = { "零", "一", "二", "三", "四", "五", "六", "七", "八", "九" };
    private static readonly string[] SMALL = { "", "十", "百", "千" };

    private static string Under10000(long n)
    {
        if (n == 0) return "";
        var outp = new StringBuilder();
        var zero = false;
        for (var p = 3; p >= 0; p--)
        {
            var unit = (long)Math.Floor(n / Math.Pow(10, p)) % 10;
            if (unit == 0)
            {
                if (outp.Length > 0) zero = true;
            }
            else
            {
                if (zero) outp.Append(DIGITS[0]);
                zero = false;
                outp.Append(p == 1 && unit == 1 && outp.Length == 0 ? "" : DIGITS[unit]).Append(SMALL[p]);
            }
        }
        return outp.ToString();
    }

    private static string IntegerToHan(long n)
    {
        if (n == 0) return DIGITS[0];
        if (n < 0) return "";
        var yi = n / 100000000L;
        var wan = n % 100000000L / 10000L;
        var rest = n % 10000L;
        var outp = new StringBuilder();
        if (yi != 0) outp.Append(IntegerToHan(yi)).Append('億');
        if (wan != 0) outp.Append(Under10000(wan)).Append('萬');
        if (rest != 0)
        {
            if ((yi != 0 || wan != 0) && rest < 1000) outp.Append(DIGITS[0]);
            outp.Append(Under10000(rest));
        }
        return outp.ToString();
    }

    /** ⚠ The LOCAL DIGITS, not Core/Sinitic's SpellHanDigits: this string is read back through the same dict
     *  as IntegerToHan's output, so the two tables must be the same table. */
    private static string SpellDigits(string s) =>
        string.Concat(Js.CodePoints(s).Select(c => c.Length == 1 && c[0] >= '0' && c[0] <= '9' ? DIGITS[c[0] - '0'] : c));

    // The greedy-segmentation window = the longest dict key, in CODE POINTS. Cached per dict instance so it is
    // scanned once (the eval sweeps thousands of words through one dict). TS uses a WeakMap.
    /** JS `Number.isSafeInteger`. The fleet spells this out per language; one copy here for the shared core. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static readonly ConditionalWeakTable<object, object> MAX_WORD_CACHE = new();

    private static int MaxWordFor(IReadOnlyDictionary<string, string> dict)
    {
        if (MAX_WORD_CACHE.TryGetValue(dict, out var cached)) return (int)cached;
        var m = 0;
        foreach (var k in dict.Keys) m = Math.Max(m, Js.CodePoints(k).Count());
        MAX_WORD_CACHE.Add(dict, m);
        return m;
    }

    private sealed class Engine : ILanguage
    {
        private readonly Func<IReadOnlyDictionary<string, string>> _dict;
        private readonly HanDictDef _def;
        private readonly Func<string, string>? _foreign;
        private readonly JsRe _token;

        internal Engine(Func<IReadOnlyDictionary<string, string>> dict, HanDictDef def,
            Func<string, string>? foreign, string? latinRun)
        {
            _dict = dict;
            _def = def;
            _foreign = foreign;
            _token = JsRegex.Compile(
                $"(\\p{{Script=Han}}+)|(\\d+)|({latinRun ?? HostWord.LATIN_RUN})|([。，、？！；：.,?!;:])", "gu");
        }

        public string Text(string input)
        {
            var d = _dict();
            var max = MaxWordFor(d);
            return Clauses.AssembleClauses(input, _token, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(HanRun(m.Groups[1].Value, d, max, _def.Chao));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ⚠ AN UNSAFE INTEGER MUST DEGRADE, NOT VANISH. Above 2^53 the double has lost its low
                    // digits, so composing would be confidently wrong; digit-at-a-time is what Sinitic
                    // already does for a year. Js.Number reproduces JS parsing exactly.
                    var n = Js.Number(m.Groups[2].Value);
                    var han = IsSafeInteger(n) ? IntegerToHan((long)n) : SpellDigits(m.Groups[2].Value);
                    sink.Emit(HanRun(han, d, max, _def.Chao));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Emit(_foreign is null ? "" : _foreign(m.Groups[3].Value));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    if (_def.ClausePunctuation.TryGetValue(m.Groups[4].Value, out var mk) && mk.Length > 0)
                        sink.Pause(mk);
                }
            });
        }
    }

    /** Build a Han-dict phonemizer. `dict` is a lazy getter; `foreign` handles embedded Latin runs. */
    public static ILanguage CreateHanDictPhonemizer(Func<IReadOnlyDictionary<string, string>> dict,
        HanDictDef def, Func<string, string>? foreign = null, string? latinRun = null) =>
        new Engine(dict, def, foreign, latinRun);

    /** Bare word→IPA (tests / eval): a Han run → IPA. */
    public static string PhonemizeHanWord(Func<IReadOnlyDictionary<string, string>> dict, HanDictDef def, string word)
    {
        if (!HAN.IsMatch(word)) return "";
        var d = dict();
        return HanRun(word, d, MaxWordFor(d), def.Chao);
    }
}
