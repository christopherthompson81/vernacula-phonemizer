/**
 * Urdu (ur) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Tenth language. As with Bengali, the two biggest defects were NOT in this layer and are fixed in the
 * manifest and the engine: the numbers data had no fused 21–99 forms (so 21 read as "ایک بیس", one-twenty),
 * `clausePunctuation` mapped every mark to a PADDED copy of itself (producing double-space slot-gaps on the
 * ۔ that ends almost every one of the 2,109 utterances), the number function LEAKED ASCII DIGITS for any
 * decimal, and the manifest had no decimal word at all.
 *
 * Boundaries here are explicit lookarounds, never `\b` — the ASCII-only definition finds none against the
 * Arabic script, the trap that has now appeared in six languages including core/initialisms.ts itself.
 *
 * Measured over the ur_pk corpus (2,109 utterances): the ۔ full stop ×2095, the Arabic comma ×1481, dates
 * ×42, units ×38, ordinal suffixes ×27, decimals ×24, centuries ×19, times ×17, comma-grouping ×14, بجے
 * ×12, فیصد ×9. ASCII digits throughout — no Arabic-Indic digits occur.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Urdu;

public static class Normalize
{
    /** Arabic-Indic digits, both ranges, folded to ASCII so one representation reaches every rule. */
    private static readonly JsRe ARABIC_DIGIT = JsRegex.Compile("[٠-٩۰-۹]", "gu");

    private static string FoldDigit(string c)
    {
        var cp = Js.CodePointAt0(c);
        if (cp >= 0x0660 && cp <= 0x0669) return Js.NumberToString(cp - 0x0660);
        if (cp >= 0x06f0 && cp <= 0x06f9) return Js.NumberToString(cp - 0x06f0);
        return c;
    }

    /**
     * Ordinal suffixes. Urdu writes the ordinal as the numeral plus واں (masculine) or ویں (feminine/oblique),
     * with or without a space — the corpus has both (`15 ویں صدی` ×7, `17ویں` ×2, `60واں` ×2). The suffix
     * carries the agreement, so it is read off the text; previously it was tokenized apart and spoken as its
     * own syllable.
     *
     * 1–4 and 6 are suppletive; 5 and everything from 7 up are the cardinal with the suffix JOINED.
     */
    private static readonly IReadOnlyDictionary<string, int> SUFFIX_FORM = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["واں"] = 0, ["وان"] = 0, ["ویں"] = 1, ["وین"] = 1,
    };
    private static readonly IReadOnlyDictionary<int, string[]> IRREGULAR = new Dictionary<int, string[]>
    {
        [1] = new[] { "پہلا", "پہلی" },
        [2] = new[] { "دوسرا", "دوسری" },
        [3] = new[] { "تیسرا", "تیسری" },
        [4] = new[] { "چوتھا", "چوتھی" },
        [6] = new[] { "چھٹا", "چھٹی" },
    };

    /** Unit abbreviations and the SPACED spelling `کلو میٹر`, which read as two words ([kˈəlluː mˈiːʈəɾ]). */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["کلو میٹر"] = "کلومیٹر", ["کلو گرام"] = "کلوگرام", ["سینٹی میٹر"] = "سینٹیمیٹر", ["ملی میٹر"] = "ملیمیٹر",
        ["کلومیٹر/گھنٹہ"] = "کلومیٹر فی گھنٹہ",
    };
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe AR_PERCENT = JsRegex.Compile("٪", "gu");
    private static readonly JsRe AR_DECIMAL = JsRegex.Compile("٫", "gu");
    private static readonly JsRe AR_THOUSANDS = JsRegex.Compile("٬", "gu");
    private static readonly JsRe AR_COMMA_GROUP = JsRegex.Compile("(\\d)،(\\d{3})(?!\\d)", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s?({string.Join("|", SUFFIX_FORM.Keys)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        "(?<![\\d:])([01]?\\d|2[0-3])\\s?:\\s?([0-5]\\d)(?![\\d:])(?!,\\d)(\\s*بجے)?", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");

    /** Build the Urdu normalizer. Takes the numbers definition so ordinals compose the same cardinal words the
     *  engine's own number path uses. */
    public static Func<string, string> MakeUrduNormalizer(NumbersDef numbers)
    {
        List<string> Cardinal(double n) =>
            Core.Numbers.indicNumberWords(n, numbers).Select(w => w ?? "").ToList();

        string? Ordinal(double n, int form, string suffix)
        {
            if (IRREGULAR.TryGetValue((int)n, out var irr)) return irr[form];
            var words = Cardinal(n);
            if (words.Count == 0 || words.Any(w => w == "")) return null;
            words[^1] = $"{words[^1]}{suffix}";
            return string.Join(" ", words);
        }

        return input =>
        {
            var s = ARABIC_DIGIT.Replace(input, m => FoldDigit(m.Value));

            // 1) ARABIC SYMBOL CHARACTERS → ASCII, so the shared symbol tier (ASCII-keyed) applies. ٪ occurs
            //    once in this corpus and was dropped outright, exactly as in Arabic.
            s = AR_THOUSANDS.Replace(AR_DECIMAL.Replace(AR_PERCENT.Replace(s, "%"), "."), ",");
            //    The ARABIC COMMA is also used as a THOUSANDS SEPARATOR here (11،000). Between digits it is a
            //    grouping mark, not punctuation — left alone it was a clause break, so "11،000" read as
            //    "eleven … zero". Only the digit-flanked case is folded; ، as real punctuation is untouched.
            s = AR_COMMA_GROUP.Replace(s, "$1,$2");

            // 2) ORDINAL SUFFIXES, attached or spaced.
            s = ORDINAL_RE.Replace(s, m =>
                Ordinal(Js.Number(m.Groups[1].Value), SUFFIX_FORM[m.Groups[2].Value], m.Groups[2].Value) ?? m.Value);

            // 3) SPACED / ABBREVIATED UNITS. Longest first.
            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            // 4) DEGREES. Case-insensitive on the scale letter, and the bare sign too.
            s = DEG_C.Replace(s, "$1 ڈگری سینٹی گریڈ");
            s = DEG_F.Replace(s, "$1 ڈگری فارن ہائیٹ");
            s = DEG.Replace(s, "$1 ڈگری");

            // 5) CLOCK. The colon reached the output RAW (and padded, so also a double space), and :00 read as
            //    صفر. Urdu says "گیارہ بج کر بیس منٹ"; at :00 the minutes drop and a following بجے is right.
            s = CLOCK.Replace(s, m =>
            {
                var hv = Js.Number(m.Groups[1].Value);
                var mv = Js.Number(m.Groups[2].Value);
                var hw = string.Join(" ", Cardinal(hv));
                if (hw == "") return m.Value;
                var baje = m.Groups[3].Success ? m.Groups[3].Value : null;
                if (mv == 0) return $"{hw}{baje ?? " بجے"}";
                return $"{hw} بج کر {string.Join(" ", Cardinal(mv))} منٹ";
            });

            // 6) SIGNS. Neither occurs in this corpus, but a dropped sign is silent content loss wherever it does.
            s = MINUS.Replace(s, "$1منفی $2");
            s = PLUS_ATTACHED.Replace(s, "$1 جمع $2");
            s = PLUS_LEADING.Replace(s, "$1جمع $2");

            // THE RELATIONAL AND DIVISION SIGNS, sourced ENTIRELY from ur_pk — no Wikipedia needed, which
            // makes Urdu one of the few languages in this issue where tier 2 settled all four readings:
            //
            //   `برابر`      ×4 token   "اس تناسبِ نظر کے برابر" — EQUAL TO this aspect ratio
            //   `سے کم`      ×26 phrase  ·  `سے زیادہ` ×78 phrase   — both postposed, both with real operands
            //   `سے تقسیم`   ×1          "بارہ سے تقسیم دے کر" — FLEURS's parallel division sentence
            //   `تقسیم`      ×8 token    the division word on its own
            //
            // ⚠ THE COMPARATIVES ARE POSTPOSITIONAL, like Hindi's, so they use core/postposedSign.ts: سے follows
            // the standard of comparison, so `A < B` is "A B سے کم". An infix rule would read it backwards.
            //
            // The equality and the division read INFIX, matching the cognate pair `hi` already ships (बराबर / भाग)
            // — but sourced here from Urdu's own corpus rather than carried across, since the two languages are
            // separately attested and only the script differs for these words.
            s = PostposedSignPass.PostposedSign(s, "<", "سے کم");
            s = PostposedSignPass.PostposedSign(s, ">", "سے زیادہ");
            s = EQUALS_RE.Replace(s, " برابر ");
            s = DIVIDE.Replace(s, " تقسیم ");

            // 7) FRACTIONS, as "denominator بٹا numerator" — the ordinary spoken form; ½ is آدھا.
            s = FRACTION.Replace(s, m =>
            {
                var num = Js.Number(m.Groups[1].Value);
                var den = Js.Number(m.Groups[2].Value);
                if (num == 1 && den == 2) return "آدھا";
                var nw = string.Join(" ", Cardinal(num));
                var dw = string.Join(" ", Cardinal(den));
                return nw == "" || dw == "" ? m.Value : $"{nw} بٹا {dw}";
            });

            return s;
        };
    }
}
