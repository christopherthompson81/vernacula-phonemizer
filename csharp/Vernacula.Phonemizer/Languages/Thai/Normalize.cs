/**
 * Thai (th) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * readable by the Thai g2p into Thai-script words the existing pipeline speaks.
 * Ported from src/languages/thai/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Thai;

public static class Normalize
{
    /** Thai digit words, indexed by value. */
    public static readonly IReadOnlyList<string> THAI_DIGIT_WORDS = new[]
    {
        "ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า",
    };

    /** Latin letter → its THAI letter name. Thai reads an initialism as these (GPS = จีพีเอส), which is what
     *  keeps it inside the Thai phoneme inventory instead of routing to the English phonemizer. Probed: every
     *  one of the 26 phonemizes to a well-formed Thai syllable (เอฟ → ʔˈeː˨˩p, ดับเบิลยู → dˈa˨˩pbɤ˥˩njˌuː˧). */
    private static readonly IReadOnlyDictionary<string, string> THAI_LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["A"] = "เอ", ["B"] = "บี", ["C"] = "ซี", ["D"] = "ดี", ["E"] = "อี", ["F"] = "เอฟ", ["G"] = "จี",
        ["H"] = "เอช", ["I"] = "ไอ", ["J"] = "เจ", ["K"] = "เค", ["L"] = "แอล", ["M"] = "เอ็ม", ["N"] = "เอ็น",
        ["O"] = "โอ", ["P"] = "พี", ["Q"] = "คิว", ["R"] = "อาร์", ["S"] = "เอส", ["T"] = "ที", ["U"] = "ยู",
        ["V"] = "วี", ["W"] = "ดับเบิลยู", ["X"] = "เอกซ์", ["Y"] = "วาย", ["Z"] = "แซด",
    };

    private sealed class Abbrev
    {
        public required string From { get; init; }
        public required string To { get; init; }
        public required bool UnitOnly { get; init; }
    }

    /**
     * Thai abbreviation → its spoken expansion. ORDER IS LOAD-BEARING: longest key first, so the two-dot
     * forms (ตร.กม.) and the unit-per-unit forms (กม./ชม.) are consumed before the single-dot suffix they
     * end with (กม.) can claim half of them. `UnitOnly` entries are rewritten only with a digit adjacent
     * on the left, which is what keeps `ม.` off a word-final ม plus a sentence period.
     */
    private static readonly Abbrev[] ABBREV =
    {
        new() { From = "กม./ชม.", To = "กิโลเมตร ต่อ ชั่วโมง", UnitOnly = true },
        new() { From = "ไมล์/ชม.", To = "ไมล์ ต่อ ชั่วโมง", UnitOnly = true },
        new() { From = "ตร.กม.", To = "ตาราง กิโลเมตร", UnitOnly = true },
        new() { From = "ตร.มม.", To = "ตาราง มิลลิเมตร", UnitOnly = true },
        new() { From = "กม.", To = "กิโลเมตร", UnitOnly = true },
        new() { From = "มม.", To = "มิลลิเมตร", UnitOnly = true },
        new() { From = "ซม.", To = "เซนติเมตร", UnitOnly = true },
        new() { From = "กก.", To = "กิโลกรัม", UnitOnly = true },
        new() { From = "ชม.", To = "ชั่วโมง", UnitOnly = true },
        new() { From = "ม.", To = "เมตร", UnitOnly = true },
        new() { From = "ค.ศ.", To = "คริสต์ศักราช", UnitOnly = false },
        new() { From = "พ.ศ.", To = "พุทธศักราช", UnitOnly = false },
        new() { From = "พ.ย.", To = "พฤศจิกายน", UnitOnly = false },
        new() { From = "ก.พ.", To = "กุมภาพันธ์", UnitOnly = false },
        new() { From = "ดร.", To = "ดอกเตอร์", UnitOnly = false },
    };

    private static readonly JsRe ESC_RE = JsRegex.Compile("[.$*+?^{}()|[\\]\\\\/]", "gu");
    private static string Esc(string s) => JsRegex.Replace(s, ESC_RE, m => "\\" + m.Value);

    /** `\b` is ASCII-defined and matches NOTHING against Thai script — the trap that bit six of the first
     *  thirteen languages. Every left-edge guard in this file is this explicit lookbehind instead. */
    private static readonly (JsRe Re, string To)[] ABBREV_RULES = ABBREV.Select(a => (
        Re: JsRegex.Compile((a.UnitOnly ? "(?<=\\d\\s?)" : Boundaries.NOT_LETTER_BEFORE) + Esc(a.From), "gu"),
        To: a.To)).ToArray();

    /** Digits of a numeral, spelled one at a time — how Thai reads the fractional part of a decimal
     *  (3.5 = สามจุดห้า; 802.11 = …จุดหนึ่งหนึ่ง, never จุดสิบเอ็ด). */
    private static string SpellDigits(string ds) =>
        string.Join(" ", Js.CodePoints(ds).Select(d =>
        {
            var n = (int)Js.Number(d);
            return n >= 0 && n < THAI_DIGIT_WORDS.Count ? THAI_DIGIT_WORDS[n] : d;
        }));

    /** `HH.MM` → the formal Thai clock: `H นาฬิกา M นาที`. Zero minutes are dropped (11.00 น. is
     *  สิบเอ็ดนาฬิกา, not …ศูนย์นาที). Hours/minutes stay as ASCII digit runs so thai.ts's cardinal
     *  compositor pronounces them; `09` → `9` because a leading zero is not spoken. */
    private static string Clock(string hh, string mm) =>
        $"{Js.NumberToString(Js.Number(hh))} นาฬิกา" +
        (Js.Number(mm) == 0 ? "" : $" {Js.NumberToString(Js.Number(mm))} นาที");

    // The step patterns. The TS builds each inline; JsRegex.Compile caches, so hoisting them is a
    // readability choice and not a behaviour one.
    private static readonly JsRe THAI_DIGIT = JsRegex.Compile("[๐-๙]", "gu");
    private static readonly JsRe LA = JsRegex.Compile("ฯลฯ", "gu");
    private static readonly JsRe MAIYAMOK = JsRegex.Compile("([ก-ๅ็-๎]*)\\s*ๆ", "gu");
    private static readonly JsRe PAIYANNOI = JsRegex.Compile("ฯ", "gu");
    private static readonly JsRe DEGROUP = JsRegex.Compile("(?<=\\d),(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe CLOCK_RANGE = JsRegex.Compile("(\\d{1,2})[.:](\\d{2})\\s*[-–—]\\s*(\\d{1,2})[.:](\\d{2})\\s*น\\.", "gu");
    private static readonly JsRe CLOCK_ONE = JsRegex.Compile("(\\d{1,2})[.:](\\d{2})\\s*น\\.", "gu");
    private static readonly JsRe CLOCK_HOUR = JsRegex.Compile("(\\d{1,2})\\s*น\\.", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(\\d)\\.(\\d+)", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("\\s*\\+\\s*(?=\\d)", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_AT_END = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("\\s*[×]\\s*(?=\\d)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("\\s*°\\s*C(?![A-Za-z])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("\\s*°", "gu");
    private static readonly JsRe CAPS_RUN = JsRegex.Compile("(?<![A-Za-z0-9])[A-Z]{2,6}(?![A-Za-z0-9])", "gu");

    /** The ordered pass. The step order is load-bearing — see normalize.ts for the coupling at each step. */
    public static string NormalizeThai(string input)
    {
        var s = input;

        s = JsRegex.Replace(s, THAI_DIGIT, m => Js.NumberToString(Js.CodePointAt0(m.Value) - 0x0e50));

        s = JsRegex.Replace(s, LA, _ => "และอื่น ๆ");

        s = JsRegex.Replace(s, MAIYAMOK, m =>
        {
            var run = m.Groups[1].Value;
            if (run == "") return ""; // no Thai antecedent — drop the mark rather than invent one
            var seg = ThaiSegment.Segment(run);
            return $"{run} {seg[^1]}";
        });

        s = JsRegex.Replace(s, PAIYANNOI, _ => "");

        s = JsRegex.Replace(s, DEGROUP, _ => "");

        s = JsRegex.Replace(s, CLOCK_RANGE, m =>
            $"{Clock(m.Groups[1].Value, m.Groups[2].Value)} ถึง {Clock(m.Groups[3].Value, m.Groups[4].Value)}");
        s = JsRegex.Replace(s, CLOCK_ONE, m => Clock(m.Groups[1].Value, m.Groups[2].Value));
        s = JsRegex.Replace(s, CLOCK_HOUR, m => $"{Js.NumberToString(Js.Number(m.Groups[1].Value))} นาฬิกา");

        s = JsRegex.Replace(s, DECIMAL_RE, m => $"{m.Groups[1].Value} จุด {SpellDigits(m.Groups[2].Value)}");

        foreach (var (re, to) in ABBREV_RULES) s = JsRegex.Replace(s, re, _ => to);

        s = JsRegex.Replace(s, PLUS, _ => " บวก ");

        s = JsRegex.Replace(s, PLUSMINUS, _ => " บวก ลบ ");
        var whole = s;
        s = JsRegex.Replace(s, MINUS, m =>
            DIGIT_AT_END.IsMatch(whole[..m.Index]) ? m.Value : $"{m.Groups[1].Value}ลบ ");

        s = JsRegex.Replace(s, EQUALS, _ => " เท่ากับ ");
        s = JsRegex.Replace(s, LESS_THAN, _ => " น้อยกว่า ");
        s = JsRegex.Replace(s, GREATER_THAN, _ => " มากกว่า ");
        s = JsRegex.Replace(s, DIVIDE, _ => " หารด้วย ");

        s = JsRegex.Replace(s, TIMES, _ => " คูณ ");

        s = JsRegex.Replace(s, DEG_C, _ => " องศาเซลเซียส");
        s = JsRegex.Replace(s, DEG_BARE, _ => " องศา");

        s = JsRegex.Replace(s, CAPS_RUN, m =>
            string.Join(" ", Js.CodePoints(m.Value).Select(c => THAI_LETTER_NAME[c])));

        return s;
    }
}
