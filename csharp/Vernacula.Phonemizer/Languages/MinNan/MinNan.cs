/**
 * Min Nan / Taiwanese Hokkien (nan) phonemizer — canonical IPA. Han → Tâi-lô via dict.tsv (greedy
 * longest-match) or direct Tâi-lô/POJ, then [initial] + final → IPA + Chao tone letter; segmental plus
 * citation tone, with word-internal sandhi.
 * Ported from src/languages/minnan/minnan.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.MinNan;

public sealed class MinnanDef
{
    public IReadOnlyDictionary<string, string> Initials { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> PalatalBeforeI { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Finals { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ToneChao { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>? ToneSandhi { get; init; }
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class MinNanPhonemizer
{
    public static readonly MinnanDef DEF = LoadManifest.Load<MinnanDef>("languages/minnan", "minnan.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static IReadOnlyDictionary<string, string> PALATAL => DEF.PalatalBeforeI;

    // Onset consonants tried longest-first. LINQ's OrderByDescending is stable, as JS's sort is, so
    // equal-length keys keep manifest order.
    private static readonly IReadOnlyList<string> INITIALS = DEF.Initials.Keys
        .Where(k => k != "tsi" && k != "tshi" && k != "si" && k != "ji")
        .OrderByDescending(k => k.Length)
        .ToList();

    private static readonly IReadOnlyDictionary<string, string> TONE_MARK = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["́"] = "2", ["̀"] = "3", ["̂"] = "5", ["̌"] = "6",
        ["̄"] = "7", ["̍"] = "8", ["̋"] = "9",
    };

    private static Dictionary<string, string>? DICT;
    private static readonly object GATE = new();
    private static Dictionary<string, string> Dict()
    {
        lock (GATE)
        {
            if (DICT is not null) return DICT;
            var d = LoadTsv.LoadTsvMap("languages/minnan", "dict-chars.tsv", optional: true);
            foreach (var (k, v) in LoadTsv.LoadTsvMap("languages/minnan", "dict.tsv")) d[k] = v;
            return DICT = d;
        }
    }

    private const int MAX_WORD = 6;
    private static readonly JsRe HAN = JsRegex.Compile("\\p{Script=Han}", "u");

    private static readonly JsRe POJ_OO = JsRegex.Compile("o[\\u0358\\u00b7\\u2027]", "gu");
    private static readonly JsRe POJ_CHH = JsRegex.Compile("chh", "gu");
    private static readonly JsRe POJ_CH = JsRegex.Compile("ch", "gu");
    private static readonly JsRe POJ_OA = JsRegex.Compile("oa", "gu");
    private static readonly JsRe POJ_OE = JsRegex.Compile("oe", "gu");
    private static readonly JsRe POJ_ENG = JsRegex.Compile("eng", "gu");
    private static readonly JsRe POJ_EK = JsRegex.Compile("ek", "gu");
    private static readonly JsRe POJ_NASAL = JsRegex.Compile("\\u207f", "gu");

    /** POJ (Pe̍h-ōe-jī) → Tâi-lô, on a TONELESS base syllable. */
    private static string PojToTailo(string b)
    {
        b = POJ_OO.Replace(b, "oo");
        b = POJ_CHH.Replace(b, "tsh"); // longest-first, or `ch` eats the digraph
        b = POJ_CH.Replace(b, "ts");
        b = POJ_OA.Replace(b, "ua");
        b = POJ_OE.Replace(b, "ue");
        b = POJ_ENG.Replace(b, "ing");
        b = POJ_EK.Replace(b, "ik");
        return POJ_NASAL.Replace(b, "nn");
    }

    private static readonly JsRe STOP_CODA = JsRegex.Compile("([ptk])$", "u");

    /** A toneless Tâi-lô base syllable → segmental IPA (initial + final, with sibilant palatalisation). */
    private static string BaseToIpa(string b)
    {
        if (b == "m") return "m̩";
        if (b == "ng") return "ŋ̍";
        if (b == "mh") return "m̩ʔ";
        if (b == "ngh") return "ŋ̍ʔ";
        var ini = "";
        foreach (var k in INITIALS)
            if (b.StartsWith(k, StringComparison.Ordinal))
            {
                ini = k;
                break;
            }
        var rest = b[ini.Length..];
        var iniIpa = PALATAL.TryGetValue(ini, out var pal) && rest.StartsWith("i", StringComparison.Ordinal)
            ? pal
            : DEF.Initials.GetValueOrDefault(ini) ?? "";
        if (!DEF.Finals.TryGetValue(rest, out var fin)) return b; // unknown rime → leave visible
        return iniIpa + STOP_CODA.Replace(fin, "$1̚");
    }

    private static readonly JsRe CHECKED = JsRegex.Compile("[ptkh]$", "u");

    /** One Tâi-lô/POJ syllable → (segmental IPA, tone CATEGORY), or null for an empty base. */
    private static (string Seg, string Tone)? SyllableParts(string syl)
    {
        var nfd = syl.Normalize(NormalizationForm.FormD);
        var tone = "";
        var stripped = new StringBuilder();
        foreach (var ch in Js.CodePoints(nfd))
        {
            if (TONE_MARK.TryGetValue(ch, out var t)) tone = t;
            else stripped.Append(ch);
        }
        var b = PojToTailo(Js.ToLowerCase(stripped.ToString().Normalize(NormalizationForm.FormC)));
        if (b == "") return null;
        if (tone == "") tone = CHECKED.IsMatch(b) ? "4" : "1";
        return (BaseToIpa(b), tone);
    }

    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>? SANDHI => DEF.ToneSandhi;
    private static readonly JsRe STOP_SEG = JsRegex.Compile("[ptk]̚$", "u");

    /** Coda class of a segmental syllable, selecting the tone-sandhi sub-table. */
    private static string CodaClass(string seg)
    {
        if (STOP_SEG.IsMatch(seg)) return "stop";
        if (seg.EndsWith("ʔ", StringComparison.Ordinal)) return "glottal";
        return "open";
    }

    private static readonly JsRe SYL_SPLIT = JsRegex.Compile("[-\\s]+", "gu");

    /** A Tâi-lô/POJ word (hyphen/space-joined syllables) → IPA, with word-internal tone sandhi. */
    public static string TailoToIpa(string word)
    {
        var sylls = new List<(string Seg, string Tone)>();
        var last0 = 0;
        var pieces = new List<string>();
        foreach (var m in JsRegex.MatchAll(SYL_SPLIT, word))
        {
            pieces.Add(word[last0..m.Index]);
            last0 = m.Index + m.Length;
        }
        pieces.Add(word[last0..]);
        foreach (var p in pieces)
        {
            if (p == "") continue; // .filter(Boolean)
            var parts = SyllableParts(p);
            if (parts is not null) sylls.Add(parts.Value);
        }
        var last = sylls.Count - 1;
        var outp = new List<string>(sylls.Count);
        for (var i = 0; i < sylls.Count; i++)
        {
            var (seg, tone) = sylls[i];
            var t = tone;
            if (SANDHI is not null && i < last &&
                SANDHI.TryGetValue(CodaClass(seg), out var sub) && sub.TryGetValue(tone, out var mapped))
                t = mapped;
            outp.Add(seg + (DEF.ToneChao.GetValueOrDefault(t) ?? ""));
        }
        return string.Join(" ", outp);
    }

    /** A Han run → IPA (greedy longest-match over dict → Tâi-lô → IPA; unknown chars skipped). */
    private static string HanRun(string run)
    {
        // UTF-16 offset of each code point, so slicing the window is O(1); indices are code points,
        // exactly as the TS `[...run]` array is.
        var offs = new List<int>();
        for (var k = 0; k < run.Length; k += char.IsHighSurrogate(run[k]) && k + 1 < run.Length && char.IsLowSurrogate(run[k + 1]) ? 2 : 1)
            offs.Add(k);
        offs.Add(run.Length);
        var count = offs.Count - 1;

        var d = Dict(); // hoisted: Dict() takes a lock, and this is the innermost loop of the segmenter
        var outp = new List<string>();
        for (var i = 0; i < count;)
        {
            var matchedLen = 0;
            var reading = "";
            for (var len = Math.Min(MAX_WORD, count - i); len >= 1; len--)
            {
                var w = run[offs[i]..offs[i + len]];
                if (d.TryGetValue(w, out var hit) && hit != "")
                {
                    matchedLen = len;
                    reading = hit;
                    break;
                }
            }
            if (reading != "")
            {
                outp.Add(TailoToIpa(reading));
                i += matchedLen;
            }
            else i++;
        }
        return string.Join(" ", outp);
    }

    // ── Numbers ──────────────────────────────────────────────────────────────────────────────────
    private static readonly IReadOnlyList<string> HAN_DIGITS = new[] { "零", "一", "二", "三", "四", "五", "六", "七", "八", "九" };
    private static readonly string[] HAN_SMALL = { "", "十", "百", "千" };
    private static readonly HashSet<string> HAN_MAG = new(StringComparer.Ordinal) { "十", "百", "千", "萬", "億" };

    private static string Under10000(double n)
    {
        if (n == 0) return "";
        var outp = "";
        var zero = false;
        for (var p = 3; p >= 0; p--)
        {
            var unit = Math.Floor(n / Math.Pow(10, p)) % 10;
            if (unit == 0)
            {
                if (outp != "") zero = true;
            }
            else
            {
                if (zero) outp += HAN_DIGITS[0];
                zero = false;
                outp += (p == 1 && unit == 1 && outp == "" ? "" : HAN_DIGITS[(int)unit]) + HAN_SMALL[p];
            }
        }
        return outp;
    }

    /** An integer → the Chinese numeral string (myriad grouping 萬/億), as in cantonese.ts. */
    private static string IntegerToHan(double n)
    {
        if (n == 0) return HAN_DIGITS[0];
        if (n < 0) return "";
        var yi = Math.Floor(n / 1_0000_0000);
        var wan = Math.Floor(n % 1_0000_0000 / 10000);
        var rest = n % 10000;
        var outp = "";
        if (yi != 0) outp += IntegerToHan(yi) + "億";
        if (wan != 0) outp += Under10000(wan) + "萬";
        if (rest != 0)
        {
            if ((yi != 0 || wan != 0) && rest < 1000) outp += HAN_DIGITS[0];
            outp += Under10000(rest);
        }
        return outp;
    }

    /** A Chinese numeral string → IPA: per-character dict readings (+ the 一 it/tsi̍t rule), hyphen-joined
     *  so tone sandhi runs across the numeral. */
    private static string HanNumeralRun(string han)
    {
        var chars = Js.CodePoints(han);
        var parts = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            string r;
            if (c == "一" && !HAN_MAG.Contains(i + 1 < chars.Count ? chars[i + 1] : ""))
                r = "it"; // final unit digit, not a multiplier
            else r = Dict().GetValueOrDefault(c) ?? "";
            if (r != "") parts.Add(r);
        }
        return TailoToIpa(string.Join("-", parts));
    }

    /** Han run · digits · a POJ word (Latin plus its combining marks AND the hyphen) · clause punctuation. */
    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(\\p{Script=Han}+)|(\\d+)|(" + HostWord.HostWordRun(new[] { "Latin" }, "", "-") + ")|([。，、？！；：.,?!;:])",
        "gu");

    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(
        "[A-Za-zàáâāǎÀÁÂĀǍèéêēěÈÉÊĒĚìíîīǐÌÍÎĪǏòóôōǒőÒÓÔŌǑŐùúûūǔűÙÚÛŪǓŰńǹŃǸⁿ" +
        // U+0300 ̀ (3) U+0301 ́ (2) U+0302 ̂ (5) U+0304 ̄ (7) U+030B ̋ (9) U+030C ̌ (6) U+030D ̍ (8), and
        // U+0358 ͘ — the ⟨o͘⟩ vowel, not a tone.
        "̀-̂̄̋-̍͘]", "u");

    private sealed class Engine : ILanguage
    {
        // ⚠ STORED AND NEVER CALLED, exactly as in the TS: this engine claims Latin itself (POJ IS Latin),
        // so no run is ever handed to the foreign reader. See the report note on minnan.ts.
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign) => _foreign = foreign;

        public string Text(string input)
        {
            input = Normalize.NormalizeMinNan(input);
            return Clauses.AssembleClauses(input, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(HanRun(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var n = Js.Number(m.Groups[2].Value);
                    sink.Emit(HanNumeralRun(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
                        ? IntegerToHan(n)
                        : Sinitic.SpellHanDigits(m.Groups[2].Value, HAN_DIGITS)));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(TailoToIpa(Nat(m.Groups[3].Value)));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Min Nan phonemizer. `foreign` handles embedded (non-Tâi-lô) Latin runs. */
    public static ILanguage CreateMinnan(Func<string, string>? foreign = null) => new Engine(foreign);

    /** Bare word→IPA (tests / eval): Han → IPA, or direct Tâi-lô. */
    public static string PhonemizeWord(string word) => HAN.IsMatch(word) ? HanRun(word) : TailoToIpa(word);

    internal static void RegisterSelf() =>
        Registry.Register("minnan", () => CreateMinnan(Registry.ReadAsEnglish));
}
