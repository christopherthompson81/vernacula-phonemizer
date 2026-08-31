/**
 * Scottish Gaelic (gd) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/scottishgaelic/normalize.ts — see that file for the corpus evidence and the
 * four classes refused on a measurement (degrees, ×, =, initialisms).
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.ScottishGaelic;

public static class Normalize
{
    /**
     * Gaelic ordinals 1–20, attributive. ⚠ THE TEENS ARE STORED AS THEIR HEAD ALONE — 11–19 are a
     * CIRCUMFIX in Gaelic (the head before the counted noun, `deug` after it), so step 4 supplies `deug`
     * on the far side of the noun; storing "aonamh deug" would produce the one thing the language does
     * not say.
     */
    private static readonly string[] ORD_1_20 =
    [
        "", "chiad", "dàrna", "treas", "ceathramh", "còigeamh", "siathamh", "seachdamh", "ochdamh",
        "naoidheamh", "deicheamh",
        // 11–19: the head only; `deug` follows the noun.
        "aonamh", "dàrna", "treas", "ceathramh", "còigeamh", "siathamh", "seachdamh", "ochdamh", "naoidheamh",
        "ficheadamh",
    ];

    private static bool IsTeen(int n) => n >= 11 && n <= 19;

    /**
     * Dotted abbreviations. Kept SHORT on purpose: a one-or-two-letter Gaelic word before a full stop is
     * overwhelmingly an ordinary word ending a sentence, so a wide table would be claiming sentence ends,
     * not abbreviations.
     */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["srl"] = "agus mar sin air adhart",
            ["td"] = "taobh-duilleige",
            ["bh"] = "bheachd",
        };
    private static readonly string ABBREV_ALT =
        string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private const string NOT_LETTER = "(?![\\p{L}\\p{M}'’])";
    private const string NOT_BEFORE = "(?<![\\p{L}\\p{M}'’])";
    /** A Gaelic word, for the noun the teens ordinal has to reach across. */
    private const string WORD = "[a-zàèìòùáéíóú][a-zàèìòùáéíóú'’-]*";

    // 0) DIGIT DE-GROUPING — ON BOTH MARKS, because this corpus writes both. The COMMA is Gaelic's ordinary
    //    thousands separator and the DOT also groups (`32.976.026`), so the three-digit test runs twice.
    private static readonly JsRe DEGROUP_COMMA =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0),(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe DEGROUP_DOT =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))", "gu");
    // The SI space form (space, NBSP, NNBSP, thin space) — it does not occur in the retained text.
    private static readonly JsRe DEGROUP_SPACE =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[ \\u00a0\\u202f\\u2009](?=\\d{3}(?!\\d))", "gu");

    private static readonly JsRe ABBREV_BEFORE_WORD = JsRegex.Compile(
        $"{NOT_BEFORE}({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\d(])", "giu");
    private static readonly JsRe ABBREV_AT_END = JsRegex.Compile(
        $"{NOT_BEFORE}({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");

    private static readonly JsRe NUMBER_SIGN =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:no|àir)\\.\\s?(?=\\d)", "giu");
    private static readonly JsRe NUMBER_SIGN_NO = JsRegex.Compile("№\\s?(?=\\d)", "gu");
    private static readonly JsRe DECADE =
        JsRegex.Compile("(?<![\\d.,])((?:1\\d|20)\\d0)s(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ORDINAL = JsRegex.Compile(
        $"(?<![\\d.,])(\\d{{1,2}})-?(mh|na|s|d)(?:(\\s+)({WORD}))?{NOT_LETTER}", "giu");
    private static readonly JsRe DECIMAL_DOT =
        JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?![\\d.\\p{L}])", "gu");
    private static readonly JsRe MINUS =
        JsRegex.Compile("(^|(?<!\\d)[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Scottish Gaelic input string. Pure text→text; steps are ORDER-DEPENDENT. */
    public static string NormalizeScottishGaelic(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING, FIRST — and ⚠ ON BOTH MARKS, because this corpus writes both. EXACTLY THREE
        //    DIGITS is the test, which is what leaves every decimal (one or two places) untouched for step 5.
        //    Two passes each, because adjacent groups share the digit the first consumes.
        for (var i = 0; i < 3; i++)
        {
            s = Rewrite(s, DEGROUP_COMMA, "");
            s = Rewrite(s, DEGROUP_DOT, "");
        }
        for (var i = 0; i < 2; i++) s = Rewrite(s, DEGROUP_SPACE, "");

        // 1) DOTTED ABBREVIATIONS. The dot is consumed before a following word so it cannot become a phrase
        //    break; at a real sentence end it is kept.
        s = Rewrite(s, ABBREV_BEFORE_WORD, m =>
        {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own keys but
            // carries i+u, so the fold widens it and a near-miss matches while its key is absent — an
            // indexer here would throw where the TS returned the match unchanged.
            var w = DOTTED_ABBREV.TryGetValue(Js.ToLowerCase(m.Groups[1].Value), out var hit) ? hit : null;
            return w is null ? m.Value : w + m.Groups[2].Value;
        });
        s = Rewrite(s, ABBREV_AT_END, m =>
        {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122) — see the arm above.
            var w = DOTTED_ABBREV.TryGetValue(Js.ToLowerCase(m.Groups[1].Value), out var hit) ? hit : null;
            return w is null ? m.Value : w + ".";
        });

        // 2) ÀIREAMH. `no.` / `àir.` before a digit — the sign was dropped and the dot became a phrase break.
        s = Rewrite(s, NUMBER_SIGN, "àireamh ");
        s = Rewrite(s, NUMBER_SIGN_NO, "àireamh ");

        // 3) THE DECADE. `1990s`, `1960s` — Gaelic names a decade by its figure, so the plural marker is
        //    simply dropped.
        s = Rewrite(s, DECADE, "$1");

        // 4) THE ORDINAL, AND ITS CIRCUMFIX. The suffix is the TAIL OF THE FULL WORD (chiad → d, dàrna → na,
        //    treas → s, còigeamh → mh), so the rule derives the ordinal and keeps it only if it actually
        //    ENDS with what the writer typed — the endsWith check is what keeps `3 s` (three seconds) off
        //    *treas*. FOR 11–19 THE NOUN COMES IN THE MIDDLE: `19mh linn` is *an naoidheamh linn deug*, so
        //    the rule consumes the following noun and re-emits it VERBATIM with `deug` behind it; with no
        //    noun to reach across, `deug` goes straight after the head.
        s = Rewrite(s, ORDINAL, m =>
        {
            var n = (int)Js.Number(m.Groups[1].Value);
            var head = n >= 1 && n <= 20 ? ORD_1_20[n] : null;
            if (head is null || !head.EndsWith(Js.ToLowerCase(m.Groups[2].Value), StringComparison.Ordinal))
                return m.Value;
            var tail = m.Groups[4].Success ? m.Groups[3].Value + m.Groups[4].Value : "";
            return IsTeen(n) ? head + tail + " deug" : head + tail;
        });

        // 5) THE DOT DECIMAL. ⚠ THE DOT IS THE DECIMAL POINT HERE — the English convention, the opposite of
        //    every other layer in the sweep — and step 0 has already taken the three-digit grouping case off
        //    the table, so what is left is a genuine fraction. THE FRACTION DIGITS ARE EMITTED AS DIGITS:
        //    the engine's own number path reads a bare `5` through the same compositor and the same g2p, so
        //    this rule cannot invent a numeral form.
        s = Rewrite(s, DECIMAL_DOT, m =>
            m.Groups[1].Value + " puing " + string.Join(" ", Js.CodePoints(m.Groups[2].Value)));

        // 6) SIGNS — ONLY THE MINUS. Gaelic's minus is the English loan. THE ASCII HYPHEN IS INCLUDED BUT
        //    ONLY AFTER A NON-DIGIT: the guard is a preceding space or paren that is not itself preceded by
        //    a digit, which keeps a year span (`1805 -1869`) and the glued scores and ISO dates off the rule.
        s = Rewrite(s, MINUS, "$1minus $2");

        // A padded replacement doubles a space that was already there. Harmless downstream because
        // AssembleClauses collapses runs, but this pass should not be the one producing candidates for it.
        return Rewrite(s, WS_RUN, " ");
    }
}
