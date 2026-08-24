/**
 * Japanese number + counter (助数詞) reading.
 * Ported from src/languages/japanese/counters.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public static class Counters
{
    private sealed class Counter
    {
        public required string Reading;                 // base kana
        public required string Cls;                     // "k" | "s" | "h" | "regular"
        public string? N4;                              // ones-digit 4 reading override (よ/し); default よん
        public string? N7;                              // ones-digit 7 override (しち); default なな
        public string? N9;                              // ones-digit 9 override (く); default きゅう
        public string? Three;                           // counter form after an ん-ending number (rendaku/handaku: 本→ぼん; 軒→げん; 分→ぷん; 足→ぞく)
        public bool NarrowThree;                        // three applies to digit-3 (さん) ONLY, not せん (1000): 3階さんがい but 1000階せんかい
        public string? Four;                            // counter form after よん (4) when it differs from the base (分→ぷん, 泊→ぱく; 本 stays ほん)
        public IReadOnlyDictionary<int, string>? Irr;   // fully-irregular whole readings (人 1/2)
        public IReadOnlyDictionary<int, string>? Table; // wholly table-driven counter (日)
    }

    private static readonly IReadOnlyDictionary<string, string> H_TO_P = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["は"] = "ぱ", ["ひ"] = "ぴ", ["ふ"] = "ぷ", ["へ"] = "ぺ", ["ほ"] = "ぽ",
    };
    private static readonly IReadOnlyDictionary<string, string> H_TO_B = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["は"] = "ば", ["ひ"] = "び", ["ふ"] = "ぶ", ["へ"] = "べ", ["ほ"] = "ぼ",
    };
    private static string PForm(string r) => H_TO_P.GetValueOrDefault(Head(r), Head(r)) + Tail(r);
    private static string BForm(string r) => H_TO_B.GetValueOrDefault(Head(r), Head(r)) + Tail(r);
    private static string Head(string r) => Js.CodePoints(r) is var cs && cs.Count > 0 ? cs[0] : "";
    private static string Tail(string r) => string.Concat(Js.CodePoints(r).Skip(1));

    private static readonly IReadOnlyDictionary<int, string> DAY = new Dictionary<int, string>
    {
        [1] = "ついたち", [2] = "ふつか", [3] = "みっか", [4] = "よっか", [5] = "いつか", [6] = "むいか", [7] = "なのか",
        [8] = "ようか", [9] = "ここのか", [10] = "とおか", [14] = "じゅうよっか", [20] = "はつか", [24] = "にじゅうよっか",
    };

    private static readonly IReadOnlyDictionary<int, string> TSU = new Dictionary<int, string>
    {
        [1] = "ひとつ", [2] = "ふたつ", [3] = "みっつ", [4] = "よっつ", [5] = "いつつ",
        [6] = "むっつ", [7] = "ななつ", [8] = "やっつ", [9] = "ここのつ",
    };

    private static readonly IReadOnlyDictionary<string, Counter> COUNTERS = new Dictionary<string, Counter>(StringComparer.Ordinal)
    {
        ["つ"] = new() { Reading = "つ", Cls = "regular", Table = TSU },
        ["月"] = new() { Reading = "がつ", Cls = "regular", N4 = "し", N7 = "しち", N9 = "く" },
        ["時"] = new() { Reading = "じ", Cls = "regular", N4 = "よ", N7 = "しち", N9 = "く" },
        ["円"] = new() { Reading = "えん", Cls = "regular", N4 = "よ" },
        ["年"] = new() { Reading = "ねん", Cls = "regular", N4 = "よ" },
        ["人"] = new() { Reading = "にん", Cls = "regular", N4 = "よ", N7 = "しち", Irr = new Dictionary<int, string> { [1] = "ひとり", [2] = "ふたり" } },
        ["日"] = new() { Reading = "にち", Cls = "regular", N7 = "しち", N9 = "く", Table = DAY },
        ["分"] = new() { Reading = "ふん", Cls = "h", Three = "ぷん", Four = "ぷん" },
        ["本"] = new() { Reading = "ほん", Cls = "h" },
        ["匹"] = new() { Reading = "ひき", Cls = "h" },
        ["杯"] = new() { Reading = "はい", Cls = "h" },
        ["泊"] = new() { Reading = "はく", Cls = "h", Three = "ぱく", Four = "ぱく" },
        ["個"] = new() { Reading = "こ", Cls = "k" },
        ["回"] = new() { Reading = "かい", Cls = "k" },
        ["階"] = new() { Reading = "かい", Cls = "k", Three = "がい", NarrowThree = true },
        ["軒"] = new() { Reading = "けん", Cls = "k", Three = "げん" },
        ["歳"] = new() { Reading = "さい", Cls = "s" },
        ["冊"] = new() { Reading = "さつ", Cls = "s" },
        ["足"] = new() { Reading = "そく", Cls = "s", Three = "ぞく" },
        ["枚"] = new() { Reading = "まい", Cls = "regular" },
        ["番"] = new() { Reading = "ばん", Cls = "regular" },
        ["度"] = new() { Reading = "ど", Cls = "regular" },
        ["台"] = new() { Reading = "だい", Cls = "regular" },
        ["名"] = new() { Reading = "めい", Cls = "regular" },
        ["秒"] = new() { Reading = "びょう", Cls = "regular" },
        ["羽"] = new() { Reading = "わ", Cls = "regular" },
        ["頭"] = new() { Reading = "とう", Cls = "s" }, // gemination いっとう/じゅっとう (t-initial), but no ろく/ひゃく gem → s-class
        ["着"] = new() { Reading = "ちゃく", Cls = "s" },
        ["丁"] = new() { Reading = "ちょう", Cls = "s" },
    };

    public static bool IsCounter(string ch) => COUNTERS.ContainsKey(ch);

    private static readonly IReadOnlyDictionary<int, string> DEFAULT_OVERRIDE = new Dictionary<int, string>
    {
        [4] = "よん", [7] = "なな", [9] = "きゅう",
    };

    /**
     * number reading (numberToKana) but with the ONES digit's 4/7/9 replaced per the counter (4月→し, 4時→よ).
     */
    private static string NumWithOverride(double n, Counter c)
    {
        var baseR = Numbers.NumberToKana(n);
        var ones = (int)(n % 10);
        var ov = ones == 4 ? c.N4 : ones == 7 ? c.N7 : ones == 9 ? c.N9 : null;
        if (ov is null) return baseR;
        var def = DEFAULT_OVERRIDE[ones];
        return baseR.EndsWith(def, StringComparison.Ordinal) ? baseR[..^def.Length] + ov : baseR;
    }

    /**
     * n + counter → fused kana reading, or null if the kanji is not a known counter.
     */
    public static string? ReadCounter(double n, string counter)
    {
        if (!COUNTERS.TryGetValue(counter, out var c)) return null;
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0) return null;
        var key = (int)n;
        if (c.Table is not null && c.Table.TryGetValue(key, out var tbl)) return tbl;
        if (c.Irr is not null && c.Irr.TryGetValue(key, out var irr)) return irr;

        var num = NumWithOverride(n, c);
        if (c.Cls == "regular") return num + c.Reading;

        string? Geminate(string end, string rep) =>
            num.EndsWith(end, StringComparison.Ordinal) ? num[..^end.Length] + rep : null;
        string? gem = null;
        foreach (var (end, rep) in new[] { ("いち", "いっ"), ("はち", "はっ"), ("じゅう", "じゅっ") })
            gem ??= Geminate(end, rep);
        if (c.Cls != "s")
            foreach (var (end, rep) in new[] { ("ろく", "ろっ"), ("ひゃく", "ひゃっ"), ("びゃく", "びゃっ"), ("ぴゃく", "ぴゃっ") })
                gem ??= Geminate(end, rep);

        if (gem is not null) return gem + (c.Cls == "h" ? PForm(c.Reading) : c.Reading);
        if (num.EndsWith("ん", StringComparison.Ordinal))
        {
            if (n % 10 == 4) return num + (c.Four ?? c.Reading); // 4本→よんほん, 4分→よんぷん
            if (c.Cls == "h") return num + (c.Three ?? BForm(c.Reading)); // 3/1000本→さん/せんぼん, 3分→さんぷん
            if (c.Three is not null && (!c.NarrowThree || n % 10 == 3))
                return num + c.Three; // 3軒→さんげん (broad); 3階→さんがい but 1000階→せんかい (narrow)
        }
        return num + c.Reading;
    }
}
