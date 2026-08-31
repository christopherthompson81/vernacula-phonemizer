/**
 * Kikuyu / Gĩkũyũ (ki) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/kikuyu/normalize.ts — see that file for the corpus evidence behind every arm,
 * every word, and every rule deliberately not written.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Kikuyu;

public static class Normalize
{
    /** The RANGE joiner, written as a bare infix between two operands in the corpus. */
    private const string Range = "nginya";

    /** The PERCENT reading, composed from the engine's own hundred word and the ordinary locative. */
    private const string Percent = "harĩ igana";

    /** The DOLLAR noun, standing to the LEFT of its amount in this language's order. */
    private const string Dollar = "dolari";

    private const string Metre = "mita";
    private const string Kilometre = "kilomita";

    /**
     * THE ORTHOGRAPHIC SUBSTITUTES: the characters ki.wikipedia writes where the orthography has ⟨ĩ⟩ or
     * ⟨ũ⟩; each is a letter with no grapheme rule, so the engine deletes it. ⚠ `í`/`ú` are deliberately
     * absent — they are ALSO ordinary in the foreign names a Kikuyu wiki quotes, and the guard that would
     * separate the two was measured and refused. See the TS header for the counts.
     */
    private static readonly Dictionary<string, string> SUBSTITUTE = new()
    {
        ["ű"] = "ũ", ["Ű"] = "Ũ",
        ["ū"] = "ũ", ["Ū"] = "Ũ",
        ["û"] = "ũ", ["Û"] = "Ũ",
        ["ŭ"] = "ũ", ["Ŭ"] = "Ũ",
        ["ī"] = "ĩ", ["Ī"] = "Ĩ",
        ["î"] = "ĩ", ["Î"] = "Ĩ",
    };

    // ⚠ DERIVED FROM THE TABLE'S OWN KEYS, like the TS's `new RegExp(`[${Object.keys(SUBSTITUTE).join("")}]`)`.
    // Hand-writing the class works today and drifts tomorrow: add a substitute to the table and the TS regex
    // updates itself while a literal here silently does not — the "a table spelled twice is a table that
    // drifts" argument this codebase makes everywhere else. A `Dictionary` preserves insertion order, so the
    // class comes out in the same order the TS's `Object.keys` gives.
    private static readonly JsRe SUBSTITUTE_RX =
        JsRegex.Compile("[" + string.Concat(SUBSTITUTE.Keys) + "]", "gu");
    private static readonly JsRe FORMAT_CHARS = JsRegex.Compile("[\\p{Cf}￼]", "gu");
    private static readonly JsRe AMP = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe NBSP = JsRegex.Compile("&nbsp;", "giu");
    private static readonly JsRe QUOT = JsRegex.Compile("&quot;", "giu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?!\d)", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?!\d)", "gu");
    private static readonly JsRe GROUP_SPACE_MARKS = JsRegex.Compile("[ \u00a0\u202f\u2009]", "gu");
    private static readonly JsRe ORDINAL = JsRegex.Compile(@"(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe RANGE =
        JsRegex.Compile(@"(?<![-+−–—\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-+−\d\p{L}\p{M}]|[.,]\d)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile(@"(?<![\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00a0]?%", "gu");
    private static readonly JsRe US_DOLLAR = JsRegex.Compile(@"(?<![\p{L}\p{M}])US[ \u00a0]?\$[ \u00a0]?(?=\d)", "giu");
    private static readonly JsRe DOLLAR = JsRegex.Compile(@"\$[ \u00a0]?(?=\d)", "gu");
    private static readonly JsRe NAMED = JsRegex.Compile("dolari|dolar|dollars?|ciringi", "iu");
    private static readonly JsRe KM =
        JsRegex.Compile(@"(?<![\d.,\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00a0\u202f\u2009]?km(?![\p{L}\p{M}\d²³/])", "gu");
    private static readonly JsRe METRE_DECIMAL = JsRegex.Compile(@"(?<![\d.,\p{L}\p{M}])(\d+\.\d+)[ \u00a0]m(?![\p{L}\p{M}\d²³/])", "gu");
    private static readonly JsRe METRE = JsRegex.Compile(@"(?<![\d.,\p{L}\p{M}])(\d+)[ \u00a0]?m(?![\p{L}\p{M}\d²³/])", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile(@"(?<![\d.,])(\d+)\.(\d+)(?![\d.,\p{L}\p{M}])", "gu");
    private static readonly JsRe RUN_OF_SPACES = JsRegex.Compile(@"[^\S\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACES = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** Words this layer must not double when the sentence already carries them — checked on BOTH sides of
     *  the figure, because a Kikuyu measure noun normally PRECEDES its number and a before-only guard would
     *  miss the case that actually occurs (`kilomita 41,200km`, the corpus's only `km`). */
    private static bool SaidNear(string full, int offset, int end, string word) =>
        full[Math.Max(0, offset - 45)..Math.Min(full.Length, end + 45)].Contains(word);

    /** Kikuyu text normalization. A numbered, ORDER-DEPENDENT sequence. */
    public static string NormalizeKikuyu(string input)
    {
        // 1) THE ORTHOGRAPHIC-SUBSTITUTE FOLD, FIRST — before any rule and before the g2p, because everything
        //    downstream (this file's guards, the grapheme table) matches on the Kikuyu letters ⟨ĩ ũ⟩ and none
        //    of it can see a word spelled with a stand-in.
        //    ⚠ NFC FIRST, so a decomposed `u` + U+0303 is one code point before the table is consulted.
        //    ⚠ FORMAT CHARACTERS ARE STRIPPED IN THE SAME STEP: a zero-width inside a word SPLITS it into two
        //    tokens, and that is the same class of silent damage the fold exists to undo.
        var s = Renormalize(input, System.Text.NormalizationForm.FormC);
        s = Rewrite(s, SUBSTITUTE_RX, m => SUBSTITUTE[m.Value]);
        s = Rewrite(s, FORMAT_CHARS, "");

        // 2) HTML ENTITIES, before anything looks for a number beside a sign or a unit.
        //    ⚠ NO AMPERSAND WORD IS SPENT — the bare sign occurs only in English names.
        //    `&amp;` is unfolded first so a doubly-escaped entity does not survive as "amp" plus a semicolon.
        s = Rewrite(Rewrite(Rewrite(s, AMP, "&"), NBSP, " "), QUOT, "\"");

        // 3) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping comma reads as a CLAUSE
        //    PAUSE, so `1,312` came out two numbers and a pause where the text has one number.
        //    ⚠ EXACTLY THREE DIGITS PER BLOCK. That also declines the corpus's DIGIT LIST — the maths
        //    article's `ndari 1,2,3,4,5,6,7,8,9` — and its interval pair `(0,1)`, neither of which is a number.
        //    ⚠ THE HEAD MUST START 1–9, so a leading-zero run is never treated as a grouped thousand.
        //    ⚠ THE TRAILING GUARD IS BARE `(?!\d)`, and that is a measured divergence from the sibling layers:
        //    the comma is a grouping mark 86 times and a decimal ZERO times in this corpus. Inheriting the
        //    sibling guard left `3,066.3 ft` UNDE-GROUPED.
        s = Rewrite(s, GROUP_COMMA, m => m.Value.Replace(",", ""));
        // The space-grouped form, same shape. ⚠ `m.Value` is the MATCH, not the pipeline string — the inner
        // replace stays off the seam.
        s = Rewrite(s, GROUP_SPACE, m => JsRegex.Replace(m.Value, GROUP_SPACE_MARKS, ""));

        // 4) THE ENGLISH ORDINAL SUFFIX (`21st`, `20th`, …). Kikuyu writes its own ordinals as WORDS with a
        //    class-agreeing prefix, so a Latin suffix glued to a digit is always foreign orthography.
        //    ⚠ AFTER de-grouping, so a grouped ordinal is already one digit run; BEFORE the range rule, whose
        //    right guard excludes a trailing letter and would otherwise decline `1990th-2000th`.
        s = Rewrite(s, ORDINAL, "$1");

        // 5) RANGES → `nginya`. AFTER step 3 (a grouped endpoint must already be one digit run) and BEFORE
        //    the unit and percent rules, so neither operand has been rewritten into words by the time this
        //    pairs them.
        //    ⚠ ASCENDING ONLY: the descending pairs are all birth–death lines whose second operand is a DAY.
        //    ⚠ `+` AND `−` ARE IN THE LEFT GUARD: the corpus's two CHESS RESULT lines `(+1 -3 =0)` and
        //    `(+2 -5 =2)` are digit–dash–digit and ASCENDING, and without the sign both read as ranges.
        //    ⚠ A DOT OR COMMA ON EITHER SIDE IS EXCLUDED, so a DECIMAL range is declined. BUT ON THE RIGHT
        //    THAT MUST BE `[.,]\d` AND NOT A BARE `[.,]`, because a separator with NO digit after it is not a
        //    decimal — it is the END OF THE CLAUSE (`p 237–240.`).
        s = Rewrite(s, RANGE, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[2].Value)
                ? $"{m.Groups[1].Value} {Range} {m.Groups[2].Value}"
                : m.Value);

        // 6) PERCENT → `N harĩ igana`, the one POSTPOSED reading in this layer. BEFORE step 9, because the
        //    reading's operand is the whole number including its decimal tail: `29.2%` must become
        //    `29.2 harĩ igana` and only then be spelled out, or the sign attaches to `2`.
        //    ⚠ THE LEFT GUARD IS `(?<![\p{L}\p{M}])` ON THE DIGIT so this cannot bite into a word ending in
        //    a digit.
        s = Rewrite(s, PERCENT, $"$1 {Percent}");

        // 7) THE DOLLAR SIGN → `dolari N`, the noun BEFORE its amount (this language's order).
        //    ⚠ `US$` IS CLAIMED BY ITS OWN ARM FIRST, so the two letters do not reach the g2p as a separate
        //    token.
        //    ⚠ THE TRAP-12 GUARD IS ON BOTH SIDES: the corpus writes `dolari milioni 4.35` in monetary
        //    sentences, so a `$` beside an already-named currency must not say it twice.
        s = Rewrite(s, US_DOLLAR, $"{Dollar} ");
        // ⚠ `src7` IS THE PRE-REPLACE STRING, as the TS callback's `all` argument is — snapshot it.
        var src7 = s;
        s = Rewrite(s, DOLLAR, m =>
            SaidNear(src7, m.Index, m.Index + m.Value.Length, "dolari")
                || NAMED.IsMatch(src7[Math.Max(0, m.Index - 45)..m.Index])
                ? "" : $"{Dollar} ");

        // 8) UNITS — `m` → `mita N` and `km` → `kilomita N`, in the noun-first order the corpus writes without
        //    exception.
        //    ⚠ THE metre arm is SPLIT so a DECIMAL operand must be SPACED from the key: written as one arm it
        //    read `802.11m` as *mita 802 11* — measured, not predicted, on the first probe run of the TS file.
        //    `km` keeps the single arm: it is a TWO-letter key, which trap 28 explicitly requires to keep
        //    reading (`12.5km`).
        //    ⚠ A TRAILING DIGIT IS EXCLUDED, which is what leaves `241 m3/s` alone: this language has no cube
        //    word. ⚠ `km` CARRIES THE TRAP-12 GUARD AND `m` DOES NOT — the corpus's only `km` is redundant
        //    (`kilomita 41,200km`) while none of the `m` figures has `mita` beside it.
        //    AFTER the ranges (step 5) and BEFORE the decimals (step 9), which is what leaves `934.6` intact
        //    to be this rule's operand.
        var src8 = s;
        s = Rewrite(s, KM, m =>
            SaidNear(src8, m.Index, m.Index + m.Value.Length, Kilometre)
                ? m.Groups[1].Value : $"{Kilometre} {m.Groups[1].Value}");
        var src8b = s;
        s = Rewrite(s, METRE_DECIMAL, m =>
            SaidNear(src8b, m.Index, m.Index + m.Value.Length, Metre)
                ? m.Groups[1].Value : $"{Metre} {m.Groups[1].Value}");
        var src8c = s;
        s = Rewrite(s, METRE, m =>
            SaidNear(src8c, m.Index, m.Index + m.Value.Length, Metre)
                ? m.Groups[1].Value : $"{Metre} {m.Groups[1].Value}");

        // 9) DECIMALS, LAST of the numeric rules — steps 5 to 8 all need their number intact. The separator
        //    was reaching clausePunctuation and becoming a SENTENCE BREAK inside a number.
        //    ⚠ NO SEPARATOR WORD IS EMITTED, and none is sourceable: the fractional digits are read ONE AT A
        //    TIME with no separator, which is what fixes the spurious pause without inventing a word.
        //    ⚠ THERE IS NO COMMA ARM: every `\d+,\d{1,2}` in this corpus is from ONE maths article and
        //    neither instance is a decimal, against 86 comma-GROUPED thousands.
        //    ⚠ THE GUARDS EXCLUDE A MULTI-DOT RUN on both sides (the corpus's numbered dictionary clauses
        //    `11.3.42` and the Korean news datelines `2013.07.27`), and A TRAILING LETTER IS EXCLUDED
        //    (a dotted designation like `802.11a`).
        s = Rewrite(s, DECIMAL, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        return Tidy(s);
    }

    /** ⚠ A padded replacement doubles a space that was already there and can leave one at an edge. SLOT-GAP
     *  is a corpus-diff defect class; this pass may not feed it. */
    private static string Tidy(string s) =>
        Rewrite(Rewrite(s, RUN_OF_SPACES, " "), EDGE_SPACES, "");
}
