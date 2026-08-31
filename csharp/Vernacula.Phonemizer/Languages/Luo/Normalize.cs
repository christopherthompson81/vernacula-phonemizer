/**
 * Luo / Dholuo (luo) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Ported from src/languages/luo/normalize.ts — see that file's header for the corpus evidence, the counts
 * behind every reading, and the list of what is DELIBERATELY NOT DONE (percent, ¥, degrees, plus, minus,
 * ampersand, era, units — each refused and priced there). The steps below are ORDER-DEPENDENT, and the
 * coupling that forces each order is stated at the step.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Luo;

public static class Normalize
{
    /** ⚠ NEVER `\b` — and in Dholuo the word-continuation class must include the ⟨ng'⟩ APOSTROPHE in all
     *  three encodings the corpus and this engine accept (ASCII `'`, U+2019, U+02BC). It is a LETTER here,
     *  exactly as the Hawaiian ʻokina is, and a guard that treats it as a boundary would let a rule bite
     *  into `ng'wech`, `chieng'`, `maduong'`. */
    private const string WORD_CHAR = "\\p{L}\\p{M}'\u2019\u02bc";
    private const string NOT_BEFORE = $"(?<![{WORD_CHAR}])";

    /** The magnitude words this corpus writes BETWEEN a currency noun and its figure — `dola bilion $2.3`. */
    private const string MAGNITUDE = "(?:tara|gana|milion|bilion|elfu)";

    /** A currency noun or ISO code ALREADY in the clause makes the sign redundant. Case-insensitive, word-bounded. */
    private static readonly JsRe ALREADY_NAMED =
        JsRegex.Compile($"{NOT_BEFORE}(dola|paund|yuro|aud|usd|gbp|eur|kes)(?![{WORD_CHAR}])", "iu");

    /** Currency sign → the corpus's own noun. `¥` is absent on purpose — see the TS header. */
    private static readonly Dictionary<string, string> CURRENCY = new() { ["$"] = "dola", ["£"] = "paund" };

    private static readonly JsRe DEGROUP =
        JsRegex.Compile("(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe DESIGNATION =
        JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?=\\p{L}(?![\\p{L}\\p{M}]))", "gu");
    private static readonly JsRe CURRENCY_RE =
        JsRegex.Compile($"{NOT_BEFORE}({MAGNITUDE}\\s+)?([$£])\\s?(?=\\d)", "giu");
    private static readonly JsRe CLOCK_RANGE =
        JsRegex.Compile("(?<![\\d:.,])(\\d{1,2}:\\d{2})\\s?-\\s?(\\d{1,2}:\\d{2})(?![\\d:.,])", "gu");
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![\\d.,:\\-\\/])(\\d+(?:\\.\\d+)?)\\s?-\\s?(\\d+(?:\\.\\d+)?)(?![\\d\\/\\p{L}\\p{M}])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe DOT_CLOCK_SAA =
        JsRegex.Compile("(?<=(?:saa|Saa)\\s)(?<![\\d.,:])(\\d{1,2})\\.(\\d{2})(?![\\d.,:])", "gu");
    private static readonly JsRe DOT_CLOCK_UTC =
        JsRegex.Compile("(?<![\\d.,:])(\\d{1,2})\\.(\\d{2})(?![\\d.,:])(?=\\s?(?:UTC|GMT))", "gu");
    private static readonly JsRe CLOCK =
        JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe DECIMAL =
        JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?!\\d)(?!\\.\\d)", "gu");
    private static readonly JsRe SPACED_DASH =
        JsRegex.Compile("\\s+[-\u2013\u2014]+\\s+", "gu");
    private static readonly JsRe PADDED_RUN =
        JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** The digit COUNT of an operand — the range rule's guard is a digit-count test, not an ascending one. */
    private static string DigitsOnly(string s)
    {
        var sb = new StringBuilder();
        foreach (var c in s) if (c >= '0' && c <= '9') sb.Append(c);
        return sb.ToString();
    }

    /** Normalize one Dholuo input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeLuo(string input)
    {
        var s = input;

        // 1) DE-GROUP THE COMMA, FIRST — otherwise the grouping comma is read as clause punctuation and the
        //    tail as a separate number. The whole number at once (the idiom is used because the shape is what
        //    is rare), and the trailing guard rejects a digit and nothing else so a clause-final figure still
        //    de-groups. It must not claim the date comma — `Septemba 11,2001` is declined by `\d{3}`, which
        //    is the same test that identifies the grouping, so no extra guard is needed.
        s = Rewrite(s, DEGROUP, m => m.Groups[1].Value + m.Groups[2].Value.Replace(",", ""));

        // 2) THE DOTTED DESIGNATION, BEFORE THE DECIMAL RULE — the decimal step below spends the dot, so
        //    anything that needs to SEE the dot runs above it. `802.11a/b/g/n` reads as *mia aboro gariyo
        //    . apar gachiel a*. The discriminator is that the trailing run is ONE LETTER; `22.4Ghz` (three)
        //    is declined and step 8 reads it as a decimal. The dot is spent SILENTLY — no word and no pause.
        s = Rewrite(s, DESIGNATION, "$1 $2");

        // 3) CURRENCY — claimed only where the writer has not already said the word (the noun already
        //    precedes in this corpus, so the sign is redundant there). The noun HOPS THE MAGNITUDE, because
        //    that is the order the corpus itself writes: `dola bilion $2.3`. Runs above step 4 because it
        //    needs the figure still adjacent to the sign. ⚠ `AUD$45` is declined: the ISO code is present
        //    and spoken, which the letter-lookbehind expresses.
        {
            var subject = s;
            s = Rewrite(s, CURRENCY_RE, m =>
            {
                var off = m.Index;
                var mag = m.Groups[1].Success ? m.Groups[1].Value : "";
                var sign = m.Groups[2].Value;
                var before = subject[Math.Max(0, off - 30)..off];
                if (ALREADY_NAMED.IsMatch(before)) return mag;
                return $"{CURRENCY[sign]} {mag}";
            });
        }

        // 4) THE CLOCK RANGE, BEFORE THE GENERIC RANGE AND BEFORE THE CLOCK — `E kind seche mag 10:00-11:00
        //    otieno`. The generic range rule correctly refuses it (its operands are colon-flanked), and if
        //    the clock step ran first the colons would be gone and the range rule would read `00-11` as a
        //    span. One instance, written as its own arm rather than by loosening a guard.
        s = Rewrite(s, CLOCK_RANGE, "$1 nyaka $2");

        // 5) RANGES → `nyaka`, ABOVE THE DECIMAL STEP. The operands admit a decimal (the corpus writes
        //    `higni tara 4.2-3.9`), which is why this runs above step 8. ⚠ THE GUARD IS A DIGIT-COUNT TEST,
        //    NOT AN ASCENDING ONE — the truncated second endpoint (`1995-96`, a season) is what needs
        //    refusing, and a descending score (`26-00`) must not be. A letter glued to the second operand is
        //    a DESIGNATION (`2-76s`), refused by the trailing lookahead.
        s = Rewrite(s, RANGE, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return DigitsOnly(b).Length < DigitsOnly(a).Length ? m.Value : $"{a} nyaka {b}";
        });

        // 6) THE DOT CLOCK, BEFORE THE DECIMAL RULE — the writer's own noun is the discriminator. `saa 12.00`
        //    becomes `saa 12 00`. ⚠ `saa 1.5` is a decimal number of hours after the SAME noun and is
        //    refused by the two-digit fraction. The dot is spent, not spoken, exactly as the colon is at step 7.
        s = Rewrite(s, DOT_CLOCK_SAA, "$1 $2");
        s = Rewrite(s, DOT_CLOCK_UTC, "$1 $2");

        // 7) THE CLOCK. The colon is `clausePunctuation` in luo.jsonc, so `e saa 9:30` read as *e saa ochiko ,
        //    piero adek*. Every clock in the corpus is introduced by the writer's own `saa`, so the figures
        //    stay FIGURES and only the colon is spent. ⚠ NO SIX-HOUR CONVERSION IS ATTEMPTED. The three
        //    non-clocks are declined for three independent reasons (`2:2` fails `[0-5]\d`; the sports times
        //    fail the trailing guard on their `.`).
        s = Rewrite(s, CLOCK, "$1 $2");

        // 8) DECIMALS → `nukta`. The dot was reaching `clausePunctuation` and becoming a SENTENCE BREAK mid-
        //    number. The fractional digits are SPACED APART so the number path speaks them one at a time.
        //    ⚠ THE GUARD IS "EXACTLY ONE DOT IN THE RUN", and the trailing half is what lets a clause-final
        //    decimal still decimate: `(?!\d)(?!\.\d)` excludes a separator CONTINUING the number, not a
        //    clause mark.
        s = Rewrite(s, DECIMAL, m =>
        {
            var intPart = m.Groups[1].Value;
            var frac = m.Groups[2].Value;
            // ⚠ THE FRACTIONAL DIGITS ARE SPACED APART so the number path speaks them one at a time:
            // `3.50` is *adek nukta abich nono*, never "fifty". JS `[...frac]` spreads by CODE POINT.
            return $"{intPart} nukta {string.Join(" ", Js.CodePoints(frac))}";
        });

        // 9) THE SPACED DASH IS A PARENTHETICAL BREAK AND WAS BEING DROPPED ENTIRELY. ⚠ LAST, so step 5 has
        //    already claimed the one spaced RANGE. It must not require a non-digit on both sides (a clause
        //    dash after a NUMBER must keep its pause), and it REQUIRES spaces on both sides, which protects
        //    the one en dash that is a NAME JOINER.
        s = Rewrite(s, SPACED_DASH, ", ");

        // A padded replacement doubles a space that was already there. Harmless downstream because
        // assembleClauses collapses runs, but this pass should not be the one producing candidates for it.
        return Rewrite(s, PADDED_RUN, " ");
    }
}
