/**
 * Korean (ko) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * readable by the Hangul engine into Hangul the pipeline speaks.
 * Ported from src/languages/korean/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Korean;

public static class Normalize
{
    private static KoreanNativeNumbers NATIVE => Manifest.MANIFEST.Numbers.Native;

    /**
     * A native-Korean numeral 1–99 in its PRENOMINAL form — the form a counter takes, which is not the
     * citation form: 하나/둘/셋/넷 become 한/두/세/네 before a counter, and 20 alone is 스무 (스물 only when a
     * ones digit follows). There is no native series above 99, which is why callers gate on n ≤ 99.
     */
    private static string NativeNumeral(double n)
    {
        double t = Math.Floor(n / 10), u = n % 10;
        if (t == 2 && u == 0) return NATIVE.Twenty;
        var tens = t >= 0 && t < NATIVE.Tens.Length ? NATIVE.Tens[(int)t] : "";
        var ones = u >= 0 && u < NATIVE.Ones.Length ? NATIVE.Ones[(int)u] : "";
        return tens + ones;
    }

    /**
     * The counters that take the NATIVE series (3명 is 세 명, not 삼 명), which is a property of the COUNTER.
     * ⚠ ORDER INSIDE THE ALTERNATION IS LOAD-BEARING: 번째 must precede 번 and 시간 must precede 시, or the
     * shorter counter claims the first syllable of the longer one and strands 째 / 간 as a word. The 시 and
     * 개 exclusions keep 시드/시속 and the SINO 개월 / 개국 (육 개월, 칠 개국) out.
     */
    private static readonly JsRe NATIVE_COUNTER =
        JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\s?(명|번째|번|시간|시(?![간드속])|개(?![월국])|마리|살|가지|척|사람)", "gu");

    /**
     * Unit abbreviation → its Hangul word. These live HERE rather than in the shared symbol tier: that tier
     * matches only when a number is directly adjacent, which the range and decimal rules below destroy, and
     * it always inserts a space where rule 8 needs the unit JOINED to the number. Matched case-sensitively —
     * an uppercase run is an initialism. ⚠ `g`, `l` and `t` are DELIBERATELY ABSENT: Korean glues particles
     * straight onto the abbreviation, so no "not followed by a letter" guard is available and a one-letter
     * key starts matching non-units (802.11g → 802.11그램).
     */
    private static readonly IReadOnlyDictionary<string, string> UNIT_HANGUL = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "킬로미터", ["cm"] = "센티미터", ["mm"] = "밀리미터", ["nm"] = "나노미터", ["m"] = "미터",
        ["kg"] = "킬로그램", ["mg"] = "밀리그램", ["ha"] = "헥타르", ["ml"] = "밀리리터", ["mi"] = "마일", ["ft"] = "피트",
    };
    /** Longest first, so km is not read as k + m and mm is not read as m + m. */
    private static readonly string UNIT_ALT = string.Join("|", UNIT_HANGUL.Keys.OrderByDescending(a => a.Length));

    /** Latin letter → its Hangul name. The 26 are fixed and uncontroversial in everyday Korean use. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_HANGUL = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["A"] = "에이", ["B"] = "비", ["C"] = "씨", ["D"] = "디", ["E"] = "이", ["F"] = "에프", ["G"] = "지",
        ["H"] = "에이치", ["I"] = "아이", ["J"] = "제이", ["K"] = "케이", ["L"] = "엘", ["M"] = "엠", ["N"] = "엔",
        ["O"] = "오", ["P"] = "피", ["Q"] = "큐", ["R"] = "알", ["S"] = "에스", ["T"] = "티", ["U"] = "유",
        ["V"] = "브이", ["W"] = "더블유", ["X"] = "엑스", ["Y"] = "와이", ["Z"] = "제트",
    };

    /**
     * Acronyms Korean reads as a WORD rather than as letters — a lexical fact, so this list holds only
     * established ones.
     */
    private static readonly IReadOnlyDictionary<string, string> WORD_ACRONYM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["UN"] = "유엔", ["NATO"] = "나토", ["NASA"] = "나사", ["UNESCO"] = "유네스코", ["UNICEF"] = "유니세프",
        ["ASEAN"] = "아세안", ["OPEC"] = "오펙", ["AIDS"] = "에이즈", ["FIFA"] = "피파", ["COVID"] = "코비드",
    };

    /** One all-caps Latin run → Hangul: the listed word reading if it has one, else its letter names,
     *  joined, because a Korean acronym is written and said as a single word (FBI 에프비아이). The internal
     *  hyphen of XDR-TB is the only character that reaches here without a name; it is dropped. */
    private static string Spell(string run)
    {
        if (WORD_ACRONYM.TryGetValue(run, out var word)) return word;
        var outp = "";
        foreach (var ch in Js.CodePoints(run)) outp += LETTER_HANGUL.GetValueOrDefault(ch) ?? "";
        return outp == "" ? run : outp;
    }

    // The step patterns. The TS builds several inline; JsRegex.Compile caches, so hoisting them here is a
    // readability choice and not a behaviour one.
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0),(?=\\d{3}(?!\\d))", "gu");
    private const string SPAN = "\\d[\\d.]*(?:\\s?[-–—~〜～]\\s?\\d[\\d.]*)?";
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(?<=\\d)\\s?({UNIT_ALT})([²³2-3])?(?![A-Za-z\\d])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("([-−–±]?)(\\d+)\\s?°\\s?C(?![\\p{sc=Latn}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("([-−–±]?)(\\d+)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_INFIX = JsRegex.Compile("(\\d)\\s?\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_LEAD = JsRegex.Compile("(^|[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS_LEAD = JsRegex.Compile("(^|[\\s(])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s?&\\s?", "gu");
    private static readonly JsRe RANGE_MARK = JsRegex.Compile("(?<=\\d)\\s?[~〜～–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe JUNE = JsRegex.Compile("(?<!\\d)6월", "gu");
    private static readonly JsRe OCTOBER = JsRegex.Compile("(?<!\\d)10월", "gu");
    private static readonly JsRe DIGITS_BEFORE_HANGUL = JsRegex.Compile("(\\d+)(?=[가-힣])", "gu");
    private static readonly JsRe INITIALISM = JsRegex.Compile(
        "(?<![\\p{Script=Latin}\\p{M}])[A-Z][A-Z-]*[A-Z](?![\\p{Script=Latin}\\p{M}])|(?<![\\p{Script=Latin}\\p{M}])[A-Z](?![\\p{Script=Latin}\\p{M}])", "gu");
    private static readonly JsRe ALL_DIGITS = JsRegex.Compile("^\\d+$", "u");
    private const string OPERAND = "\\d+|[가-힣]+|[A-Za-z]";

    /** Normalize one Korean input string. Pure text→text; every rule emits Hangul or ASCII digits and lets
     *  the existing engine do the pronouncing. */
    public static string NormalizeKorean(string input)
    {
        // 1) COMMA-GROUPED THOUSANDS, FIRST: the comma is clause punctuation here, and rules 7/8 key on a
        //    digit run being adjacent to its counter. Looped, so 1,000,000 collapses across both separators.
        var s = input;
        for (var prev = ""; prev != s;)
        {
            prev = s;
            s = Rewrite(s, GROUP_COMMA, "");
        }

        // 2) SPEED UNITS, before the range rule splits a range: 시속 / 초속 precede the number, so the whole
        //    range must be claimed in one match. ⚠ An already-present 시속 is CONSUMED by the match, not
        //    blocked by a lookbehind — a lookbehind merely pushes the match one digit right and yields
        //    시속 1시속 60킬로미터. The trailing guard is [A-Za-z\d], NOT \p{L}: Korean writes its particle
        //    directly onto the abbreviation (83km/h의) and a letter-class guard would reject exactly those.
        void Speed(string unit, string prefix, string word)
        {
            s = Rewrite(s, JsRegex.Compile($"(?<![\\d.])(?:{prefix}\\s?)?({SPAN})\\s?(?:{unit})(?![A-Za-z\\d])", "gu"),
                m => $"{prefix} {m.Groups[1].Value}{word}");
        }
        Speed("mph", "시속", "마일");
        Speed("kph|km/h", "시속", "킬로미터");
        Speed("m/s", "초속", "미터");

        // 3) UNITS, while a digit is still adjacent and the number is still plain ASCII. Any space is
        //    CONSUMED, joining the unit to the number so rule 8 spells them as one sandhi domain.
        s = Rewrite(s, UNIT_RE, m =>
        {
            var unit = m.Groups[1].Value;
            var exp = m.Groups[2].Success ? m.Groups[2].Value : null;
            return $"{(exp is null ? "" : exp == "³" || exp == "3" ? "세제곱" : "제곱")}{UNIT_HANGUL[unit]}";
        });

        // 4) DEGREES, before rule 9 — otherwise the C of 30°C is a lone capital and rule 9 spells it 씨.
        //    ⚠ This rule REORDERS (섭씨 is lifted in front of the number), so the SIGN is captured and
        //    carried with it; without that, `-5 °C` becomes `-섭씨 5도` and the minus is stranded.
        //    The trailing guard must reject a LATIN letter, not any letter: a temperature is normally
        //    followed by a Korean particle (32℃에), which a \p{L} guard would refuse.
        s = Rewrite(s, DEG_C, m => $"섭씨 {m.Groups[1].Value}{m.Groups[2].Value}도");
        s = Rewrite(s, DEG_F, m => $"화씨 {m.Groups[1].Value}{m.Groups[2].Value}도");
        s = Rewrite(s, DEG_BARE, m => $"{m.Groups[1].Value}도");

        // The additive signs run AFTER the relational rules, which match digits on both sides: `3 + 4 = 7`
        // must have its `= 7` consumed first. ⚠ The two registers are NOT interchangeable — 더하기/빼기 are
        // the OPERATORS, 플러스/마이너스 the SIGNS — so the infix rule and the leading-sign rule differ on
        // purpose. ± is a single character (U+00B1), not a `+`, so no `+` rule can match inside it.
        s = Rewrite(s, PLUSMINUS, _ => " 플러스 마이너스 ");
        s = Rewrite(s, PLUS_INFIX, m => $"{m.Groups[1].Value} 더하기 ");
        s = Rewrite(s, PLUS_LEAD, m => $"{m.Groups[1].Value}플러스 ");
        s = Rewrite(s, MINUS_LEAD, m => $"{m.Groups[1].Value}마이너스 ");

        // 4b) RELATIONAL AND DIVISION SIGNS. Korean is verb-final, so only ÷ is infix; =, < and > are
        //     POSTPOSED and therefore consume BOTH operands. ⚠ The particles 는/은 and 와/과 are allomorphic
        //     on the SPELLED number (7 → 칠 takes 은, 4 → 사 takes 는), and the digit-to-word pass runs later,
        //     so this rule spells its own operands and picks the allomorph from the result's last jamo.
        //     An operand is a number, a Hangul word, or a lone Latin letter; anything else leaves the sign
        //     dropped, since the postposed clause cannot be built without both operands.
        static string KWord(string t)
        {
            if (ALL_DIGITS.IsMatch(t))
            {
                var w = KoreanNumbers.NumberToWords(Js.Number(t));
                return w != "" ? w : t;
            }
            return LETTER_HANGUL.GetValueOrDefault(t.ToUpperInvariant()) ?? t;
        }
        /**
         * Does this word end in a closed syllable? Decodes the Hangul syllable block: T = (code − AC00) % 28.
         */
        static bool KClosed(string w)
        {
            var c = w.Length > 0 ? (int)w[^1] : 0;
            return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 != 0;
        }
        static string KTopic(string w) => $"{w}{(KClosed(w) ? "은" : "는")}";
        void Relational(string sign, Func<string, string> tail)
        {
            s = Rewrite(s, JsRegex.Compile($"({OPERAND})\\s?{sign}\\s?({OPERAND})", "gu"),
                m => $"{KTopic(KWord(m.Groups[1].Value))} {tail(KWord(m.Groups[2].Value))}");
        }
        Relational("=", y => $"{y}{(KClosed(y) ? "과" : "와")} 같다");
        Relational("<", y => $"{y}보다 작다");
        Relational(">", y => $"{y}보다 크다");
        s = Rewrite(s, DIVIDE, _ => " 나누기 ");

        s = Rewrite(s, AMPERSAND, _ => " 앤드 ");

        // 5) RANGES, after rules 1 and 2 so a grouped endpoint is already one number and a speed range is
        //    already claimed whole.
        s = Rewrite(s, RANGE_MARK, _ => "에서 ");

        // 6) DECIMALS. The point is clause punctuation too, so 1.5 would break into "일 . 오". The fractional
        //    digits are read INDIVIDUALLY (7.75 → 칠 점 칠오), and the result is Hangul so rule 8 skips it.
        s = Rewrite(s, DECIMAL_RE, m =>
            $"{KoreanNumbers.NumberToWords(Js.Number(m.Groups[1].Value))}점" +
            string.Concat(Js.CodePoints(m.Groups[2].Value).Select(d => (Core.Numbers.DigitWord(Manifest.MANIFEST.Numbers.Ones, d) ?? d))));

        // 7) NATIVE-SERIES COUNTERS, BEFORE rule 8 claims the digits for the Sino series. Gated at 99, since
        //    ≥100 is Sino for every counter. Joined, because numeral + counter is one phonological word and
        //    the sandhi runs across the boundary (열 시 → [jʌɭɕ͈i]).
        s = Rewrite(s, NATIVE_COUNTER, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            return n >= 1 && n <= 99 ? $"{NativeNumeral(n)}{m.Groups[2].Value}" : m.Value;
        });

        // 8) A DIGIT RUN DIRECTLY FOLLOWED BY HANGUL → Sino-Korean words, JOINED, so the cross-syllable
        //    sandhi at the number–counter boundary lands inside one token. Only an ADJACENT Hangul character
        //    triggers it. The month irregulars are spelled rather than composed: 6월 is 유월, 10월 is 시월.
        s = Rewrite(s, JUNE, _ => "유월");
        s = Rewrite(s, OCTOBER, _ => "시월");
        s = Rewrite(s, DIGITS_BEFORE_HANGUL, m =>
        {
            var w = KoreanNumbers.NumberToWords(Js.Number(m.Groups[1].Value));
            return w == "" ? m.Value : w; // out of safe-integer range: leave the digits for the number path
        });

        // 9) LATIN INITIALISMS → Hangul letter names, LAST, so rules 2–4 still see the ASCII they match on.
        //    Bounded by explicit letter lookarounds, never \b, which would also fire between a letter and a
        //    Hangul syllable. ⚠ The boundary is ALL of Latin, not [A-Za-z]: an ASCII-only lookaround does not
        //    see an accented letter, so the S of `São` passed the isolated-capital test and was spelled out.
        return Rewrite(s, INITIALISM, m => Spell(m.Value));
    }
}
