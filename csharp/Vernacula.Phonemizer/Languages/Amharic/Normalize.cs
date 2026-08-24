/**
 * Amharic (am) text normalization — pure text→text, run inside `text()` before tokenization.
 *
 * ⚠ `\b` IS ASCII-DEFINED AND MATCHES NOTHING AGAINST ETHIOPIC — every boundary here is an explicit
 * `(?<![\p{L}\p{M}])` / `[ሀ-ፚ]` lookaround.
 *
 * Deliberately not done:
 *   · ETHIOPIC NUMERALS ፩፪፫…፻፼ (U+1369–U+137C) have no reader. They fall outside TOKEN's letter class and
 *     phonemize to the empty string — a real defect if they appear, but the system is ADDITIVE with no zero,
 *     so `foldNativeDigits` cannot help and a reader has to be written from scratch.
 *   · THE ETHIOPIAN CALENDAR AND THE 6-HOUR CLOCK OFFSET are not applied. Amharic text writes European digits
 *     with ኤ.ኤም / ፒ.ኤም / GMT markers, i.e. already in the European frame, and nothing in the text settles
 *     which frame a bare time is in — converting would be guessing. ዓ.ም / እ.ኤ.አ. are likewise left as
 *     letter-runs rather than resolved to a calendar.
 *   · ሚሜ (millimetre) is left alone. ኪ.ሜ is expanded because Amharic also writes ኪሎ ሜትር out in full; ሚሜ has
 *     no such attestation, and a wrong expansion is worse than the written abbreviation.
 *   · NO BIRR RULE. ብር is almost entirely a false positive — ብርሃን "light", መቃብር "grave", ክብር "honour".
 */

/** Ethiopic syllabary letters, EXCLUDING the punctuation and numeral sub-blocks (U+135F and up). */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Amharic;

public static class Normalize
{
    private const string FID = "[\\u1200-\\u135A]";

    /** Amharic decimal point. */
    private const string POINT = "ነጥብ";

    /** Range connective — Amharic writes "ከ 100 እስከ 250 ሜትር" out in full, which the hyphenated form abbreviates. */
    private const string UNTIL = "እስከ";

