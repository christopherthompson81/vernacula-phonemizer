/**
 * Cherokee (chr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE THREE RULES THIS FILE SHIPS NEED NO VOCABULARY AT ALL, AND THAT IS WHY THEY SHIP. chr.wikipedia is
 * the SMALLEST corpus in the fleet, and the round's governing finding is that almost every vocabulary class
 * this layer could have read is UNSOURCEABLE. Every rule here is a SEPARATOR being spent — a grouping
 * comma, a decimal dot, a span dash — and none introduces a word this wiki cannot attest.
 *
 * ⚠ AND A RULE HERE MAY ONLY EVER EMIT SYLLABARY. The engine's TOKEN never claims a Latin run, so
 * `AssembleClauses` hands it to the Latin-to-English fallback — any word this layer emitted in Latin would
 * be read as ENGLISH.
 *
 * ⚠ THE COMMA GROUPS AND NEVER DECIMATES, WITH NO EXCEPTIONS — the round's largest defect, and one that
 * produced a WRONG NUMBER rather than a missing word. Every `\d,\d{3}` in the retained text (50 match
 * positions) is a thousands group; not one is a decimal separator. Before this layer the tokenizer read the
 * comma as CLAUSE PUNCTUATION and each group as its own numeral — `17,000` read as *seventeen zero*, a
 * silent 1000× error in well-formed Cherokee that no gate could see.
 * Ported from src/languages/cherokee/normalize.ts — see that file for the corpus counts and for every
 * class it refuses.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Cherokee;

public static class Normalize
{
    /** The syllabary's full range, main block + Supplement. Exported by the TS for the script router. */
    public const string CHEROKEE = "\\u13A0-\\u13F5\\u13F8-\\u13FD\\uAB70-\\uABBF";

    private static readonly JsRe DASH_ENTITY = JsRegex.Compile("&(ndash|mdash);", "gu");
    private static readonly JsRe COMMA_GROUP =
        JsRegex.Compile("(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe DIGIT_DASH = JsRegex.Compile("(\\d)\\s?[\\u2013\\u2014]\\s?(?=\\d)", "gu");
    private static readonly JsRe SPACED_DASH = JsRegex.Compile("[^\\S\\n][\\u2013\\u2014][^\\S\\n]", "gu");
    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    public static string NormalizeCherokee(string input)
    {
        var s = input;
        s = Rewrite(s, DASH_ENTITY, m => m.Groups[1].Value == "ndash" ? "–" : "—");
        s = Rewrite(s, COMMA_GROUP, m => m.Groups[1].Value + COMMAS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, DOT_DECIMAL, "$1 $2");
        s = Rewrite(s, DIGIT_DASH, "$1, ");
        s = Rewrite(s, SPACED_DASH, ", ");
        return Rewrite(s, WS_RUN, " ");
    }
}