    /**
     * ORDINALS. Amharic forms the ordinal on the LAST word of the cardinal with the suffix ኛ, and ⚠ A
     * CONSONANT-FINAL (6th-order, ɨ) CARDINAL TAKES ITS 1st-ORDER COUNTERPART before it: አንድ→አንደኛ (ድ→ደ),
     * ሁለት→ሁለተኛ (ት→ተ), ዘጠኝ→ዘጠነኛ (ኝ→ነ), አስር→አስረኛ (ር→ረ). Vowel-final cardinals just suffix: ሃያ→ሃያኛ, which is the
     * regular rule 30–90, መቶ and ሺ follow. A teen composes as አስራ + the unit's ORDINAL.
     */
    private static readonly IReadOnlyDictionary<string, string> ORDINAL = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["አንድ"] = "አንደኛ", ["ሁለት"] = "ሁለተኛ", ["ሦስት"] = "ሦስተኛ", ["አራት"] = "አራተኛ", ["አምስት"] = "አምስተኛ",
        ["ስድስት"] = "ስድስተኛ", ["ሰባት"] = "ሰባተኛ", ["ስምንት"] = "ስምንተኛ", ["ዘጠኝ"] = "ዘጠነኛ", ["አስር"] = "አስረኛ",
        ["ሃያ"] = "ሃያኛ", ["ሰላሳ"] = "ሰላሳኛ", ["አርባ"] = "አርባኛ", ["ሃምሳ"] = "ሃምሳኛ", ["ስልሳ"] = "ስልሳኛ",
        ["ሰባ"] = "ሰባኛ", ["ሰማንያ"] = "ሰማንያኛ", ["ዘጠና"] = "ዘጠናኛ",
        ["መቶ"] = "መቶኛ", ["ሺ"] = "ሺኛ", ["ሚሊዮን"] = "ሚሊዮንኛ", ["ቢሊዮን"] = "ቢሊዮንኛ", ["ዜሮ"] = "ዜሮኛ",
    };

    private static readonly JsRe DOUBLE_WORDSPACE = JsRegex.Compile("፡፡", "gu");
    private static readonly JsRe TIME_SEP = JsRegex.Compile("(\\d)፡(\\d)", "gu");
    private static readonly JsRe MULTI_DOT = JsRegex.Compile($"(?:{FID}{{1,5}}\\.){{2,}}{FID}{{0,5}}\\.?", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe INTERIOR_DOT = JsRegex.Compile($"(?<={FID})\\.(?={FID})", "gu");
    private static readonly JsRe LONE_WORDSPACE = JsRegex.Compile("፡-?", "gu");
    private static readonly JsRe GROUPED = JsRegex.Compile("(\\d),(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<!\\d)(\\d{1,2}):([0-5]\\d)(?:\\.(\\d+))?(?!\\d)", "gu");
    private static readonly JsRe CLOCK_DOT_TZ = JsRegex.Compile("(?<!\\d)(\\d{1,2})\\.00(?=\\s*(?:GMT|UTC|ዩቲሲ|ጂኤምቲ))", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\p{L}\\p{M}])ከ\\s?(\\d[\\d.]*)\\s?[-–—]\\s?(\\d[\\d.]*)", "gu");
    private static readonly JsRe CODE_PREFIXED_SIGN = JsRegex.Compile("(?<=[A-Za-zሀ-ፚ])(?=\\$\\s?\\d)", "gu");
    private static readonly JsRe REDUNDANT_DOLLAR = JsRegex.Compile(
        "\\$\\s?(\\d[\\d.,]*)(\\s+(?:ሚሊዮን|ቢሊዮን|ቢልየን|ትሪሊዮን))?(?=\\s*ዶላ[ርሮ])", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\s*ኛ([ውዋ]?)(?![ሀ-ፚ])", "gu");
    private static readonly JsRe SQUARE_KM = JsRegex.Compile("(?<![ሀ-ፚ])ኪሜ\\s?[²2](?![\\d\\p{L}])", "gu");
    private static readonly JsRe KM = JsRegex.Compile("(?<![ሀ-ፚ])ኪሜ(?![ሀ-ፚ])", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("°", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+[ \u00a0]?(?=\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|[ \u00a0])\\+[ \u00a0]?(?=\\d)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\S+)\\s*<\\s*(\\S+)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\S+)\\s*>\\s*(\\S+)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\S+)\\s*÷\\s*(\\S+)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile("[ \u00a0]{2,}", "gu");

    /**
     * Build the Amharic normalizer.
     *
     * `numberToText` is injected rather than imported so that normalize.ts and amharic.ts do not form an
     * import cycle: amharic.ts owns the number composer and hands it over here.
     *
     * `symbols` is the shared `makeSymbolNormalizer` pass (%, currency). It is threaded THROUGH this function
     * instead of wrapping it, because the ordering is load-bearing in both directions — see step 9.
     */
    public static Func<string, string> MakeAmharicNormalizer(Func<double, string> numberToText, Func<string, string> symbols)
    {
        /** Spell one integer string; falls back to the digits when out of the composer's range. */
        string Words(string digits)
        {
            var n = Js.Number(digits);
            return double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d && n >= 0 && n < 1e12 ? numberToText(n) : digits;
        }
        /** Digits read one at a time — the fractional tail of a decimal. */
        string EachDigit(string digits) =>
            string.Join(" ", Js.CodePoints(digits).Select(d => numberToText(Js.Number(d))));
        /** Ordinal: compose the cardinal, then inflect only its FINAL word. */
        string Ordinal(string digits)
        {
            var w = Words(digits).Split(' ').ToList();
            if (!ORDINAL.TryGetValue(w[^1], out var o)) return "";
            w[^1] = o;
            return string.Join(" ", w);
        }

        return input =>
        {
            var s = input;

            // 1. ፡፡ → ። . ⚠ TWO U+1361 ETHIOPIC WORDSPACE is the typewriter/keyboard substitute for ። (አራት ነጥብ),
            //    and it is routinely a text's ONLY sentence terminator. It is in no `clausePunctuation` and
            //    reaches no branch of TOKEN, so every such sentence boundary produces no pause at all.
            //    FIRST, so step 4 sees only lone ፡.
            s = DOUBLE_WORDSPACE.Replace(s, "።");

            // 2. ፡ used as a TIME separator (11፡00, 9፡30). Folded to ASCII ':' so the single clock rule in
            //    step 5 covers both spellings. BEFORE step 4, which claims every remaining lone ፡.
            s = TIME_SEP.Replace(s, "$1:$2");

            // 3. DOTTED ABBREVIATIONS. Amharic writes initialisms and unit abbreviations with ASCII dots between
            //    Ethiopic letters (ኤ.ኦ.ኤል, ኤፍ.ቢ.አይ., እ.ኤ.አ., ፒ.ኤም, ኪ.ሜ). Each interior dot is mapped by
            //    `clausePunctuation` to a full STOP, shattering one initialism into up to six phrases. Removing
            //    the dots leaves a fidel run, which IS the spelled reading.
            //
            //    MULTI-DOT FIRST, and the multi-dot form also loses its TRAILING dot. ⚠ That is safe only because
            //    Amharic terminates sentences with ። rather than with an ASCII dot.
            s = MULTI_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));
            //    Then the single INTERIOR dot (ኪ.ሜ, ዓ.ም, ፒ.ኤም). Bounded by a fidel on BOTH sides, so it cannot
            //    touch 1.5, 802.11a, or a genuine trailing period after a word.
            s = INTERIOR_DOT.Replace(s, "");
            //    ⚠ A trailing dot on a SINGLE-dot abbreviation (ወዘተ., ቁ., ሰዓ.) is deliberately LEFT: that shape is
            //    indistinguishable from a word plus a sentence period.

            // 4. Any remaining lone ፡ is a clause colon introducing a list. Mapped to ASCII ',', which
            //    `clausePunctuation` already carries. AFTER step 2, which took the time separators.
            s = LONE_WORDSPACE.Replace(s, ",");

            // 5. DIGIT DE-GROUPING, before anything reads a comma as punctuation. "5,000" reads as "አምስት , ዜሮ" —
            //    a phrase break plus the word for zero. Amharic groups with commas only, never the period.
            s = GROUPED.Replace(s, "$1");
            s = GROUPED.Replace(s, "$1"); // second pass for 5,000,000

            // 6. CLOCK, before any rule that could claim a bare number, and before decimals — the corpus's
            //    sports splits are "4:41.30", where the clock must take 4:41 and leave .30 to step 10.
            //    The colon was becoming a COMMA, so "10:08" read as "አስር , ስምንት".
            //
            //    ⚠ ONLY THE SEPARATOR IS RESOLVED. No ሰዓት/ደቂቃ is inserted: the text already supplies the frame.
            //    ⚠ THE OPTIONAL `.SS` TAIL IS CONSUMED HERE rather than left to step 10, because step 10's decimal
            //    pattern needs digits on BOTH sides of the dot and the clock rewrite has just removed them.
            s = CLOCK.Replace(s, m =>
            {
                var h = m.Groups[1].Value;
                var mi = m.Groups[2].Value;
                string? frac = m.Groups[3].Success ? m.Groups[3].Value : null;
                // :00 is the whole hour and is read as the bare hour, not as "…zero".
                var hm = Js.Number(mi) == 0 && frac is null ? Words(h) : $"{Words(h)} {Words(mi)}";
                return frac is null ? $" {hm} " : $" {hm} {POINT} {EachDigit(frac)} ";
            });

            // 7. A clock written with a DOT and an explicit timezone ("ከቀኑ 12.00 GMT"). Without this the decimal
            //    rule in step 10 reads it as "twelve point zero zero". Guarded by the timezone token.
            s = CLOCK_DOT_TZ.Replace(s, m => $" {Words(m.Groups[1].Value)} ");

            // 8. RANGES, restricted to the ከ ("from") frame — "ከ120-160 ሜትር" → "ከ 120 እስከ 160 ሜትር".
            //    ⚠ THE RESTRICTION IS THE RULE. Most hyphenated number pairs are SPORTS SCORES or bracketed year
            //    spans, which must NOT become "from…to".
            s = RANGE.Replace(s, m => $"ከ {m.Groups[1].Value} {UNTIL} {m.Groups[2].Value}");

            // 8b. TWO LOCAL WORKAROUNDS for the shared currency tier, reported as core limitations rather than
            //     fixed there — a `core/` change would touch every language.
            //
            //     ⚠ (i) The tier's `CUR` key is guarded by `(?<![\p{L}\p{M}])`, so a LETTER-CODE PREFIX blocks it:
            //     "US$14.7", "ዩኤስ$30" match nothing and the sign is dropped outright.
            s = CODE_PREFIXED_SIGN.Replace(s, " ");
            //     ⚠ (ii) The tier's "the text already says it" guard is a PREFIX test against the declared noun,
            //     which does not survive Amharic plural morphology: ዶላሮች is not a prefix of ዶላር. "$100 ዶላሮች"
            //     therefore reads "መቶ ዶላር ዶላሮች". Dropping the now-redundant sign here is equivalent.
            s = REDUNDANT_DOLLAR.Replace(s, m => $"{m.Groups[1].Value}{(m.Groups[2].Success ? m.Groups[2].Value : "")}");

            // 9. SHARED SYMBOL TIER (%, $, ¥, £) runs HERE, in the middle: after de-grouping and the clock but
            //    BEFORE decimals, because the tier's own NUM pattern matches "14.7" as one number and a decimal
            //    rewrite would destroy the currency adjacency.
            s = symbols(s);

            // 10. DECIMALS. Integer part as a number, ነጥብ, then the fraction ONE DIGIT AT A TIME. After the
            //     clock (step 6/7) and after the symbol tier (step 9); the abbreviation dots are long gone.
            s = DECIMAL.Replace(s, m => $" {Words(m.Groups[1].Value)} {POINT} {EachDigit(m.Groups[2].Value)} ");

            // 11. ORDINALS. "19ኛ" / "15 ኛ" / "11ኛው" — the ኛ was a separate token and the cardinal kept its
            //     un-inflected final syllable. Any definite/feminine tail (ው/ዋ) is preserved.
            s = ORDINAL_RE.Replace(s, m =>
            {
                var o = Ordinal(m.Groups[1].Value);
                return o == "" ? m.Value : $" {o}{m.Groups[2].Value} ";
            });

            // 12. SQUARED AREA, ⚠ BEFORE the plain ኪ.ሜ expansion in step 13, which would otherwise strand the
            //     exponent and drop it. ካሬ PRECEDES the unit, which is Amharic's own convention.
            s = SQUARE_KM.Replace(s, "ካሬ ኪሎ ሜትር");

            // 13. ኪ.ሜ / ኪሜ → ኪሎ ሜትር. Amharic writes "ሰባ ኪሎ ሜትር" out in full, so the expansion is the spoken
            //     form. ⚠ Unconditional rather than routed through the shared unit tier, because it also occurs
            //     with no adjacent number ("ኪ.ሜ በ ሰዓት").
            s = KM.Replace(s, "ኪሎ ሜትር");

            // 14. ° → ዲግሪ. ⚠ Only the SIGN is resolved: the Latin scale letter after it (C, W) is outside TOKEN's
            //     alphabet and stays dropped, and no Amharic spelling of "Celsius" is sourceable.
            s = DEGREE.Replace(s, " ዲግሪ ");

            // 15. THE PLUS SIGN → ፕላስ. Two arms, so the sign is read whether glued to a label (`UTC+1`) or opening
            //     the quantity. ⚠ The MEASUREMENT position is voiced too: omitting a plus is lossless where
            //     omitting a minus inverts.
            s = PLUS_ATTACHED.Replace(s, "$1 ፕላስ ");
            s = PLUS_LEADING.Replace(s, "$1ፕላስ ");

            // 16. THE RELATIONAL AND DIVISION SIGNS, which need a rule shape none of the other languages use.
            //
            //     ⚠ THE STANDARD OF COMPARISON TAKES A PREFIX, NOT A POSTPOSITION. Amharic marks it with ከ- on the
            //     FRONT of the operand and puts the comparative after it, so `A < B` is "A ከB ያነሰ".
            //     core/postposedSign.ts cannot express that: it appends words after the operand and never modifies
            //     it. Division is the same shape with በ-. `እኩል` alone reads infix.
            //
            //     ⚠ THE PREFIX IS WRITTEN FUSED TO THE DIGIT AND ENDS UP AS ITS OWN TOKEN — a known limitation.
            //     The PHONES are identical either way, so it is a prosodic imperfection.
            s = LESS_THAN.Replace(s, "$1 ከ$2 ያነሰ");
            s = GREATER_THAN.Replace(s, "$1 ከ$2 የበለጠ");
            s = DIVIDE.Replace(s, "$1 በ$2 በመክፈል");
            s = EQUALS.Replace(s, " እኩል ");

            return DOUBLE_SPACE.Replace(s, " ");
        };
    }
}
